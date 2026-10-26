import "fake-indexeddb/auto";
import { openDB } from "idb";
import { Scheduler, retiredCardIds } from "../scheduler/Scheduler";
import { forceCloseDatabase } from "fake-indexeddb";
import { expect, it, vi } from "vitest";
import { openProgress, migrateProgress, schemaVersion } from "./Progress";
import type { Review } from "../scheduler/Scheduler";
const card = {
  id: "rep:white:test",
  kind: "repertoire" as const,
  side: "white" as const,
  positionKey: "test",
  lineId: "main",
};
const review: Review = {
  attemptId: "01",
  sessionId: "s1",
  cardId: card.id,
  lineId: "main",
  at: new Date(2026, 9, 25, 12).getTime(),
  grade: "again",
  context: "repertoire",
  hintsUsed: 0,
  durationMs: 50,
  schedulingEligible: true,
};
it("migrates forward from every older schema and rejects newer schemas without changing input", () => {
  const initial = { schemaVersion: 0, data: {} };
  expect(migrateProgress(initial)).toEqual({
    schemaVersion,
    data: {
      reviewLog: [],
      metadata: [],
      settings: [],
      ruleState: [],
      scanLog: [],
      puzzleRating: [],
      woodpeckerSets: [],
      games: [],
      personalCards: [],
      replyWeights: [],
    },
  });
  expect(initial).toEqual({ schemaVersion: 0, data: {} });
  expect(() =>
    migrateProgress({ schemaVersion: schemaVersion + 1, data: {} }),
  ).toThrow();
});
it("reopens durable reviews, rebuilds SRS and preserves first-attempt eligibility across connections", async () => {
  const name = `test-${crypto.randomUUID()}`;
  const first = await openProgress({ name });
  await first.record(review);
  first.close();
  const second = await openProgress({ name });
  expect(await new Scheduler(() => [card], second).due(review.at)).toHaveLength(
    0,
  );
  await second.record({ ...review, attemptId: "02", grade: "good" });
  expect((await second.reviews()).map((r) => r.schedulingEligible)).toEqual([
    true,
    false,
  ]);
  await second.record(review);
  expect(await second.reviews()).toHaveLength(2);
  second.close();
  const changedContent = await openProgress({ name });
  expect(retiredCardIds([], await changedContent.reviews())).toEqual([card.id]);
  expect(await changedContent.reviews()).toHaveLength(2);
  changedContent.close();
});

it("serializes concurrent tabs so only one attempt per session schedules", async () => {
  const name = `test-${crypto.randomUUID()}`;
  const first = await openProgress({ name });
  const second = await openProgress({ name });
  await Promise.all([
    first.record(review),
    second.record({ ...review, attemptId: "02" }),
  ]);
  const log = await second.reviews();
  expect(log).toHaveLength(2);
  expect(log.filter((r) => r.schedulingEligible)).toHaveLength(1);
  first.close();
  second.close();
});
it("upgrades populated v2 data to the current version without losing reviews and creates settings and secrets", async () => {
  const name = `v3-${crypto.randomUUID()}`;
  const old = await openProgress({ name, version: 2 });
  await old.record(review);
  old.close();
  const current = await openProgress({ name });
  try {
    expect(await current.reviews()).toEqual([review]);
    expect(await current.settings()).toBeUndefined();
    const db = await openDB(name);
    try {
      expect([...db.objectStoreNames]).toEqual([
        "games",
        "metadata",
        "personalCards",
        "preImport",
        "puzzleRating",
        "replyWeights",
        "reviewLog",
        "ruleState",
        "scanLog",
        "secrets",
        "settings",
        "woodpeckerSets",
      ]);
      expect(await db.getAll("secrets")).toEqual([]);
    } finally {
      db.close();
    }
  } finally {
    current.close();
  }
});

it("migrates populated v1 stores through the shared fake v2 migration and adds the session index", async () => {
  const name = `migration-${crypto.randomUUID()}`;
  const old = await openDB(name, 1, {
    upgrade(db) {
      db.createObjectStore("reviewLog", { keyPath: "attemptId" });
      db.createObjectStore("metadata", { keyPath: "key" });
    },
  });
  await old.put("reviewLog", review);
  await old.put("metadata", { key: "legacy", value: 7 });
  old.close();
  const upgraded = await openProgress({
    name,
    version: 2,
    migrations: {
      1: (snapshot) => ({
        schemaVersion: 2,
        data: {
          ...snapshot.data,
          metadata: [
            ...snapshot.data.metadata!,
            { key: "migrated", value: "yes" },
          ],
        },
      }),
    },
  });
  expect(await upgraded.reviews()).toEqual([review]);
  expect(await upgraded.metadata("legacy")).toEqual({
    key: "legacy",
    value: 7,
  });
  expect(await upgraded.metadata("migrated")).toEqual({
    key: "migrated",
    value: "yes",
  });
  await upgraded.record({ ...review, attemptId: "02", at: review.at - 100 });
  expect((await upgraded.reviews()).map((r) => r.schedulingEligible)).toEqual([
    true,
    false,
  ]);
  upgraded.close();
});
it("never schedules practice and retains stored eligibility on an idempotent retry", async () => {
  const store = await openProgress({
    name: `eligibility-${crypto.randomUUID()}`,
  });
  expect(
    (await store.record({ ...review, schedulingEligible: false }))
      .schedulingEligible,
  ).toBe(true);
  expect(
    (
      await store.record({
        ...review,
        grade: "good",
        schedulingEligible: false,
      })
    ).grade,
  ).toBe("again");
  expect(
    (
      await store.record({
        ...review,
        attemptId: "practice",
        sessionId: "practice",
        context: "practice",
      })
    ).schedulingEligible,
  ).toBe(false);
  store.close();
});

