import { afterEach, expect, test, vi } from "vitest";
import { Game } from "../game/Game";
import { StockfishEngine } from "./Engine";
import { FakeWorker } from "./FakeEngine";
const position = { startFen: new Game().fen, moves: [] };
const budget = { depth: 12, multipv: 2 };
afterEach(() => vi.useRealTimers());

test("serialises concurrent requests and keeps multipv lines", async () => {
  const worker = new FakeWorker();
  const engine = new StockfishEngine(() => worker);
  const a = engine.analyse(position, budget);
  const b = engine.analyse(position, { depth: 13, multipv: 2 });
  worker.ready();
  expect(worker.commands.filter((x) => x.startsWith("go"))).toHaveLength(1);
  worker.complete();
  expect((await a).lines).toHaveLength(2);
  expect(worker.commands.filter((x) => x.startsWith("go"))).toHaveLength(2);
  worker.complete();
  await b;
  engine.dispose();
});
test("abort drains bestmove before starting next request; late old-worker messages are ignored", async () => {
  const worker = new FakeWorker();
  const engine = new StockfishEngine(() => worker);
  const controller = new AbortController();
  const a = engine.analyse(position, budget, controller.signal);
  const rejected = expect(a).rejects.toMatchObject({ name: "AbortError" });
  worker.ready();
  controller.abort();
  const b = engine.analyse(position, { depth: 13, multipv: 2 });
  expect(worker.commands.at(-1)).toBe("stop");
  worker.emit("info depth 99 score cp 999 pv a2a3");
  expect(worker.commands.filter((x) => x.startsWith("go"))).toHaveLength(1);
  worker.emit("bestmove a2a3");
  worker.complete();
  expect((await b).lines[0].cp).toBe(34);
  await rejected;
  engine.dispose();
});
test("hint pre-empts background, which resumes after hint completes", async () => {
  const worker = new FakeWorker();
  const engine = new StockfishEngine(() => worker);
  const background = engine.analyse(position, budget);
  worker.ready();
  const hint = engine.analyse(position, {
    depth: 8,
    multipv: 1,
    priority: "hint",
  });
  expect(worker.commands.at(-1)).toBe("stop");
  worker.emit("bestmove e2e4");
  expect(worker.commands.at(-1)).toBe("go depth 8");
  worker.complete();
  await hint;
  expect(worker.commands.at(-1)).toBe("go depth 12");
  worker.complete();
  await background;
  engine.dispose();
});
test("restarts after crash and rejects the failed request", async () => {
  const workers: FakeWorker[] = [];
  const engine = new StockfishEngine(() => {
    const worker = new FakeWorker();
    workers.push(worker);
    return worker;
  });
  const a = engine.analyse(position, budget);
  const rejected = expect(a).rejects.toThrow("crashed");
  workers[0].ready();
  const oldHandler = workers[0].onmessage;
  workers[0].onerror?.(new Error("crash"));
  await rejected;
  const b = engine.analyse(position, budget);
  workers[1].ready();
  oldHandler?.({ data: "info depth 99 score cp 999 pv a2a3\nbestmove a2a3" });
  workers[1].complete();
  expect((await b).lines[0].cp).toBe(34);
  engine.dispose();
});
test("cache isolates budgets, returns copies, and evicts least recently used", async () => {
  const worker = new FakeWorker();
  const engine = new StockfishEngine(() => worker, { cacheSize: 1 });
  const a = engine.analyse(position, budget);
  worker.ready();
  worker.complete();
  (await a).lines[0].uci[0] = "a2a3";
  expect((await engine.analyse(position, budget)).lines[0].uci[0]).toBe("e2e4");
  const b = engine.analyse(position, { ...budget, depth: 13 });
  worker.complete();
  await b;
  const c = engine.analyse(position, budget);
  worker.complete();
  await c;
  expect(worker.commands.filter((x) => x.startsWith("go"))).toHaveLength(3);
  engine.dispose();
});
test("timeouts stop search then replace an unresponsive worker", async () => {
  vi.useFakeTimers();
  const workers: FakeWorker[] = [];
  const engine = new StockfishEngine(
    () => {
      const w = new FakeWorker();
      workers.push(w);
      return w;
    },
    { timeoutMs: 50, stopTimeoutMs: 20 },
  );
  const a = engine.analyse(position, budget);
  const rejected = expect(a).rejects.toThrow("timed out");
  workers[0].ready();
  await vi.advanceTimersByTimeAsync(50);
  expect(workers[0].commands.at(-1)).toBe("stop");
  await vi.advanceTimersByTimeAsync(20);
  await rejected;
  const b = engine.analyse(position, budget);
  workers[1].ready();
  workers[1].complete();
  await b;
  engine.dispose();
});

