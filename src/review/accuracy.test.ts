import { expect, it } from "vitest";
import { gameAccuracy, moveAccuracy, weightedAccuracies } from "./accuracy";

it("returns n/a below four non-book moves per side", () => {
  expect(gameAccuracy([50, 50, 50, 50, 50, 50, 50], "white", [])).toEqual({
    white: null,
    black: null,
  });
});
it("includes the uncertainty bonus and clamps improving evaluations", () => {
  expect(moveAccuracy(50, 40)).toBeCloseTo(64.579828453721, 9);
  expect(moveAccuracy(40, 50)).toBe(100);
});
it("fixture 1: eight equal plies are perfect for both sides", () => {
  expect(gameAccuracy(Array(9).fill(50), "white", [])).toEqual({
    white: 100,
    black: 100,
  });
});
it("fixture 2: alternating ten-point losses give both sides the same accuracy", () => {
  const game = [50, 40, 50, 40, 50, 40, 50, 40, 50];
  const accuracy = gameAccuracy(game, "white", []);
  expect(accuracy.white).toBeCloseTo(64.579828453721, 9);
  expect(accuracy.black).toBeCloseTo(64.579828453721, 9);
  expect(gameAccuracy(game, "black", [])).toEqual({ white: 100, black: 100 });
});
it("floors window size at division boundaries and clamps weights", () => {
  const wins = Array(31).fill(50);
  wins[0] = 100;
  const values = weightedAccuracies(wins, "white");
  expect(values.slice(0, 3).map((m) => m.weight)).toEqual([12, 12, 0.5]);
  expect(weightedAccuracies(Array(20).fill(50), "white")[0].weight).toBe(0.5);
});
it("floors the harmonic denominator at accuracy 1 even for zero accuracy", () => {
  const result = gameAccuracy(
    [100, 0, 100, 0, 100, 0, 100, 0, 100],
    "white",
    [],
  );
  expect(result).toEqual({ white: 0.5, black: 0.5 });
});
it("fixture 3: forty mixed plies retain original edge windows when Book moves are excluded", () => {
  const pattern = [40, 60, 55, 65, 45, 55, 35, 60, 50, 50];
  const wins = [
    ...Array<number>(9).fill(50),
    ...pattern,
    ...pattern,
    ...pattern,
    40,
    60,
  ];
  const books = Array.from({ length: 40 }, (_, i) => i < 6);
  const result = gameAccuracy(wins, "white", books);
  expect(result.white).toBeCloseTo(56.912737967749, 9);
  expect(result.black).toBeCloseTo(56.314801714824, 9);
  const weights = weightedAccuracies(wins, "white");
  expect(weights[8].weight).toBeCloseTo(4.330127018922, 9);
  expect(weights[9].weight).toBeCloseTo(7.071067811865, 9);
  expect(gameAccuracy(wins, "white", books.slice(0, 39).fill(true))).toEqual({
    white: null,
    black: null,
  });
});
