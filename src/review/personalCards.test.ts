import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { Game } from "../game/Game";
import { openProgress, migrateProgress } from "../progress/Progress";
import { Backup } from "../progress/Backup";
import { createMistakeCard, MistakeSession } from "./personalCards";
import { MemoryProgress, Scheduler } from "../scheduler/Scheduler";
import { ulid } from "ulid";
import { openDB } from "idb";

const make = (at = 20) =>
  createMistakeCard(new Game().fen, ["e2e4", "e7e5"], at, ["cct-scan"]);

it("Undo preserves an imported card that the learner subsequently trained", async () => {
  const store = await openProgress({ name: crypto.randomUUID() });
  const source = await openProgress({ name: crypto.randomUUID() });
  try {
    await source.savePersonalCard(make());
    let json = "";
    const options = {
      appVersion: "test",
      contentVersions: {},
      download: async (s: string) => {
        json = s;
      },
    };
    await new Backup(source, options).export();
    const backup = new Backup(store, { ...options, download: async () => {} });
    await backup.import(json, "replace");
    await new MistakeSession(
      make(),
      new Scheduler(() => [make()], store),
    ).submit("e2e4");
    expect((await backup.undoInfo())?.laterCards).toBe(1);
    await backup.undo();
    expect(await store.personalCards()).toEqual([make()]);
    expect((await store.reviews())[0]).toMatchObject({
      cardId: make().id,
      grade: "good",
    });
  } finally {
    store.close();
    source.close();
  }
});
it("migrates every prior schema, roundtrips and merges cards; Undo keeps later cards", async () => {
  for (let version = 0; version <= 8; version++) {
    expect(
      migrateProgress({
        schemaVersion: version,
        data: { reviewLog: [], metadata: [] },
      }).data.personalCards,
    ).toEqual([]);
  }
  const store = await openProgress({ name: crypto.randomUUID() });
  const other = await openProgress({ name: crypto.randomUUID() });
  try {
    await store.savePersonalCard(make());
    await other.savePersonalCard({ ...make(10), tags: ["board-vision"] });
    let json = "";
    const options = {
      appVersion: "test",
      contentVersions: {},
      download: async (s: string) => {
        json = s;
      },
    };
    await new Backup(other, options).export();
    const backup = new Backup(store, { ...options, download: async () => {} });
    await backup.import(json, "merge");
    expect(await store.personalCards()).toEqual([
      { ...make(10), tags: ["cct-scan", "board-vision"] },
    ]);
    const g = new Game();
    g.play("e2e4");
    const later = createMistakeCard(g.fen, ["e7e5"], 50, []);
    await store.savePersonalCard(later);
    await backup.undo();
    expect(await store.personalCards()).toEqual(
      expect.arrayContaining([make(), later]),
    );
    await backup.import(json, "replace");
    expect(await store.personalCards()).toEqual([
      { ...make(10), tags: ["board-vision"] },
    ]);
  } finally {
    store.close();
    other.close();
  }
});

it("upgrades a populated v8 database atomically and clears the old Undo point", async () => {
  const name = crypto.randomUUID();
  const old = await openProgress({ name, version: 8 });
  const review = {
    attemptId: ulid(),
    sessionId: "old",
    cardId: make().id,
    at: 1,
    grade: "again" as const,
    context: "mistake" as const,
    hintsUsed: 0,
    durationMs: 1,
    schedulingEligible: true,
  };
  await old.record(review);
  old.close();
  const raw = await openDB(name);
  await raw.put("preImport", { obsolete: true }, "last");
  raw.close();
  const upgraded = await openProgress({ name });
  try {
    expect(await upgraded.hasUndo()).toBe(false);
    expect(await upgraded.personalCards()).toEqual([]);
    expect(await upgraded.reviews()).toEqual([review]);
    await upgraded.savePersonalCard(make());
    expect(await upgraded.personalCards()).toEqual([make()]);
  } finally {
    upgraded.close();
  }
});

