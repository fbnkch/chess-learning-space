import { expect, test } from "vitest";
import { Game } from "../game/Game";
import { analysisKey } from "./analysisKey";
const startFen = new Game().fen;
test("analysis identity retains counters and repetition history", () => {
  const moves = ["g1f3", "g8f6", "f3g1", "f6g8"];
  const replay = new Game();
  moves.forEach((move) => replay.play(move));
  expect(analysisKey({ startFen, moves })).not.toBe(
    analysisKey({ startFen: replay.fen, moves: [] }),
  );
  expect(analysisKey({ startFen, moves: [] })).not.toBe(
    analysisKey({ startFen: startFen.replace("0 1", "1 2"), moves: [] }),
  );
});
test("pawn moves and captures discard earlier reversible history", () => {
  const moves = ["g1f3", "g8f6", "f3g1", "f6g8", "e2e4"];
  const replay = new Game();
  moves.forEach((move) => replay.play(move));
  expect(analysisKey({ startFen, moves })).toBe(
    analysisKey({ startFen: replay.fen, moves: [] }),
  );
  const captured = ["e2e4", "d7d5", "e4d5"];
  const game = new Game();
  captured.forEach((move) => game.play(move));
  expect(analysisKey({ startFen, moves: captured })).toBe(
    analysisKey({ startFen: game.fen, moves: [] }),
  );
});
