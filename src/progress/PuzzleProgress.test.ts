import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { openProgress, migrateProgress, schemaVersion } from "./Progress";
import { Backup, validateBackup } from "./Backup";
import { exportData } from "./stores";
import { puzzleReview } from "../puzzles/training";
import { initialRating, ratingHistory } from "../puzzles/rating";
import type { PuzzleRow } from "../puzzles/types";
const at = new Date(2026, 9, 25, 12).getTime();
const puzzle: PuzzleRow = ["abc12", "", "", 1200, 80, 90, 1000, "fork", "", ""];
async function fixture() {
  const store = await openProgress({ name: `puzzle-${crypto.randomUUID()}` });
  const backup = new Backup(store, {
    appVersion: "test",
    contentVersions: {},
    clock: () => at,
    download: async () => {},
  });
  return { store, backup };
}
it("serializes first-attempt rating across tabs, survives reopen and derives its history", async () => {
  const name = `puzzle-${crypto.randomUUID()}`;
  const a = await openProgress({ name }),
    b = await openProgress({ name });
  await Promise.all([
    a.record(puzzleReview(puzzle, "a", "rated", false, 0, 100, at)),
    b.record(puzzleReview(puzzle, "b", "rated", false, 0, 100, at + 1)),
  ]);
  const rating = await a.puzzleRating();
  expect(rating.ratedAttempts).toBe(1);
  expect(rating.rating).toBeGreaterThan(1000);
  expect((await a.reviews()).filter((r) => r.puzzle?.rated)).toHaveLength(1);
  expect(ratingHistory(await a.reviews())[0].rating).toBe(rating.rating);
  a.close();
  b.close();
  const reopened = await openProgress({ name });
  expect(await reopened.puzzleRating()).toEqual(rating);
  reopened.close();
});
it("v6 migrates through the shared path and creates the new stores on a live upgrade", async () => {
  expect(
    migrateProgress({ schemaVersion: 6, data: { reviewLog: [], metadata: [] } })
      .data,
  ).toMatchObject({ puzzleRating: [], woodpeckerSets: [] });
  const name = `puzzle-${crypto.randomUUID()}`;
  const old = await openProgress({ name, version: 6 });
  const review = puzzleReview(puzzle, "a", "rated", true, 0, 100, at);
  delete review.puzzle;
  await old.record(review);
  old.close();
  const current = await openProgress({ name });
  expect(await current.reviews()).toHaveLength(1);
  expect(await current.puzzleRating()).toEqual(initialRating);
  expect(await current.woodpeckerSets()).toEqual([]);
  current.close();
});
it("backs up fixed sets and ratings, merges by rated-attempt count and Undo preserves later work", async () => {
  const a = await fixture(),
    b = await fixture();
  try {
    await a.store.record(puzzleReview(puzzle, "a", "rated", false, 0, 100, at));
    const set = {
      id: "set1",
      motif: "fork" as const,
      puzzleIds: [puzzle[0]],
      createdAt: at,
    };
    await a.store.saveWoodpeckerSet(set);
    const data = await a.store.snapshot();
    const json = JSON.stringify({
      format: "chess-learning-space",
      schemaVersion,
      appVersion: "test",
      contentVersions: {},
      exportedAt: new Date(at).toISOString(),
      data: exportData(data),
    });
    const checked = validateBackup(json, at);
    expect(checked.puzzleRating).toEqual(data.puzzleRating);
    await b.backup.import(json, "merge");
    expect(await b.store.puzzleRating()).toEqual(await a.store.puzzleRating());
    expect(await b.store.woodpeckerSets()).toEqual([set]);
    await b.store.record(
      puzzleReview(
        { ...puzzle, 0: "other" } as PuzzleRow,
        "b",
        "rated",
        false,
        0,
        200,
        at + 1,
      ),
    );
    const after = await b.store.puzzleRating();
    await b.store.restore(data, "merge", at);
    expect(await b.store.puzzleRating()).toEqual(after);
    await b.store.undo();
    expect(await b.store.puzzleRating()).toEqual(after);
    await b.backup.import(json, "replace");
    await b.store.record(
      puzzleReview(
        { ...puzzle, 0: "third" } as PuzzleRow,
        "c",
        "rated",
        true,
        0,
        200,
        at + 2,
      ),
    );
    await b.store.saveWoodpeckerSet({ ...set, id: "laterSet" });
    await b.store.undo();
    expect((await b.store.puzzleRating()).ratedAttempts).toBe(3);
    expect(await b.store.reviews()).toHaveLength(3);
    expect((await b.store.woodpeckerSets()).map((s) => s.id)).toContain(
      "laterSet",
    );
    const before = await b.store.snapshot();
    const invalid = JSON.parse(json);
    invalid.data.puzzleRating[0].rd = -1;
    await expect(
      b.backup.import(JSON.stringify(invalid), "replace"),
    ).rejects.toThrow();
    expect(await b.store.snapshot()).toEqual(before);
  } finally {
    a.store.close();
    b.store.close();
  }
});
it("Undo keeps an imported fixed set when the learner has trained it since the import", async () => {
  const { store } = await fixture();
  try {
    const data = await store.snapshot();
    const set = {
      id: "importedSet",
      motif: "fork" as const,
      puzzleIds: [puzzle[0]],
      createdAt: at,
    };
    await store.restore({ ...data, woodpeckerSets: [set] }, "replace", at);
    await store.record(
      puzzleReview(puzzle, "cycle", "woodpecker", false, 0, 1234, at + 1, {
        setId: set.id,
        cycle: 1,
      }),
    );
    await store.undo();
    expect(await store.woodpeckerSets()).toEqual([set]);
    expect(await store.reviews()).toHaveLength(1);
    expect(await store.puzzleRating()).toEqual(initialRating);
  } finally {
    store.close();
  }
});

it("persists a hinted rating loss and roundtrips it through backup validation", async () => {
  const { store } = await fixture();
  try {
    await store.record(
      puzzleReview(puzzle, "hint", "rated", false, 1, 100, at),
    );
    const data = await store.snapshot();
    expect(data.puzzleRating[0].rating).toBeLessThan(1000);
    expect(data.puzzleRating[0].ratedAttempts).toBe(1);
    const json = JSON.stringify({
      format: "chess-learning-space",
      schemaVersion,
      appVersion: "test",
      contentVersions: {},
      exportedAt: new Date(at).toISOString(),
      data: exportData(data),
    });
    expect(validateBackup(json, at).reviewLog[0]).toMatchObject({
      grade: "again",
      hintsUsed: 1,
      puzzle: { rated: true },
    });
    const invalid = JSON.parse(json);
    invalid.data.reviewLog[0].grade = "good";
    expect(() => validateBackup(JSON.stringify(invalid), at)).toThrow();
  } finally {
    store.close();
  }
});

it("Undo keeps a later rated attempt even when its unrated retry has an earlier clock", async () => {
  const { store } = await fixture();
  try {
    const data = await store.snapshot();
    await store.restore(data, "replace", at);
    await store.record(
      puzzleReview(puzzle, "first", "rated", false, 0, 100, at + 10),
    );
    // A retry saved later, but with a clock that went backwards.
    await store.record(
      puzzleReview(puzzle, "retry", "rated", false, 0, 100, at + 5),
    );
    const rated = await store.puzzleRating();
    expect(rated.ratedAttempts).toBe(1);
    expect((await store.reviews()).filter((r) => r.puzzle?.rated)).toHaveLength(
      1,
    );
    await store.undo();
    expect(await store.reviews()).toHaveLength(2);
    expect(await store.puzzleRating()).toEqual(rated);
  } finally {
    store.close();
  }
});
