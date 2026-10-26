import { ulid } from "ulid";
import { dueCards, eligibleReview, type Review } from "../scheduler/Scheduler";
import { glicko2, initialRating, type PuzzleRating } from "./rating";
import type { PuzzleRow, Motif } from "./types";

export type PuzzleMode = "rated" | "due" | "woodpecker";
export interface WoodpeckerSet {
  id: string;
  puzzleIds: string[];
  motif: Motif;
  createdAt: number;
}
export function puzzleGrade(failed: boolean, hintsUsed: number) {
  return failed || hintsUsed > 0 ? ("again" as const) : ("good" as const);
}
export function puzzleReview(
  puzzle: PuzzleRow,
  sessionId: string,
  mode: PuzzleMode,
  failed: boolean,
  hintsUsed: number,
  durationMs: number,
  at: number,
  set?: { setId: string; cycle: number },
): Review {
  return {
    attemptId: ulid(),
    sessionId,
    cardId: `puzzle:${puzzle[0]}`,
    at,
    grade: puzzleGrade(failed, hintsUsed),
    context: mode === "woodpecker" ? "woodpecker" : "puzzle",
    hintsUsed,
    durationMs: Math.max(0, Math.round(durationMs)),
    schedulingEligible: mode !== "woodpecker",
    puzzle: {
      rating: puzzle[3],
      rd: puzzle[4],
      rated: mode === "rated",
      ...set,
    },
  };
}
/** Called inside the review transaction. First means first encounter in any mode. */
export function preparePuzzleReview(
  review: Review,
  log: readonly Review[],
  rating: PuzzleRating = initialRating,
) {
  const existing = log.find((r) => r.attemptId === review.attemptId);
  if (existing) return { review: existing, rating };
  const stored = eligibleReview(review, log);
  if (!stored.puzzle) return { review: stored, rating };
  const rated =
    stored.context === "puzzle" &&
    stored.puzzle.rated &&
    !log.some((r) => r.cardId === stored.cardId);
  stored.puzzle = { ...stored.puzzle, rated };
  return {
    review: stored,
    rating: rated
      ? {
          ...glicko2(rating, [
            {
              rating: stored.puzzle.rating,
              rd: stored.puzzle.rd,
              score: stored.grade === "good" ? 1 : 0,
            },
          ]),
          ratedAttempts: rating.ratedAttempts + 1,
        }
      : rating,
  };
}
export function puzzleCards(log: readonly Review[]) {
  return [
    ...new Set(
      log
        .filter((r) => r.context === "puzzle" && r.schedulingEligible)
        .map((r) => r.cardId),
    ),
  ].map((id) => ({ id, kind: "puzzle" as const }));
}
export function duePuzzles(log: readonly Review[], now: number) {
  return dueCards(puzzleCards(log), log, now);
}
export function woodpeckerProgress(set: WoodpeckerSet, log: readonly Review[]) {
  // Keep the earliest attempt per card/cycle without repeatedly scanning or sorting the log.
  const byCycle = new Map<number, Map<string, Review>>();
  for (const record of log) {
    if (record.context !== "woodpecker" || record.puzzle?.setId !== set.id)
      continue;
    const cycle = record.puzzle.cycle;
    if (cycle === undefined) continue;
    let cards = byCycle.get(cycle);
    if (!cards) byCycle.set(cycle, (cards = new Map()));
    const previous = cards.get(record.cardId);
    if (
      !previous ||
      record.at < previous.at ||
      (record.at === previous.at && record.attemptId < previous.attemptId)
    )
      cards.set(record.cardId, record);
  }
  const cycles: {
    cycle: number;
    durationMs: number;
    correct: number;
    completed: number;
  }[] = [];
  let cycle = 1,
    index: number;
  while (true) {
    const unique = byCycle.get(cycle) ?? new Map<string, Review>();
    index = set.puzzleIds.findIndex((id) => !unique.has(`puzzle:${id}`));
    if (index !== -1) break;
    cycles.push({
      cycle,
      completed: unique.size,
      correct: [...unique.values()].filter((r) => r.grade === "good").length,
      durationMs: [...unique.values()].reduce(
        (sum, r) => sum + r.durationMs,
        0,
      ),
    });
    cycle++;
  }
  return { cycle, index, cycles };
}
