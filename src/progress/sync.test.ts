import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { openProgress } from "./Progress";
import { Backup, serializeBackup } from "./Backup";
it("sync merges validate atomically, preserve secrets, export bookkeeping and manual Undo, and never delete newer work", async () => {
  const p = await openProgress({ name: crypto.randomUUID() });
  await p.saveSecret("sync-code", "private-code");
  const empty = await p.snapshot();
  await p.restore(empty, "merge", 100);
  const undo = await p.undoInfo();
  await p.setMetadata([{ key: "lastExportAt", value: 42 }]);
  await p.saveRuleState({
    ruleId: "development",
    learned: true,
    learnedAt: 10,
    updatedAt: 10,
  });
  await p.mergeFromSync(serializeBackup(empty));
  expect(await p.undoInfo()).toEqual({ ...undo, laterRules: 1 });
  expect(await p.secret("sync-code")).toBe("private-code");
  expect(await p.metadata("lastExportAt")).toEqual({
    key: "lastExportAt",
    value: 42,
  });
  expect(await p.ruleStates()).toHaveLength(1);
  expect(serializeBackup(await p.snapshot())).not.toContain("private-code");
  expect(serializeBackup(await p.snapshot())).not.toContain("secrets");
  const before = await p.snapshot();
  await expect(
    p.mergeFromSync(
      serializeBackup(empty).replace(
        '"schemaVersion":11',
        '"schemaVersion":999',
      ),
    ),
  ).rejects.toThrow(/newer app/);
  expect(await p.snapshot()).toEqual(before);
  await p.setMetadata([{ key: "sync:pushCount", value: 400 }]);
  await p.undo();
  expect((await p.metadata("sync:pushCount"))?.value).toBe(400);
  expect(await p.ruleStates()).toHaveLength(1);
  expect(await p.secret("sync-code")).toBe("private-code");
  p.close();
});

