import { ordered, type Review } from "../scheduler/Scheduler";

export interface Rating {
  rating: number;
  rd: number;
  volatility: number;
}
export interface PuzzleRating extends Rating {
  ratedAttempts: number;
}
export const initialRating: PuzzleRating = {
  rating: 1000,
  rd: 350,
  volatility: 0.06,
  ratedAttempts: 0,
};
/** Glicko-2, one period per call. Glickman, Example of the Glicko-2 system. */
export function glicko2(
  player: Rating,
  opponents: readonly { rating: number; rd: number; score: number }[],
  tau = 0.5,
): Rating {
  const scale = 173.7178;
  const mu = (player.rating - 1500) / scale,
    phi = player.rd / scale;
  if (!opponents.length)
    return {
      ...player,
      rd: scale * Math.sqrt(phi * phi + player.volatility ** 2),
    };
  let information = 0,
    improvement = 0;
  for (const opponent of opponents) {
    const g =
      1 / Math.sqrt(1 + (3 * (opponent.rd / scale) ** 2) / Math.PI ** 2);
    const expected =
      1 / (1 + Math.exp(-g * (mu - (opponent.rating - 1500) / scale)));
    information += g * g * expected * (1 - expected);
    improvement += g * (opponent.score - expected);
  }
  const v = 1 / information,
    delta = v * improvement,
    a = Math.log(player.volatility ** 2);
  const f = (x: number) => {
    const ex = Math.exp(x),
      d = phi * phi + v + ex;
    return (
      (ex * (delta * delta - phi * phi - v - ex)) / (2 * d * d) -
      (x - a) / (tau * tau)
    );
  };
  let A = a,
    B: number;
  if (delta * delta > phi * phi + v)
    B = Math.log(delta * delta - phi * phi - v);
  else {
    let k = 1;
    while (f(a - k * tau) < 0) k++;
    B = a - k * tau;
  }
  let fa = f(A),
    fb = f(B);
  while (Math.abs(B - A) > 0.000001) {
    const C = A + ((A - B) * fa) / (fb - fa),
      fc = f(C);
    if (fc * fb <= 0) {
      A = B;
      fa = fb;
    } else fa /= 2;
    B = C;
    fb = fc;
  }
  const volatility = Math.exp(A / 2);
  const nextPhi =
    1 / Math.sqrt(1 / (phi * phi + volatility * volatility) + 1 / v);
  return {
    rating: 1500 + scale * (mu + nextPhi * nextPhi * improvement),
    rd: scale * nextPhi,
    volatility,
  };
}

/** History is derived from review facts; no duplicate time series is persisted. */
export function ratingHistory(
  log: readonly Review[],
  baseline: PuzzleRating = initialRating,
) {
  let rating = baseline;
  const seen = new Set<string>();
  return ordered(log).flatMap((review) => {
    // The transaction's stored flag is authoritative, including across tab clocks.
    if (!review.puzzle?.rated || seen.has(review.cardId)) return [];
    seen.add(review.cardId);
    rating = {
      ...glicko2(rating, [
        {
          rating: review.puzzle.rating,
          rd: review.puzzle.rd,
          score: review.grade === "good" ? 1 : 0,
        },
      ]),
      ratedAttempts: rating.ratedAttempts + 1,
    };
    return [{ at: review.at, attemptId: review.attemptId, ...rating }];
  });
}
