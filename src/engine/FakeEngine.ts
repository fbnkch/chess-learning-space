import type { Analysis, Budget, Engine, Position, UciWorker } from "./types";
// Captured in Chromium, stockfish@19.0.1, startpos, depth 12, MultiPV 2 (2026-10-25).
export const RECORDED_UCI = [
  "info depth 12 seldepth 17 multipv 1 score cp 34 nodes 15282 nps 611280 hashfull 4 time 25 pv e2e4 e7e5 g1f3 b8c6 b1c3 g8f6 d2d4 e5d4",
  "info depth 12 seldepth 13 multipv 2 score cp 21 nodes 15282 nps 611280 hashfull 4 time 25 pv d2d4 d7d5 c2c4 e7e6 e2e3 g8f6 b1c3 c7c5 c4d5 e6d5 d4c5 f8c5",
  "bestmove e2e4 ponder e7e5",
];
/** Controllable transport: tests decide exactly when each old search drains. */
export class FakeWorker implements UciWorker {
  onmessage: UciWorker["onmessage"] = null;
  onerror: UciWorker["onerror"] = null;
  commands: string[] = [];
  terminated = false;
  private booted = false;
  postMessage(command: string) {
    this.commands.push(command);
    if (command === "isready" && this.booted) this.emit("readyok");
  }
  emit(data: string) {
    this.onmessage?.({ data });
  }
  ready() {
    this.emit("uciok");
    this.booted = true;
    this.emit("readyok");
  }
  complete(lines = RECORDED_UCI) {
    lines.forEach((line) => this.emit(line));
  }
  terminate() {
    this.terminated = true;
  }
}
/** Recorded Engine port for Coach/Explainer tests, with no WASM dependency. */
export class FakeEngine implements Engine {
  constructor(
    private readonly output: Analysis = {
      complete: true,
      lines: [
        { uci: ["e2e4", "e7e5", "g1f3"], cp: 34, depth: 12 },
        { uci: ["d2d4", "d7d5", "c2c4"], cp: 21, depth: 12 },
      ],
    },
  ) {}
  analyse(
    _position: Position,
    _budget: Budget,
    signal?: AbortSignal,
  ): Promise<Analysis> {
    if (signal?.aborted)
      return Promise.reject(
        new DOMException("Analysis cancelled", "AbortError"),
      );
    return Promise.resolve(structuredClone(this.output));
  }
}
