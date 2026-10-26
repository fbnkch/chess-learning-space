import { browserWorker } from "./browserWorker";
import { Game } from "../game/Game";
import { analysisKey } from "./analysisKey";
import { parseInfo } from "./uci";
import type {
  Analysis,
  Budget,
  Engine,
  Line,
  Position,
  UciWorker,
} from "./types";
import { Chess } from "chess.js";
// Asserted against public/stockfish/SOURCE.json by assets.test.ts.
export const ENGINE_VERSION = "stockfish@19.0.1/stockfish-19-lite-single";
type Job = {
  id: number;
  position: Position;
  budget: Budget;
  key: string;
  turn: "white" | "black";
  resolve: (value: Analysis) => void;
  reject: (error: Error) => void;
  signal?: AbortSignal;
  detach: () => void;
  lines: Map<number, Map<number, Line>>;
  expectedLines: number;
  cancelled?: Error;
  preempted?: boolean;
};
const abortError = () => new DOMException("Analysis cancelled", "AbortError");

/** One UCI stream, one search at a time. Worker identity fences every callback. */
export class StockfishEngine implements Engine {
  private worker: UciWorker | null = null;
  private phase: "uci" | "boot" | "idle" | "sync" | "search" | "stop" = "idle";
  private queue: Job[] = [];
  private active?: Job;
  private nextId = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private cache = new Map<string, Analysis>();
  private disposed = false;
  constructor(
    private readonly factory: () => UciWorker = browserWorker,
    private readonly options: {
      timeoutMs?: number;
      stopTimeoutMs?: number;
      cacheSize?: number;
      engineVersion?: string;
    } = {},
  ) {}
  private flights = new Map<
    string,
    { promise: Promise<Analysis>; controller: AbortController; users: number }
  >();
  analyse(
    position: Position,
    budget: Budget,
    signal?: AbortSignal,
  ): Promise<Analysis> {
    if (this.disposed) return Promise.reject(new Error("Engine disposed"));
    if (signal?.aborted) return Promise.reject(abortError());
    try {
      this.validate(budget);
      const key = this.key(position, budget);
      let flight = this.flights.get(key);
      if (!flight) {
        const controller = new AbortController();
        flight = {
          promise: this.run(position, budget, controller.signal),
          controller,
          users: 0,
        };
        this.flights.set(key, flight);
        const current = flight;
        const clean = () => {
          if (this.flights.get(key) === current) this.flights.delete(key);
        };
        void flight.promise.then(clean, clean);
      } else if (budget.priority === "hint") {
        const job = [this.active, ...this.queue].find(
          (job) => job?.key === key,
        );
        if (job) job.budget.priority = "hint";
        this.sortQueue();
        if (
          this.active &&
          this.active.key !== key &&
          this.active.budget.priority !== "hint"
        ) {
          this.active.preempted = true;
          this.stop();
        }
      }
      const shared = flight;
      shared.users++;
      return new Promise((resolve, reject) => {
        let settled = false;
        const finish = () => {
          if (settled) return false;
          settled = true;
          signal?.removeEventListener("abort", abort);
          shared.users--;
          return true;
        };
        const abort = () => {
          if (!finish()) return;
          reject(abortError());
          if (!shared.users) {
            if (this.flights.get(key) === shared) this.flights.delete(key);
            shared.controller.abort();
          }
        };
        signal?.addEventListener("abort", abort, { once: true });
        void shared.promise.then(
          (result) => {
            if (finish()) resolve(structuredClone(result));
          },
          (error) => {
            if (finish()) reject(error);
          },
        );
      });
    } catch (error) {
      return Promise.reject(error);
    }
  }
  private validate(budget: Budget) {
    if (
      (budget.depth === undefined) === (budget.movetime === undefined) ||
      !Number.isInteger(budget.depth ?? budget.movetime) ||
      (budget.depth ?? budget.movetime ?? 0) < 1 ||
      !Number.isInteger(budget.multipv) ||
      budget.multipv < 1 ||
      budget.multipv > 256 ||
      (budget.timeoutMs !== undefined &&
        (!Number.isFinite(budget.timeoutMs) || budget.timeoutMs < 1))
    )
      throw new Error("Invalid analysis budget");
  }
  private key(position: Position, budget: Budget) {
    return `${analysisKey(position)}|${budget.depth === undefined ? `ms:${budget.movetime}` : `depth:${budget.depth}`}|${budget.multipv}|${this.options.engineVersion ?? ENGINE_VERSION}`;
  }
  private run(
    position: Position,
    budget: Budget,
    signal?: AbortSignal,
  ): Promise<Analysis> {
    if (this.disposed) return Promise.reject(new Error("Engine disposed"));
    if (signal?.aborted) return Promise.reject(abortError());
    try {
      position = { startFen: position.startFen, moves: [...position.moves] };
      budget = { ...budget };
      const key = this.key(position, budget);
      const cached = this.cache.get(key);
      if (cached) {
        this.cache.delete(key);
        this.cache.set(key, cached);
        return Promise.resolve(structuredClone(cached));
      }
      const game = new Game(position.startFen);
      position.moves.forEach((move) => game.play(move));
      return new Promise((resolve, reject) => {
        const job: Job = {
          id: ++this.nextId,
          position,
          budget,
          key,
          turn: game.turn,
          expectedLines: Math.max(
            1,
            Math.min(budget.multipv, new Chess(game.fen).moves().length),
          ),
          resolve,
          reject,
          signal,
          detach: () => {},
          lines: new Map(),
        };
        const abort = () => {
          if (this.active?.id === job.id) {
            job.cancelled = abortError();
            this.stop();
          } else {
            this.queue = this.queue.filter((item) => item.id !== job.id);
            job.detach();
            reject(abortError());
          }
        };
        signal?.addEventListener("abort", abort, { once: true });
        job.detach = () => signal?.removeEventListener("abort", abort);
        this.queue.push(job);
        this.sortQueue();
        if (
          budget.priority === "hint" &&
          this.active &&
          this.active.budget.priority !== "hint"
        ) {
          this.active.preempted = true;
          this.stop();
        }
        this.pump();
      });
    } catch (error) {
      return Promise.reject(error);
    }
  }
  private sortQueue() {
    this.queue.sort(
      (a, b) =>
        Number(b.budget.priority === "hint") -
          Number(a.budget.priority === "hint") || a.id - b.id,
    );
  }
  private arm(ms: number, callback: () => void) {
    clearTimeout(this.timer);
    this.timer = setTimeout(callback, ms);
  }
  private send(command: string) {
    try {
      if (!this.worker) return false;
      this.worker.postMessage(command);
      return true;
    } catch {
      this.crash(new Error("Engine worker crashed"));
      return false;
    }
  }
  private pump() {
    if (this.disposed || this.active || !this.queue.length) return;
    if (!this.worker) {
      try {
        const worker = this.factory();
        this.worker = worker;
        worker.onmessage = (event) => {
          if (this.worker !== worker) return;
          for (const line of String(event.data).split(/\r?\n/)) {
            if (this.worker !== worker) break;
            this.receive(line.trim());
          }
        };
        worker.onerror = () => {
          if (this.worker === worker)
            this.crash(new Error("Engine worker crashed"));
        };
        this.phase = "uci";
        this.arm(this.options.timeoutMs ?? 15000, () =>
          this.crash(new Error("Engine startup timed out")),
        );
        this.send("uci");
      } catch {
        this.crash(new Error("Engine worker failed to load"));
      }
      return;
    }
    if (this.phase !== "idle") return;
    this.active = this.queue.shift()!;
    this.active.lines.clear();
    this.phase = "sync";
    this.arm(this.options.timeoutMs ?? 15000, () =>
      this.crash(new Error("Engine readiness timed out")),
    );
    this.send("isready");
  }
  private receive(text: string) {
    if (this.phase === "uci" && text === "uciok") {
      this.phase = "boot";
      if (!this.send("setoption name Hash value 32")) return;
      this.send("isready");
    } else if (this.phase === "boot" && text === "readyok") {
      clearTimeout(this.timer);
      this.phase = "idle";
      this.pump();
    } else if (this.phase === "sync" && text === "readyok" && this.active) {
      const job = this.active;
      if (job.cancelled || job.preempted) {
        clearTimeout(this.timer);
        this.active = undefined;
        this.phase = "idle";
        if (job.cancelled) {
          job.detach();
          job.reject(job.cancelled);
        } else {
          job.preempted = false;
          this.queue.push(job);
          this.sortQueue();
        }
        this.pump();
        return;
      }
      this.phase = "search";
      this.arm(
        job.budget.timeoutMs ??
          this.options.timeoutMs ??
          Math.max(
            15000,
            job.budget.depth !== undefined
              ? job.budget.depth * 1500
              : job.budget.movetime + 5000,
          ),
        () => {
          if (this.active?.id !== job.id) return;
          job.cancelled = new Error("Engine analysis timed out");
          this.stop();
        },
      );
      if (!this.send(`setoption name MultiPV value ${job.budget.multipv}`))
        return;
      if (
        !this.send(
          `position fen ${job.position.startFen}${job.position.moves.length ? ` moves ${job.position.moves.join(" ")}` : ""}`,
        )
      )
        return;
      this.send(
        job.budget.depth === undefined
          ? `go movetime ${job.budget.movetime}`
          : `go depth ${job.budget.depth}`,
      );
    } else if (
      this.active &&
      (this.phase === "search" || this.phase === "stop")
    ) {
      const job = this.active;
      if (text.startsWith("bestmove ")) {
        clearTimeout(this.timer);
        this.active = undefined;
        this.phase = "idle";
        if (job.cancelled) {
          job.detach();
          job.reject(job.cancelled);
        } else if (job.preempted) {
          job.preempted = false;
          this.queue.push(job);
          this.sortQueue();
        } else {
          job.detach();
          const snapshots = [...job.lines].sort(([a], [b]) => b - a);
          const completeSnapshot = snapshots.find(([, lines]) =>
            Array.from({ length: job.expectedLines }, (_, i) => i + 1).every(
              (i) => lines.has(i),
            ),
          );
          const selected = completeSnapshot ?? snapshots[0];
          const result: Analysis = {
            complete: !!completeSnapshot,
            lines: selected
              ? [...selected[1]]
                  .sort(([a], [b]) => a - b)
                  .map(([, line]) => line)
              : [],
          };
          if (result.complete && result.lines.length)
            this.cache.set(job.key, structuredClone(result));
          while (this.cache.size > Math.max(0, this.options.cacheSize ?? 128))
            this.cache.delete(this.cache.keys().next().value!);
          job.resolve(result);
        }
        this.pump();
      } else if (this.phase === "search") {
        const parsed = parseInfo(text, job.turn);
        if (
          parsed &&
          parsed.multipv >= 1 &&
          parsed.multipv <= job.expectedLines
        ) {
          const snapshot =
            job.lines.get(parsed.line.depth) ?? new Map<number, Line>();
          snapshot.set(parsed.multipv, parsed.line);
          job.lines.set(parsed.line.depth, snapshot);
        }
      }
    }
  }
  private stop() {
    if (this.phase === "stop") return;
    // No search exists during readiness. Drain readyok before scheduling again.
    if (this.phase === "sync") return;
    this.phase = "stop";
    this.arm(this.options.stopTimeoutMs ?? 2000, () =>
      this.crash(new Error("Engine did not stop")),
    );
    this.send("stop");
  }
  private crash(error: Error) {
    clearTimeout(this.timer);
    const worker = this.worker;
    this.worker = null;
    worker?.terminate();
    const failed = this.active;
    this.active = undefined;
    this.phase = "idle";
    if (failed?.preempted && !failed.cancelled) {
      failed.preempted = false;
      this.queue.push(failed);
      this.sortQueue();
    } else if (failed) {
      failed.detach();
      failed.reject(failed.cancelled ?? error);
    } else {
      // Failed startup belongs to the oldest waiting job; don't retry it forever.
      const first = this.queue.shift();
      first?.detach();
      first?.reject(error);
    }
    this.pump();
  }
  dispose() {
    this.disposed = true;
    clearTimeout(this.timer);
    this.worker?.terminate();
    this.worker = null;
    for (const job of [...this.queue, ...(this.active ? [this.active] : [])]) {
      job.detach();
      job.reject(abortError());
    }
    this.queue = [];
    this.active = undefined;
    this.cache.clear();
  }
}
