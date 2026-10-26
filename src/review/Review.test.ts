import { expect, it } from "vitest";
import { Game } from "../game/Game";
import { Review } from "./Review";
import type { Engine, Position } from "../engine/types";

it("passes the complete history, resumes cancelled analysis and reclassifies cached positions", async () => {
  const game = Game.fromPgn("1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 1-0");
  const calls: Position[] = [];
  const controller = new AbortController();
  const engine: Engine = {
    analyse: async (position, budget) => {
      expect(budget).toEqual({ depth: 12, multipv: 2, priority: "background" });
      calls.push(position);
      const board = new Game(position.startFen);
      position.moves.forEach((m) => board.play(m));
      const moves = [...board.destinations()].flatMap(([from, tos]) =>
        tos.map((to) => from + to),
      );
      return {
        complete: true,
        lines: moves
          .slice(0, 2)
          .map((uci) => ({ uci: [uci], cp: 0, depth: 12 })),
      };
    },
  };
  const review = new Review(engine, () => false);
  await expect(
    review.analyse(game, controller.signal, (done) => {
      if (done === 3) controller.abort();
    }),
  ).rejects.toThrow();
  expect(calls).toHaveLength(3);
  const result = await review.analyse(game);
  expect(result.moves).toHaveLength(6);
  expect(result.coachVersion).toBe("adr-0004-v1");
  expect(calls.map((p) => p.moves)).toEqual(
    Array.from({ length: 7 }, (_, i) => game.moves.slice(0, i)),
  );
  await review.analyse(game);
  expect(calls).toHaveLength(7);
});
it("classifies Black moves using White-view scores and honours terminal mate", async () => {
  const game = Game.fromPgn("1. f3 e5 2. g4 Qh4# 0-1");
  const engine: Engine = {
    analyse: async (position) => ({
      complete: true,
      lines: [
        { cp: position.moves.length === 1 ? -900 : 0, depth: 12, uci: [] },
        { cp: position.moves.length === 1 ? -850 : 0, depth: 12, uci: [] },
      ],
    }),
  };
  const result = await new Review(engine, () => false).analyse(game);
  expect(result.moves[1].side).toBe("black");
  expect(result.moves[1].classification).toBe("Miss");
  expect(result.evaluations[4]).toEqual({
    uci: [],
    mate: 0,
    winner: -1,
    depth: 0,
  });
  expect(result.moves[3].classification).toBe("Best");
});
it("honours repetition using full history instead of an engine's winning score", async () => {
  const game = Game.fromPgn(
    "1. Nf3 Nf6 2. Ng1 Ng8 3. Nf3 Nf6 4. Ng1 Ng8 1/2-1/2",
  );
  const engine: Engine = {
    analyse: async () => ({
      complete: true,
      lines: [
        { cp: 900, depth: 12, uci: [] },
        { cp: 850, depth: 12, uci: [] },
      ],
    }),
  };
  const result = await new Review(engine, () => false).analyse(game);
  expect(result.evaluations[8].cp).toBe(0);
});
it("does not treat a missing MultiPV line as proof of an only good move", async () => {
  const engine: Engine = {
    analyse: async () => ({
      complete: true,
      lines: [{ cp: 0, depth: 12, uci: [] }],
    }),
  };
  await expect(
    new Review(engine, () => false).analyse(Game.fromPgn("1. e4 e5 1-0")),
  ).rejects.toThrow("Incomplete engine analysis");
});
it("Book detection stops at 16 plies even when a later position is known", async () => {
  const game = Game.fromPgn(
    "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 1-0",
  );
  const engine: Engine = {
    analyse: async () => ({
      complete: true,
      lines: [
        { cp: 0, depth: 12, uci: [] },
        { cp: 0, depth: 12, uci: [] },
      ],
    }),
  };
  const result = await new Review(engine, () => true).analyse(game);
  expect(
    result.moves.slice(0, 16).every((m) => m.classification === "Book"),
  ).toBe(true);
  expect(result.moves[16].classification).toBe("Best");
  expect(result.accuracy).toEqual({ white: null, black: null });
});
it("analyses a claimable repetition that the game played past", async () => {
  // Threefold occurs after 4...Ng8, but the game continues with 5. e4.
  const game = Game.fromPgn(
    "1. Nf3 Nf6 2. Ng1 Ng8 3. Nf3 Nf6 4. Ng1 Ng8 5. e4 e5 1-0",
  );
  const engine: Engine = {
    analyse: async () => ({
      complete: true,
      lines: [
        { cp: 900, depth: 12, uci: [] },
        { cp: 850, depth: 12, uci: [] },
      ],
    }),
  };
  const result = await new Review(engine, () => false).analyse(game);
  expect(result.evaluations[8].cp).toBe(900);
  expect(result.evaluations[10].cp).toBe(900);
});
