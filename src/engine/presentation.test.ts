import { expect, test } from "vitest";
import { score, san, whiteAdvantage } from "./presentation";
test("mate formatting uses a leading minus and explicit winner at mate zero", () => {
  expect(score({ mate: -3, winner: -1, depth: 4, uci: [] })).toBe("-M3");
  expect(score({ mate: 3, winner: 1, depth: 4, uci: [] })).toBe("M3");
  for (const winner of [-1, 1] as const) {
    const line = { mate: 0, winner, depth: 0, uci: [] };
    expect(whiteAdvantage(line)).toBe(winner === 1);
    expect(score(line)).toBe(winner === 1 ? "M0" : "-M0");
  }
});
test("PV numbers follow the root FEN and side to move", () => {
  expect(
    san("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", [
      "e2e4",
      "e7e5",
      "g1f3",
    ]),
  ).toBe("1. e4 e5 2. Nf3");
  expect(
    san("rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 12", [
      "g8f6",
      "b1c3",
    ]),
  ).toBe("12... Nf6 13. Nc3");
});
