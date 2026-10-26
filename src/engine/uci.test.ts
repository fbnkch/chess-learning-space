import { expect, test } from "vitest";
import { parseInfo } from "./uci";

test("normalises Black scores, mate and MultiPV from UCI", () => {
  expect(
    parseInfo(
      "info depth 12 multipv 2 score cp 83 nodes 100 pv e7e5 g1f3",
      "black",
    ),
  ).toEqual({
    multipv: 2,
    line: { depth: 12, cp: -83, uci: ["e7e5", "g1f3"] },
  });
  expect(
    parseInfo("info depth 9 score mate -3 pv e7e5", "black")?.line.mate,
  ).toBe(3);
  expect(
    parseInfo("info depth 9 score mate 2 pv e2e4", "white")?.line.mate,
  ).toBe(2);
});
test("ignores bounds, diagnostics and malformed lines", () => {
  for (const text of [
    "info string score cp 3",
    "info depth 2 score cp 5 lowerbound pv e2e4",
    "info depth 2 score cp x pv e2e4",
    "bestmove e2e4",
  ])
    expect(parseInfo(text, "white")).toBeUndefined();
});

test("terminal mate score has an empty principal variation", () => {
  expect(parseInfo("info depth 0 score mate 0", "black")).toEqual({
    multipv: 1,
    line: { depth: 0, mate: 0, winner: 1, uci: [] },
  });
});

test("stalemate accepts only the terminal depth-zero pv-less cp score", () => {
  expect(parseInfo("info depth 0 score cp 0", "black")?.line).toEqual({
    depth: 0,
    cp: 0,
    uci: [],
  });
  expect(parseInfo("info depth 1 score cp 0", "white")).toBeUndefined();
});
test.each([
  ["white", -1],
  ["black", 1],
] as const)(
  "mate zero identifies the winner for %s to move",
  (turn, winner) => {
    expect(parseInfo("info depth 0 score mate 0", turn)?.line).toEqual({
      depth: 0,
      mate: 0,
      winner,
      uci: [],
    });
  },
);
test("ignores real Stockfish diagnostic output", () => {
  expect(
    parseInfo(
      "info string NNUE evaluation using nn-9067e33176e8.nnue enabled",
      "white",
    ),
  ).toBeUndefined();
});