test("cancels queued jobs without sending stop and skips already-aborted requests", async () => {
  const worker = new FakeWorker();
  const engine = new StockfishEngine(() => worker);
  const a = engine.analyse(position, budget);
  worker.ready();
  const controller = new AbortController();
  const b = engine.analyse(
    position,
    { ...budget, depth: 13 },
    controller.signal,
  );
  controller.abort();
  await expect(b).rejects.toMatchObject({ name: "AbortError" });
  await expect(
    engine.analyse(position, budget, controller.signal),
  ).rejects.toMatchObject({ name: "AbortError" });
  expect(worker.commands).not.toContain("stop");
  worker.complete();
  await a;
  engine.dispose();
});
test("abort during readiness does not start a search", async () => {
  const worker = new FakeWorker();
  const engine = new StockfishEngine(() => worker);
  const controller = new AbortController();
  const a = engine.analyse(position, budget, controller.signal);
  worker.emit("uciok");
  // Initial readyok starts the per-job readiness barrier; fake has not booted yet.
  worker.emit("readyok");
  controller.abort();
  worker.emit("readyok");
  await expect(a).rejects.toMatchObject({ name: "AbortError" });
  expect(worker.commands.filter((x) => x.startsWith("go"))).toHaveLength(0);
  engine.dispose();
});

test("hint during readiness defers background without rejecting it", async () => {
  const worker = new FakeWorker();
  const engine = new StockfishEngine(() => worker);
  const a = engine.analyse(position, budget);
  worker.emit("uciok");
  worker.emit("readyok");
  const b = engine.analyse(position, {
    depth: 8,
    multipv: 1,
    priority: "hint",
  });
  worker.ready();
  worker.complete();
  await b;
  worker.complete();
  await a;
  engine.dispose();
});

test("passes complete root history and normalises the resulting Black turn", async () => {
  const worker = new FakeWorker();
  const engine = new StockfishEngine(() => worker);
  const pending = engine.analyse({ ...position, moves: ["e2e4"] }, budget);
  worker.ready();
  expect(worker.commands).toContain(
    `position fen ${position.startFen} moves e2e4`,
  );
  worker.complete([
    "info depth 12 multipv 1 score cp 45 pv e7e5",
    "bestmove e7e5",
  ]);
  expect((await pending).lines).toEqual([
    { cp: -45, depth: 12, uci: ["e7e5"] },
  ]);
  engine.dispose();
});
test("rejects invalid budgets before loading WASM", async () => {
  const factory = vi.fn(() => new FakeWorker());
  const engine = new StockfishEngine(factory);
  await expect(
    engine.analyse(position, { depth: 0, multipv: 2 }),
  ).rejects.toThrow("budget");
  await expect(
    engine.analyse(position, { movetime: 500, multipv: 0 }),
  ).rejects.toThrow("budget");
  expect(factory).not.toHaveBeenCalled();
  engine.dispose();
});

test("transport failure cannot send the failed search into a replacement worker", async () => {
  class BrokenWorker extends FakeWorker {
    override postMessage(command: string) {
      if (command.startsWith("setoption name MultiPV"))
        throw new Error("transport failed");
      super.postMessage(command);
    }
  }
  const old = new BrokenWorker();
  const replacement = new FakeWorker();
  let count = 0;
  const engine = new StockfishEngine(() => (count++ === 0 ? old : replacement));
  const a = engine.analyse(position, budget);
  const rejected = expect(a).rejects.toThrow("crashed");
  const b = engine.analyse(position, { ...budget, depth: 13 });
  old.ready();
  await rejected;
  expect(replacement.commands).toEqual(["uci"]);
  replacement.ready();
  replacement.complete();
  await b;
  engine.dispose();
});

test("returns deepest complete snapshot despite out-of-order deeper PVs", async () => {
  const worker = new FakeWorker();
  const engine = new StockfishEngine(() => worker);
  const pending = engine.analyse(position, budget);
  worker.ready();
  worker.complete([
    "info depth 10 multipv 2 score cp 10 pv d2d4",
    "info depth 10 multipv 1 score cp 20 pv e2e4",
    "info depth 11 multipv 2 score cp 15 pv d2d4",
    "bestmove e2e4",
  ]);
  expect(await pending).toEqual({
    complete: true,
    lines: [
      { depth: 10, cp: 20, uci: ["e2e4"] },
      { depth: 10, cp: 10, uci: ["d2d4"] },
    ],
  });
  engine.dispose();
});
test("marks incomplete and empty searches and does not cache either", async () => {
  const worker = new FakeWorker();
  const engine = new StockfishEngine(() => worker);
  for (const lines of [
    ["info depth 12 multipv 2 score cp 10 pv d2d4", "bestmove e2e4"],
    ["bestmove e2e4"],
  ]) {
    const pending = engine.analyse(position, budget);
    worker.ready();
    worker.complete(lines);
    expect((await pending).complete).toBe(false);
  }
  const last = engine.analyse(position, budget);
  worker.complete();
  expect((await last).complete).toBe(true);
  expect(worker.commands.filter((x) => x.startsWith("go"))).toHaveLength(3);
  engine.dispose();
});
test("terminal bestmove none resolves a complete stalemate", async () => {
  const worker = new FakeWorker();
  const engine = new StockfishEngine(() => worker);
  const pending = engine.analyse(
    { startFen: "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1", moves: [] },
    budget,
  );
  worker.ready();
  worker.complete(["info depth 0 score cp 0", "bestmove (none)"]);
  expect(await pending).toEqual({
    complete: true,
    lines: [{ depth: 0, cp: 0, uci: [] }],
  });
  engine.dispose();
});

