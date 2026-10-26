import { expect, it } from "vitest";
import {
  puzzleGrade,
  puzzleReview,
  preparePuzzleReview,
  duePuzzles,
  woodpeckerProgress,
} from "./training";
import { initialRating, ratingHistory } from "./rating";
import type { PuzzleRow } from "./types";
const puzzle: PuzzleRow = ["test1", "", "", 1200, 80, 90, 1000, "fork", "", ""];
const at = new Date(2026, 9, 25, 12).getTime();
it("grades a wrong move or any hint again, and only a clean solve good", () => {
  expect(puzzleGrade(true, 0)).toBe("again");
  expect(puzzleGrade(false, 1)).toBe("again");
  expect(puzzleGrade(false, 0)).toBe("good");
});
it("rates just the first encounter, and queues failed puzzles at tomorrow's 04:00 boundary", () => {
  const first = preparePuzzleReview(
    puzzleReview(puzzle, "a", "rated", true, 0, 100, at),
    [],
  );
  expect(first.rating.rating).toBeLessThan(1000);
  expect(first.review.puzzle?.rated).toBe(true);
  expect(duePuzzles([first.review], at)).toHaveLength(0);
  const tomorrow = new Date(2026, 9, 26, 4).getTime();
  expect(duePuzzles([first.review], tomorrow)[0].id).toBe("puzzle:test1");
  const repeat = preparePuzzleReview(
    puzzleReview(puzzle, "b", "rated", false, 0, 100, tomorrow),
    [first.review],
    first.rating,
  );
  expect(repeat.rating).toEqual(first.rating);
  expect(repeat.review.puzzle?.rated).toBe(false);
  expect(duePuzzles([first.review, repeat.review], tomorrow)).toHaveLength(0);
});
it("a first rated hint counts as a loss and repeats cannot change rating", () => {
  const first = preparePuzzleReview(
    puzzleReview(puzzle, "a", "rated", false, 2, 100, at),
    [],
  );
  expect(first.rating.rating).toBeLessThan(1000);
  expect(first.rating.ratedAttempts).toBe(1);
  expect(first.review.puzzle?.rated).toBe(true);
  expect(first.review.grade).toBe("again");
  const repeat = preparePuzzleReview(
    puzzleReview(puzzle, "b", "rated", false, 0, 100, at),
    [first.review],
    first.rating,
  );
  expect(repeat.rating).toEqual(first.rating);
});
it("history trusts stored eligibility when an unrated tab has an earlier timestamp", () => {
  const first = preparePuzzleReview(
    puzzleReview(puzzle, "a", "rated", false, 0, 100, at),
    [],
  );
  const repeat = preparePuzzleReview(
    puzzleReview(puzzle, "b", "rated", true, 0, 100, at - 1000),
    [first.review],
    first.rating,
  );
  expect(ratingHistory([first.review, repeat.review])).toHaveLength(1);
  expect(ratingHistory([first.review, repeat.review])[0].rating).toBe(
    first.rating.rating,
  );
});
it("Woodpecker records cycles and accuracy without rating or scheduling", () => {
  const set = {
    id: "set1",
    puzzleIds: [puzzle[0]],
    motif: "fork" as const,
    createdAt: at,
  };
  const first = preparePuzzleReview(
    puzzleReview(puzzle, "a", "woodpecker", true, 0, 1200, at, {
      setId: set.id,
      cycle: 1,
    }),
    [],
  );
  expect(first.review.context).toBe("woodpecker");
  expect(first.review.schedulingEligible).toBe(false);
  expect(first.rating).toEqual(initialRating);
  expect(duePuzzles([first.review], at + 86400000)).toEqual([]);
  expect(woodpeckerProgress(set, [first.review])).toEqual({
    cycle: 2,
    index: 0,
    cycles: [{ cycle: 1, durationMs: 1200, completed: 1, correct: 0 }],
  });
});

it("derives 200,000 Woodpecker cycles with a linear number of log reads", () => {
  const set = { id: "large", puzzleIds: ["test1"], motif: "fork" as const, createdAt: at };
  const base = puzzleReview(puzzle, "session", "woodpecker", false, 0, 10, at);
  let reads = 0;
  const log = Array.from({ length: 200_000 }, (_, i) => ({
    ...base,
    attemptId: String(i),
    puzzle: {
      rating: 1200, rd: 80, rated: false, setId: set.id,
      get cycle() {
        if (++reads > 1_000_000) throw new Error("Superlinear cycle reads");
        return i + 1;
      },
    },
  }));
  const result = woodpeckerProgress(set, log);
  expect(result.cycle).toBe(200_001);
  expect(result.cycles).toHaveLength(200_000);
  expect(result.cycles.at(-1)).toEqual({ cycle: 200_000, completed: 1, correct: 1, durationMs: 10 });
  expect(reads).toBeLessThanOrEqual(1_000_000);
});