it("rejects invalid card identity and illegal solution imports without changing stored cards", async () => {
  const store = await openProgress({ name: crypto.randomUUID() });
  try {
    await store.savePersonalCard(make());
    let json = "";
    const backup = new Backup(store, {
      appVersion: "test",
      contentVersions: {},
      download: async (s) => {
        json = s;
      },
    });
    await backup.export();
    for (const bad of [
      { ...make(), cardId: "mistake:white:invalid" },
      { ...make(), solution: ["e2e5"] },
    ]) {
      const envelope = JSON.parse(json);
      envelope.data.personalCards = [bad];
      await expect(
        backup.import(JSON.stringify(envelope), "replace"),
      ).rejects.toThrow("Nothing was changed");
      expect(await store.personalCards()).toEqual([make()]);
    }
  } finally {
    store.close();
  }
});

it("schedules wrong as again, hint-assisted as hard and clean as good, first attempt only", async () => {
  const store = new MemoryProgress();
  const scheduler = new Scheduler(() => [make()], store);
  const session = new MistakeSession(make(), scheduler, () => 1000);
  expect((await scheduler.due(1000)).length).toBe(1);
  expect(await session.submit("d2d4")).toBe(false);
  expect(await session.submit("e2e4")).toBe(true);
  expect(store.reviews().map((r) => [r.grade, r.schedulingEligible])).toEqual([
    ["again", true],
    ["good", false],
  ]);
  const hinted = new MistakeSession(make(), scheduler, () => 2000);
  hinted.hint();
  await hinted.submit("e2e4");
  expect(store.reviews().at(-1)?.grade).toBe("hard");
  expect(await scheduler.due(2000)).toEqual([]);
});
it("rejects a merge whose tag union would exceed the limit, so exports stay importable", async () => {
  const tags = (prefix: string) =>
    Array.from({ length: 100 }, (_, i) => `${prefix}-${i}`);
  const local = createMistakeCard(new Game().fen, ["e2e4"], 20, tags("a"));
  const store = await openProgress({ name: crypto.randomUUID() });
  try {
    await store.savePersonalCard(local);
    let json = "";
    const backup = new Backup(store, {
      appVersion: "test",
      contentVersions: {},
      download: async (s) => {
        json = s;
      },
    });
    await backup.export();
    const envelope = JSON.parse(json);
    envelope.data.personalCards = [{ ...local, tags: tags("b") }];
    await expect(
      backup.import(JSON.stringify(envelope), "merge"),
    ).rejects.toThrow();
    expect(await store.personalCards()).toEqual([local]);
    await backup.export();
    await expect(backup.import(json, "replace")).resolves.not.toThrow();
  } finally {
    store.close();
  }
});

it("freezes hint usage while saving and after success; hint moves stay valid if short search differs", async () => {
  const store = new MemoryProgress();
  const session = new MistakeSession(
    make(),
    new Scheduler(() => [make()], store),
    () => 1000,
  );
  session.hint("g1f3");
  session.hint("g1f3");
  session.hint("g1f3");
  expect(session.hintsUsed).toBe(2);
  const saving = session.submit("g1f3");
  session.hint();
  expect(await saving).toBe(true);
  session.hint();
  expect(session.hintsUsed).toBe(2);
  expect(store.reviews()).toMatchObject([{ grade: "hard", hintsUsed: 2 }]);
});

it("keeps the stored solution valid after an engine hint and carries help into a retry", async () => {
  const store = new MemoryProgress();
  const session = new MistakeSession(
    make(),
    new Scheduler(() => [make()], store),
    () => 1000,
  );
  session.hint("g1f3");
  expect(await session.submit("d2d4")).toBe(false);
  expect(await session.submit("e2e4")).toBe(true);
  expect(store.reviews().map((r) => [r.grade, r.hintsUsed])).toEqual([
    ["again", 1],
    ["hard", 1],
  ]);
});

it("cannot add a hint or duplicate a submission after an attempt is decided", async () => {
  const store = new MemoryProgress();
  const session = new MistakeSession(
    make(),
    new Scheduler(() => [make()], store),
    () => 1000,
  );
  session.hint();
  const saving = session.submit("e2e4");
  session.hint();
  expect(await saving).toBe(true);
  session.hint();
  expect(session.hintsUsed).toBe(1);
  expect(await session.submit("e2e4")).toBe(false);
  expect(store.reviews()).toHaveLength(1);
  expect(store.reviews()[0]).toMatchObject({ hintsUsed: 1, grade: "hard" });
});
