import "fake-indexeddb/auto";
import { expect, it, vi } from "vitest";
import { openProgress } from "../progress/Progress";
import { Backup } from "../progress/Backup";
import { Scheduler } from "../scheduler/Scheduler";
import { repertoire } from "../repertoire/bundled";
import { drillCards, drillRepertoire, completionReview } from "../trainer/stages";
import { PuzzleTraining } from "../puzzles/PuzzleTraining";
import { loadDashboard } from "./dashboardData";
import { ulid } from "ulid";

const now = new Date(2026, 9, 25, 10).getTime();
const settings = {
  sound: false,
  animationMs: 0,
  coordinates: true,
  reducedMotion: false,
};
it("aggregates a fresh profile and resumes the last opening through public ports", async () => {
  const store = await openProgress({ name: crypto.randomUUID() });
  const scheduler = new Scheduler((log) => drillCards(repertoire, log), store);
  const puzzles = new PuzzleTraining(store);
  try {
    expect(
      await loadDashboard(store, scheduler, puzzles, settings, () => now),
    ).toMatchObject({
      empty: true,
      due: { openings: 0, puzzles: 0, mistakes: 0 },
      recall: null,
      rating: 1000,
    });
    const card = repertoire
      .selectLines("black", ["caro-classical"])
      .cards("black")[0];
    await scheduler.record(
      completionReview(card, "learn", "learn-session", now - 1000, ulid()),
    );
    await store.saveRuleState({
      ruleId: "cct-scan",
      learned: true,
      learnedAt: now,
      updatedAt: now,
    });
    await store.recordScan({
      attemptId: ulid(),
      sessionId: "scan",
      at: now,
      positionKey: "position",
      mode: "scan",
      required: 4,
      found: 3,
      wrong: 0,
      durationMs: 100,
    });
    const data = await loadDashboard(
      store,
      scheduler,
      puzzles,
      settings,
      () => now,
    );
    expect(data).toMatchObject({
      empty: false,
      recall: 0.75,
      learnedRules: 1,
      weekly: { openings: 1, threats: 1 },
      continueLine: {
        stage: "practice",
        href: "#openings?line=caro-classical",
      },
    });
  } finally {
    store.close();
  }
});
it("roundtrips optional plan settings without a schema migration and still accepts old settings", async () => {
  const source = await openProgress({ name: crypto.randomUUID() });
  const target = await openProgress({ name: crypto.randomUUID() });
  const download = vi
    .fn<(json: string, filename: string) => Promise<void>>()
    .mockResolvedValue();
  const options = {
    clock: () => now,
    appVersion: "1",
    contentVersions: {},
    download,
  };
  try {
    const plan = {
      ...settings,
      welcomeComplete: true,
      startingOpening: "caro" as const,
      planStartedAt: now,
      planReviewedGames: ["game"],
      planExternal: { play: 2, endgame: 1 },
    };
    await source.saveSettings(plan);
    await new Backup(source, options).export();
    await new Backup(target, options).import(
      download.mock.calls[0][0],
      "replace",
    );
    expect(await target.settings()).toEqual(plan);
    await source.saveSettings(settings);
    await new Backup(source, options).export();
    await new Backup(target, options).import(
      download.mock.calls.at(-1)![0],
      "replace",
    );
    expect(await target.settings()).toEqual(settings);
  } finally {
    source.close();
    target.close();
  }
});

it("offers separate due Italian and Caro-Kann steps matching each target group queue", async () => {
  const store = await openProgress({ name: crypto.randomUUID() });
  const scheduler = new Scheduler((log) => drillCards(repertoire, log), store);
  try {
    for (const [side, line] of [["white", "italian-pianissimo-main"], ["white", "italian-two-knights"], ["black", "caro-classical"]] as const) {
      const card = repertoire.selectLines(side, [line]).cards(side)[0];
      expect(card).toBeDefined();
      await scheduler.record(completionReview(card, "practice", line, now - 1000, ulid()));
    }
    const data = await loadDashboard(store, scheduler, new PuzzleTraining(store), settings, () => now);
    const steps = data.session.filter((s) => s.id.startsWith("openings"));
    expect(steps).toHaveLength(2);
    const dueIds = new Set((await scheduler.due(now)).map((c) => c.id));
    const log = await scheduler.reviews();
    for (const [index, side, group] of [[0, "white", "italian"], [1, "black", "caro"]] as const) {
      const lineId = new URLSearchParams(steps[index].href.split("?")[1]).get("line")!;
      expect(repertoire.lineMeta(side).find((l) => l.id === lineId)?.group).toBe(group);
      const selected = repertoire.selectLines(side, repertoire.lineMeta(side).filter((l) => l.group === group).map((l) => l.id));
      const count = drillRepertoire(selected, side, log, repertoire).cards(side).filter((c) => dueIds.has(c.id)).length;
      expect(count).toBeGreaterThan(0);
      expect(steps[index].title).toContain(`(${count})`);
    }
  } finally { store.close(); }
});

it.each([
  ["white", "1. e4 e5 2. Nf3 a6 3. Bc4 Nc6", 0.5],
  ["black", "1. e4 c6 2. a3 d5 3. d4", 0.5],
  ["white", "1. e4 e5 2. a3 Nc6 3. Nf3", 1],
  ["black", "1. e4 a6 2. d4", 1],
  ["white", "1. e4 Nc6 2. Nf3 e5 3. Bc4 Bc5", 1],
  ["white", "1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d3 d6 6. O-O O-O 7. a3 a6", 1],
  [null, "1. e4 e5", null],
] as const)("measures opponent reply coverage for %s in %s until the first deviation", async (colour, pgn, expected) => {
  const store = await openProgress({ name: crypto.randomUUID() });
  const scheduler = new Scheduler((log) => drillCards(repertoire, log), store);
  vi.spyOn(store, "games").mockResolvedValue([{
    id: "game", fingerprint: "game", pgn, colour, result: "1-0",
    date: "2026-10-25", timeControl: "600", opening: "", url: null,
    white: "White", black: "Black",
  }]);
  try {
    const data = await loadDashboard(store, scheduler, new PuzzleTraining(store), settings, () => now);
    expect(data.gameCoverage).toBe(expected);
  } finally { store.close(); }
});
