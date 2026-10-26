import { expect, it } from "vitest";
import { Game } from "../game/Game";
import { Hint } from "./hint";
import type { Engine } from "../engine/types";

it("reveals piece then move from authored data without calling the engine", async () => {
  const hint = new Hint(new Game().fen, { solution: ["g1f3"] });
  expect(await hint.next()).toBe("Look at the piece on g1.");
  expect(hint.step).toBe(1);
  expect(await hint.next()).toBe("Play Nf3 (g1 → f3).");
  await hint.next();
  expect(hint.step).toBe(2);
});

it("uses a short priority search on demand and rejects stale results after reset", async () => {
  let resolve!: (value: Awaited<ReturnType<Engine["analyse"]>>) => void;
  let signal: AbortSignal | undefined;
  const calls: unknown[] = [];
  const engine: Engine = {
    analyse: (position, budget, abort) => {
      calls.push([position, budget]);
      signal = abort;
      return new Promise((r) => {
        resolve = r;
      });
    },
  };
  const hint = new Hint(new Game().fen, { engine });
  expect(calls).toEqual([]);
  const pending = hint.next();
  expect(calls).toEqual([
    [
      { startFen: new Game().fen, moves: [] },
      { movetime: 300, multipv: 1, priority: "hint" },
    ],
  ]);
  hint.reset();
  expect(signal?.aborted).toBe(true);
  resolve({ complete: true, lines: [{ uci: ["e2e4"], cp: 30, depth: 8 }] });
  await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  expect(hint.step).toBe(0);
});

it("coalesces rapid clicks, reuses its solution, and can retry a failed search", async () => {
  let calls = 0;
  const engine: Engine = {
    analyse: async () => {
      calls++;
      if (calls === 1) throw new Error("Worker failed");
      return { complete: true, lines: [{ uci: ["g1f3"], cp: 20, depth: 8 }] };
    },
  };
  const hint = new Hint(new Game().fen, { engine });
  await expect(hint.next()).rejects.toThrow("Worker failed");
  expect(hint.step).toBe(0);
  expect(await Promise.all([hint.next(), hint.next()])).toEqual([
    "Look at the piece on g1.",
    "Look at the piece on g1.",
  ]);
  expect(hint.step).toBe(1);
  expect(await hint.next()).toContain("Play Nf3");
  expect(calls).toBe(2);
});

it("names only a proven Explainer motif before revealing the engine move", async () => {
  const hint = new Hint("6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1", {
    engine: {
      analyse: async () => ({
        complete: true,
        lines: [{ uci: ["a1a8"], mate: 1, winner: 1, depth: 8 }],
      }),
    },
  });
  expect(await hint.next()).toMatch(/^Look for a mate\. Golden rule:/);
  expect(await hint.next()).toBe("Play Ra8# (a1 → a8).");
});
