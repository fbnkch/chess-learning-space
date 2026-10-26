import { expect, it } from "vitest";
import { glicko2 } from "./rating";

it("matches Glickman's worked rating-period example (glicko.net/glicko/glicko2.pdf)", () => {
  const result = glicko2({ rating: 1500, rd: 200, volatility: 0.06 }, [
    { rating: 1400, rd: 30, score: 1 },
    { rating: 1550, rd: 100, score: 0 },
    { rating: 1700, rd: 300, score: 0 },
  ]);
  // The paper rounds intermediate values; allow two hundredths on the published result.
  expect(Math.abs(result.rating - 1464.06)).toBeLessThan(0.02);
  expect(Math.abs(result.rd - 151.52)).toBeLessThan(0.02);
  expect(result.volatility).toBeCloseTo(0.059996, 6);
});