test("identical flights share a search with independent cancellation and result copies", async () => {
  const w = new FakeWorker();
  const e = new StockfishEngine(() => w);
  const c = new AbortController();
  const a = e.analyse(position, budget, c.signal);
  const b = e.analyse(position, budget);
  const d = e.analyse(position, budget);
  w.ready();
  c.abort();
  await expect(a).rejects.toMatchObject({ name: "AbortError" });
  expect(w.commands).not.toContain("stop");
  w.complete();
  const first = await b;
  const second = await d;
  first.lines[0].uci[0] = "a2a3";
  expect(second.lines[0].uci[0]).toBe("e2e4");
  expect(w.commands.filter((x) => x.startsWith("go"))).toHaveLength(1);
  e.dispose();
});

test.each(["crash", "grace expiry"])(
  "pre-empted background resumes after %s during stop",
  async (mode) => {
    vi.useFakeTimers();
    const workers: FakeWorker[] = [];
    const e = new StockfishEngine(
      () => {
        const w = new FakeWorker();
        workers.push(w);
        return w;
      },
      { stopTimeoutMs: 20 },
    );
    const a = e.analyse(position, budget);
    workers[0].ready();
    const b = e.analyse(position, { depth: 8, multipv: 1, priority: "hint" });
    if (mode === "crash") workers[0].onerror?.({});
    else await vi.advanceTimersByTimeAsync(20);
    expect(workers[0].terminated).toBe(true);
    workers[1].ready();
    expect(workers[1].commands.at(-1)).toBe("go depth 8");
    workers[1].complete();
    await b;
    expect(workers[1].commands.at(-1)).toBe("go depth 12");
    workers[1].complete();
    await a;
    e.dispose();
  },
);
test("second abort during stop neither restarts grace nor sends a second stop", async () => {
  vi.useFakeTimers();
  const w = new FakeWorker();
  const e = new StockfishEngine(() => w, { stopTimeoutMs: 20 });
  const c = new AbortController();
  const a = e.analyse(position, budget, c.signal);
  w.ready();
  const d = new AbortController();
  const b = e.analyse(
    position,
    { depth: 8, multipv: 1, priority: "hint" },
    d.signal,
  );
  await vi.advanceTimersByTimeAsync(10);
  c.abort();
  d.abort();
  await expect(a).rejects.toMatchObject({ name: "AbortError" });
  await expect(b).rejects.toMatchObject({ name: "AbortError" });
  expect(w.commands.filter((x) => x === "stop")).toHaveLength(1);
  await vi.advanceTimersByTimeAsync(10);
  expect(w.terminated).toBe(true);
  e.dispose();
});
test.each([
  { depth: 20, multipv: 2 },
  { movetime: 20000, multipv: 2 },
  { depth: 20, multipv: 2, timeoutMs: 100 },
])("budget-derived or caller-overridden search timeout: %j", async (b) => {
  vi.useFakeTimers();
  const w = new FakeWorker();
  const e = new StockfishEngine(() => w);
  const pending = e.analyse(position, b);
  const rejected = expect(pending).rejects.toThrow("timed out");
  w.ready();
  const ms = b.timeoutMs ?? (b.depth ? 30000 : 25000);
  await vi.advanceTimersByTimeAsync(ms - 1);
  expect(w.commands).not.toContain("stop");
  await vi.advanceTimersByTimeAsync(1);
  expect(w.commands.at(-1)).toBe("stop");
  w.emit("bestmove e2e4");
  await rejected;
  e.dispose();
});
test.each([
  ["r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1", "e1g1"],
  ["k7/4P3/8/8/8/8/8/7K w - - 0 1", "e7e8q"],
])("transmits special move history %s %s", async (startFen, move) => {
  const w = new FakeWorker();
  const e = new StockfishEngine(() => w);
  const p = e.analyse({ startFen, moves: [move] }, budget);
  w.ready();
  expect(w.commands).toContain(`position fen ${startFen} moves ${move}`);
  w.complete();
  await p;
  e.dispose();
});
test("fewer legal moves than requested still forms a complete snapshot", async () => {
  const w = new FakeWorker();
  const e = new StockfishEngine(() => w);
  const p = e.analyse(
    { startFen: "7k/8/5KQ1/8/8/8/8/8 b - - 0 1", moves: [] },
    budget,
  );
  w.ready();
  w.complete(["info depth 12 score cp -900 pv h8g8", "bestmove h8g8"]);
  expect((await p).complete).toBe(true);
  e.dispose();
});
