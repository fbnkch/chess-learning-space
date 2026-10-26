import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { openProgress, migrateProgress, schemaVersion } from "./Progress";
import { Backup, validateBackup } from "./Backup";
import { gradeAnswer, learnedRuleIds, quizItems } from "../rules/quiz";
import { rebuild } from "../scheduler/Scheduler";

it("migrates v9 and roundtrips, merges and undoes quiz results while keeping later work", async () => {
  expect(schemaVersion).toBe(11);
  expect(
    migrateProgress({ schemaVersion: 9, data: { reviewLog: [], metadata: [] } })
      .schemaVersion,
  ).toBe(11);
  const source = await openProgress({ name: crypto.randomUUID() });
  const target = await openProgress({ name: crypto.randomUUID() });
  const now = Date.now();
  let json = "";
  const options = {
    clock: () => now,
    appVersion: "test",
    contentVersions: {},
    download: async (value: string) => {
      json = value;
    },
  };
  const backup = new Backup(source, options);
  const imported = new Backup(target, options);
  try {
    const first = gradeAnswer(quizItems[0], quizItems[0].rule.id, {
      attemptId: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
      sessionId: "quiz",
      at: now,
      durationMs: 100,
    });
    await source.record(first);
    await backup.export();
    const exported = json;
    expect(validateBackup(exported).reviewLog).toEqual([first]);
    await imported.import(exported, "replace");
    await imported.undo();
    expect(await target.reviews()).toEqual([]);
    expect(learnedRuleIds([], await target.reviews())).toEqual([]);
    await imported.import(exported, "merge");
    await imported.import(exported, "merge");
    expect(await target.reviews()).toEqual([first]);
    await imported.import(exported, "replace");
    const later = gradeAnswer(quizItems[1], quizItems[1].rule.id, {
      attemptId: "01ARZ3NDEKTSV4RRFFQ69G5FAW",
      sessionId: "later",
      at: now,
      durationMs: 200,
    });
    await target.record(later);
    await imported.undo();
    expect(await target.reviews()).toHaveLength(2);
    expect(learnedRuleIds([], await target.reviews())).toContain(
      quizItems[1].rule.id,
    );
    expect(rebuild(await target.reviews()).size).toBe(0);
    const invalid = JSON.parse(exported);
    invalid.data.reviewLog[0].schedulingEligible = true;
    expect(() => validateBackup(JSON.stringify(invalid))).toThrow();
  } finally {
    source.close();
    target.close();
  }
});

it("upgrades an existing v9 database without losing learned rules or review history", async () => {
  const name = crypto.randomUUID();
  const previous = await openProgress({ name, version: 9 });
  await previous.saveRuleState({
    ruleId: "castle-early",
    learned: true,
    learnedAt: 1000,
    updatedAt: 1000,
  });
  const legacy = {
    ...gradeAnswer(quizItems[0], quizItems[0].rule.id, {
      attemptId: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
      sessionId: "old",
      at: 1000,
      durationMs: 10,
    }),
    cardId: "rep:white:retired",
    context: "practice" as const,
  };
  await previous.record(legacy);
  previous.close();
  const upgraded = await openProgress({ name });
  try {
    expect(await upgraded.ruleStates()).toEqual([
      {
        ruleId: "castle-early",
        learned: true,
        learnedAt: 1000,
        updatedAt: 1000,
      },
    ]);
    expect(await upgraded.reviews()).toEqual([legacy]);
  } finally {
    upgraded.close();
  }
});

it.each(["quiz-local", "quiz-incoming"])(
  "merge preserves either side's quiz learning and Undo baseline (%s)",
  async (direction) => {
    const source = await openProgress({ name: crypto.randomUUID() });
    const target = await openProgress({ name: crypto.randomUUID() });
    const item = quizItems.find((q) => q.rule.id === "castle-early")!;
    let json = "";
    const options = {
      clock: () => 1000,
      appVersion: "test",
      contentVersions: {},
      download: async (value: string) => {
        json = value;
      },
    };
    const backup = new Backup(source, options);
    const imported = new Backup(target, options);
    const read = async () =>
      learnedRuleIds(await target.ruleStates(), await target.reviews());
    const answer = gradeAnswer(item, item.rule.id, {
      attemptId: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
      sessionId: "quiz",
      at: 300,
      durationMs: 10,
    });
    try {
      const quizSide = direction === "quiz-local" ? target : source;
      const unlearnSide = direction === "quiz-local" ? source : target;
      await quizSide.record(answer);
      await unlearnSide.saveRuleState({
        ruleId: item.rule.id,
        learned: false,
        learnedAt: null,
        updatedAt: 400,
      });
      const beforeRules = await target.ruleStates();
      const beforeReviews = await target.reviews();
      await backup.export();
      await imported.import(json, "merge");
      expect(await read()).toContain(item.rule.id);
      expect(await target.ruleStates()).toEqual([
        { ruleId: item.rule.id, learned: true, learnedAt: 300, updatedAt: 400 },
      ]);
      await imported.undo();
      expect(await target.ruleStates()).toEqual(beforeRules);
      expect(await target.reviews()).toEqual(beforeReviews);
      expect(await read()).toEqual(
        direction === "quiz-local" ? [item.rule.id] : [],
      );

      await imported.import(json, "merge");
      await target.record({
        ...answer,
        attemptId: "01ARZ3NDEKTSV4RRFFQ69G5FAW",
        at: 500,
      });
      await target.saveRuleState({
        ruleId: item.rule.id,
        learned: false,
        learnedAt: null,
        updatedAt: 600,
      });
      expect(await read()).toEqual([]);
      await imported.undo();
      expect(await read()).toEqual([]);
      expect((await target.reviews()).map((r) => r.at)).toContain(500);
      expect(await target.ruleStates()).toEqual([
        {
          ruleId: item.rule.id,
          learned: false,
          learnedAt: null,
          updatedAt: 600,
        },
      ]);
    } finally {
      source.close();
      target.close();
    }
  },
);