it("reserves the last monthly upload atomically across connections", async () => {
  const name = crypto.randomUUID();
  const a = await openProgress({ name }),
    b = await openProgress({ name });
  const now = Date.UTC(2026, 9, 26);
  await a.setMetadata([
    { key: "sync:pushMonth", value: "2026-10" },
    { key: "sync:pushCount", value: 399 },
  ]);
  const results = await Promise.all([
    a.reserveSyncPush(now),
    b.reserveSyncPush(now),
  ]);
  expect(results.sort()).toEqual([false, true]);
  expect(await a.reserveSyncPush(now)).toBe(false);
  expect(await b.reserveSyncPush(Date.UTC(2026, 10, 1))).toBe(true);
  a.close();
  b.close();
});
it("aborts a cross-copy review conflict without touching any store or Undo", async () => {
  const p = await openProgress({ name: crypto.randomUUID() });
  const review = {
    attemptId: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
    sessionId: "s",
    cardId: "puzzle:abc",
    at: 100,
    grade: "good" as const,
    context: "puzzle" as const,
    hintsUsed: 0,
    durationMs: 10,
    schedulingEligible: true,
  };
  await p.record(review);
  await p.requestPersistence();
  const before = await p.snapshot();
  const incoming = structuredClone(before);
  incoming.reviewLog[0].grade = "again";
  incoming.ruleState.push({
    ruleId: "test",
    learned: true,
    learnedAt: 10,
    updatedAt: 10,
  });
  await expect(p.mergeFromSync(serializeBackup(incoming))).rejects.toThrow(
    /Conflicting/,
  );
  expect(await p.snapshot()).toEqual(before);
  expect(await p.hasUndo()).toBe(false);
  p.close();
});
it("accepts identical review facts with a different JSON property order", async () => {
  const p = await openProgress({ name: crypto.randomUUID() });
  await p.record({
    attemptId: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
    sessionId: "s",
    at: 100,
    durationMs: 10,
    cardId: "rule:castle-early:example-v1",
    context: "rule-quiz",
    grade: "good",
    hintsUsed: 0,
    schedulingEligible: false,
  });
  await p.requestPersistence();
  const before = await p.reviews();
  await p.mergeFromSync(serializeBackup(await p.snapshot()));
  expect(await p.reviews()).toEqual(before);
  p.close();
});
import { learnedRuleIds } from "../rules/quiz";
it("Undo removes imported quiz learning materialized by sync and keeps later learner edits", async () => {
  const p = await openProgress({ name: crypto.randomUUID() });
  const incoming = await p.snapshot();
  incoming.reviewLog.push({
    attemptId: "01ARZ3NDEKTSV4RRFFQ69G5FAV", sessionId: "quiz",
    cardId: "rule:castle-early:example-v1", at: 100,
    context: "rule-quiz", grade: "good", hintsUsed: 0,
    durationMs: 10, schedulingEligible: false,
  });
  await p.restore(incoming, "replace", 200);
  await p.saveRuleState({ ruleId: "development", learned: true, learnedAt: 210, updatedAt: 210 });
  incoming.ruleState.push({ ruleId: "remote-rule", learned: true, learnedAt: 220, updatedAt: 220 });
  await p.mergeFromSync(serializeBackup(incoming));
  expect(await p.ruleStates()).toContainEqual({ ruleId: "castle-early", learned: true, learnedAt: 100, updatedAt: 100 });
  await p.undo();
  expect(await p.reviews()).toEqual([]);
  expect(learnedRuleIds(await p.ruleStates(), await p.reviews())).toEqual(["development", "remote-rule"]);
  p.close();
});
it("sync derives the first review date from the union without changing the last export date", async () => {
  const p = await openProgress({ name: crypto.randomUUID() });
  const incoming = await p.snapshot();
  incoming.reviewLog.push({
    attemptId: "01ARZ3NDEKTSV4RRFFQ69G5FAV", sessionId: "quiz",
    cardId: "rule:castle-early:example-v1", at: 100,
    context: "rule-quiz", grade: "good", hintsUsed: 0,
    durationMs: 10, schedulingEligible: false,
  });
  await p.setMetadata([{ key: "lastExportAt", value: 42 }]);
  await p.mergeFromSync(serializeBackup(incoming));
  expect((await p.metadata("firstReviewAt"))?.value).toBe(100);
  const backup = new Backup(p, { clock: () => 100, download: async () => {}, appVersion: "1", contentVersions: {} });
  expect(await backup.nudge()).toBe(false);
  expect((await p.metadata("lastExportAt"))?.value).toBe(42);
  incoming.reviewLog[0] = { ...incoming.reviewLog[0], attemptId: "01ARZ3NDEKTSV4RRFFQ69G5FAW", at: 50 };
  await p.mergeFromSync(serializeBackup(incoming));
  expect((await p.metadata("firstReviewAt"))?.value).toBe(50);
  p.close();
});
it("a new device's backup reminder starts with its synced review, not the Unix epoch", async () => {
  const p = await openProgress({ name: crypto.randomUUID() });
  const today = Date.UTC(2026, 9, 26, 12);
  const incoming = await p.snapshot();
  incoming.reviewLog.push({
    attemptId: "01ARZ3NDEKTSV4RRFFQ69G5FAV", sessionId: "quiz",
    cardId: "rule:castle-early:example-v1", at: today,
    context: "rule-quiz", grade: "good", hintsUsed: 0,
    durationMs: 10, schedulingEligible: false,
  });
  // Another device's export must not postpone this device's reminder.
  incoming.metadata.push({ key: "lastExportAt", value: today });
  await p.mergeFromSync(serializeBackup(incoming), today);
  expect((await p.metadata("firstReviewAt"))?.value).toBe(today);
  expect(await p.metadata("lastExportAt")).toBeUndefined();
  let time = today;
  const backup = new Backup(p, { clock: () => time, download: async () => {}, appVersion: "1", contentVersions: {} });
  expect(await backup.nudge()).toBe(false);
  time += 7 * 86400000 - 1;
  expect(await backup.nudge()).toBe(false);
  time++;
  expect(await backup.nudge()).toBe(true);
  p.close();
});
it("a pull's pending merge cannot cross an import epoch, even on another connection", async () => {
  const name = crypto.randomUUID();
  const a = await openProgress({ name }), b = await openProgress({ name });
  const incoming = await a.snapshot();
  incoming.reviewLog.push({
    attemptId: "01ARZ3NDEKTSV4RRFFQ69G5FAV", sessionId: "quiz",
    cardId: "rule:castle-early:example-v1", at: 100,
    context: "rule-quiz", grade: "good", hintsUsed: 0,
    durationMs: 10, schedulingEligible: false,
  });
  const initial = await a.syncDataState();
  await b.restore(await b.snapshot(), "merge", 200);
  expect((await a.syncDataState()).epoch).toBe(initial.epoch + 1);
  await expect(a.mergeFromSync(serializeBackup(incoming), Date.now(), initial.epoch)).rejects.toThrow(/data changed/);
  expect(await a.reviews()).toEqual([]);
  await b.undo();
  expect((await a.syncDataState()).epoch).toBe(initial.epoch + 2);
  a.close(); b.close();
});
