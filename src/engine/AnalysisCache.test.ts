import { expect, it, vi } from "vitest";
import { AnalysisCache } from "./AnalysisCache";
import { ReviewCache } from "./ReviewCache";
import type { Engine } from "./types";
import { Game } from "../game/Game";

function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}
it("persists engine facts and invalidates on budget, MultiPV, engine version and draw-relevant history", async () => {
  const disk = storage();
  const analyse = vi.fn<Engine["analyse"]>().mockResolvedValue({
    complete: true,
    lines: [
      { cp: 20, depth: 12, uci: ["e2e4"] },
      { cp: 10, depth: 12, uci: ["d2d4"] },
      { cp: 5, depth: 12, uci: ["c2c4"] },
    ],
  });
  const engine = { analyse };
  const position = { startFen: new Game().fen, moves: [] };
  const budget = { depth: 12, multipv: 2 };
  await new AnalysisCache(engine, disk, "one").analyse(position, budget);
  await new AnalysisCache(engine, disk, "one").analyse(position, budget);
  expect(analyse).toHaveBeenCalledTimes(1);
  await new AnalysisCache(engine, disk, "two").analyse(position, budget);
  await new AnalysisCache(engine, disk, "two").analyse(position, {
    depth: 13,
    multipv: 2,
  });
  await new AnalysisCache(engine, disk, "two").analyse(position, {
    depth: 12,
    multipv: 3,
  });
  const repeated = { ...position, moves: ["g1f3", "g8f6", "f3g1", "f6g8"] };
  await new AnalysisCache(engine, disk, "two").analyse(repeated, budget);
  expect(analyse).toHaveBeenCalledTimes(5);
});
it("does not cache cancelled or incomplete results and tolerates corrupt/full storage", async () => {
  const disk = {
    getItem: () => "corrupt",
    setItem: () => {
      throw new Error("QuotaExceededError");
    },
  };
  const analyse = vi
    .fn<Engine["analyse"]>()
    .mockResolvedValue({ complete: false, lines: [] });
  const cache = new AnalysisCache({ analyse }, disk);
  const position = { startFen: new Game().fen, moves: [] };
  await cache.analyse(position, { depth: 12, multipv: 2 });
  await cache.analyse(position, { depth: 12, multipv: 2 });
  expect(analyse).toHaveBeenCalledTimes(2);
  const controller = new AbortController();
  controller.abort();
  await expect(
    cache.analyse(position, { depth: 12, multipv: 2 }, controller.signal),
  ).rejects.toThrow();
  expect(analyse).toHaveBeenCalledTimes(2);
  analyse.mockResolvedValue({
    complete: true,
    lines: [{ cp: 0, depth: 12, uci: [] }],
  });
  await expect(
    cache.analyse(position, { depth: 12, multipv: 2 }),
  ).resolves.toHaveProperty("complete", true);
});
it("persists derived results under versioned keys and discards invalid cached results", () => {
  const disk = storage();
  const cache = new ReviewCache(disk);
  const result = {
    coachVersion: "one",
    moves: [],
    evaluations: [{ cp: 0, depth: 0, uci: [] }],
    accuracy: { white: null, black: null },
  };
  cache.set("engine/budget/coach-one/content/game", result);
  expect(
    new ReviewCache(disk).get("engine/budget/coach-one/content/game"),
  ).toEqual(result);
  expect(
    new ReviewCache(disk).get("engine/budget/coach-two/content/game"),
  ).toBeUndefined();
  expect(
    new ReviewCache({ getItem: () => '["broken"]', setItem: () => {} }).get(
      "anything",
    ),
  ).toBeUndefined();
});