it("saves before a persistence prompt resolves and reports its eventual result as metadata", async () => {
  let resolve!: (value: boolean) => void;
  const persist = vi.fn(
    () =>
      new Promise<boolean>((done) => {
        resolve = done;
      }),
  );
  vi.stubGlobal("navigator", { storage: { persist } });
  const store = await openProgress({ name: `persist-${crypto.randomUUID()}` });
  try {
    await store.record(review);
    expect(await store.reviews()).toEqual([review]);
    await vi.waitFor(() => expect(persist).toHaveBeenCalledOnce());
    resolve(true);
    await vi.waitFor(async () =>
      expect(await store.metadata("storage")).toEqual({
        key: "storage",
        value: "persistent",
      }),
    );
  } finally {
    store.close();
    vi.unstubAllGlobals();
  }
});
it("keeps first-attempt eligibility when the first transaction aborts and the same attempt is retried", async () => {
  const store = await openProgress({ name: `abort-${crypto.randomUUID()}` });
  const original = IDBObjectStore.prototype.add;
  const add = vi
    .spyOn(IDBObjectStore.prototype, "add")
    .mockImplementationOnce(function (this: IDBObjectStore, value, key) {
      this.transaction.abort();
      return original.call(this, value, key);
    });
  await expect(store.record(review)).rejects.toThrow();
  add.mockRestore();
  expect((await store.record(review)).schedulingEligible).toBe(true);
  expect(
    (await store.record({ ...review, schedulingEligible: false }))
      .schedulingEligible,
  ).toBe(true);
  expect(await store.reviews()).toHaveLength(1);
  store.close();
});
it("notifies when an older tab blocks upgrade", async () => {
  const name = `blocked-${crypto.randomUUID()}`;
  const old = await openDB(name, 1, {
    upgrade(db) {
      db.createObjectStore("reviewLog", { keyPath: "attemptId" });
      db.createObjectStore("metadata", { keyPath: "key" });
    },
  });
  const onBlocked = vi.fn(() => old.close());
  const store = await openProgress({ name, onBlocked });
  expect(onBlocked).toHaveBeenCalledOnce();
  store.close();
});
it("reopens after unexpected database termination", async () => {
  const name = `terminated-${crypto.randomUUID()}`;
  const store = await openProgress({ name });
  await store.record(review);
  // Capture the underlying connection through fake-indexeddb's open event for this test.
  const open = vi.spyOn(indexedDB, "open");
  const next = await openProgress({ name });
  const request = open.mock.results[0].value as IDBOpenDBRequest;
  // @ts-expect-error fake-indexeddb 6.2.6 declares the constructor instead of the documented instance.
  forceCloseDatabase(request.result);
  await vi.waitFor(async () => expect(await next.reviews()).toEqual([review]));
  open.mockRestore();
  next.close();
  store.close();
});

it("migrates v4 rule state forward and fills an empty store for older data", () => {
  const learned = {
    ruleId: "castle-early",
    learned: true,
    learnedAt: 42,
    updatedAt: 42,
  };
  expect(
    migrateProgress({
      schemaVersion: 4,
      data: {
        reviewLog: [],
        metadata: [],
        settings: [],
        ruleState: [learned],
        scanLog: [],
        puzzleRating: [],
        woodpeckerSets: [],
        games: [],
        personalCards: [],
        replyWeights: [],
      },
    }),
  ).toEqual({
    schemaVersion,
    data: {
      reviewLog: [],
      metadata: [],
      settings: [],
      ruleState: [learned],
      scanLog: [],
      puzzleRating: [],
      woodpeckerSets: [],
      games: [],
      personalCards: [],
      replyWeights: [],
    },
  });
  expect(
    migrateProgress({ schemaVersion: 0, data: {} }).data.ruleState,
  ).toEqual([]);
});
it("saves learned rules and merges learned if learned in either copy", async () => {
  const store = await openProgress({ name: `rules-${crypto.randomUUID()}` });
  try {
    await store.saveRuleState({
      ruleId: "castle-early",
      learned: false,
      learnedAt: null,
      updatedAt: 0,
    });
    await store.saveRuleState({
      ruleId: "cct-scan",
      learned: true,
      learnedAt: 3,
      updatedAt: 3,
    });
    await store.restore(
      {
        reviewLog: [],
        metadata: [],
        settings: [],
        scanLog: [],
        puzzleRating: [],
        woodpeckerSets: [],
        games: [],
        personalCards: [],
        replyWeights: [],
        ruleState: [
          { ruleId: "castle-early", learned: true, learnedAt: 5, updatedAt: 5 },
          { ruleId: "cct-scan", learned: false, learnedAt: null, updatedAt: 0 },
        ],
      },
      "merge",
      1,
    );
    expect(await store.ruleStates()).toEqual([
      { ruleId: "castle-early", learned: true, learnedAt: 5, updatedAt: 5 },
      { ruleId: "cct-scan", learned: true, learnedAt: 3, updatedAt: 3 },
    ]);
  } finally {
    store.close();
  }
});

it("persists private wording configuration across connections without exporting it", async () => {
  const name = `wording-${crypto.randomUUID()}`;
  const first = await openProgress({ name });
  await first.saveSecret(
    "explanation-wording",
    JSON.stringify({
      key: "fake-test-secret",
      endpoint: "https://private.example",
    }),
  );
  first.close();
  const second = await openProgress({ name });
  expect(await second.secret("explanation-wording")).toContain(
    "fake-test-secret",
  );
  expect(JSON.stringify(await second.snapshot())).not.toContain(
    "fake-test-secret",
  );
  expect(JSON.stringify(await second.snapshot())).not.toContain(
    "private.example",
  );
  second.close();
});
