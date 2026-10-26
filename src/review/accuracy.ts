import type { Side } from "../repertoire/types";

// Algorithm port: Lichess lila authors, AGPL-3.0-or-later.
// See ATTRIBUTION.md and docs/research/08-game-review-accuracy.md.

const clamp = (n: number, low: number, high: number) =>
  Math.max(low, Math.min(high, n));
/** Port of lila AccuracyPercent.fromWinPercents, including uncertainty bonus. */
export function moveAccuracy(before: number, after: number): number {
  return after >= before
    ? 100
    : clamp(
        103.1668100711649 * Math.exp(-0.04354415386753951 * (before - after)) -
          3.166924740191411 +
          1,
        0,
        100,
      );
}
export interface WeightedAccuracy {
  ply: number;
  side: Side;
  accuracy: number;
  weight: number;
}
/** White win percentages include the initial position. No Book filtering here. */
export function weightedAccuracies(
  wins: readonly number[],
  start: Side,
): WeightedAccuracy[] {
  const size = clamp(Math.floor((wins.length - 1) / 10), 2, 8);
  return wins.slice(1).map((next, i) => {
    // Scala: fill(windowSize - 2)(take(windowSize)) ::: sliding(windowSize).
    const offset = Math.max(0, i - (size - 2));
    const window = wins.slice(offset, offset + size);
    const mean = window.reduce((a, b) => a + b, 0) / window.length;
    const deviation = Math.sqrt(
      window.reduce((a, b) => a + (b - mean) ** 2, 0) / window.length,
    );
    const side = i % 2 === 0 ? start : start === "white" ? "black" : "white";
    return {
      ply: i + 1,
      side,
      weight: clamp(deviation, 0.5, 12),
      accuracy:
        side === "white"
          ? moveAccuracy(wins[i], next)
          : moveAccuracy(100 - wins[i], 100 - next),
    };
  });
}
/** Book is excluded only after every move's accuracy and volatility weight exist. */
export function gameAccuracy(
  wins: readonly number[],
  start: Side,
  books: readonly boolean[],
): Record<Side, number | null> {
  const all = weightedAccuracies(wins, start);
  function aggregate(side: Side) {
    const moves = all.filter((m, i) => m.side === side && !books[i]);
    if (moves.length < 4) return null;
    const weighted =
      moves.reduce((sum, m) => sum + m.accuracy * m.weight, 0) /
      moves.reduce((sum, m) => sum + m.weight, 0);
    const harmonic =
      moves.length /
      moves.reduce((sum, m) => sum + 1 / Math.max(1, m.accuracy), 0);
    return (weighted + harmonic) / 2;
  }
  return { white: aggregate("white"), black: aggregate("black") };
}
