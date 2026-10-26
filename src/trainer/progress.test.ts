import { expect, it } from "vitest";
import { compilePgn } from "../repertoire/compiler";
import { Repertoire } from "../repertoire/Repertoire";
import { completionReview } from "./stages";
import { cohort, coverage, unlockReview } from "./progress";
import type { Review } from "../scheduler/Scheduler";
const rep = new Repertoire({
  white: compilePgn(
    `
[LineId "main"]
[OpeningGroup "test"]
[Main "true"]
1. e4 e5 {[%weight 40]} 2. Nf3 *
[LineId "sicilian"]
[OpeningGroup "test"]
1. e4 c5 {[%weight 30]} 2. Nf3 *
[LineId "french"]
[OpeningGroup "test"]
1. e4 e6 {[%weight 20]} 2. d4 *
[LineId "caro"]
[OpeningGroup "test"]
1. e4 c6 {[%weight 10]} 2. d4 *
[LineId "rare"]
[OpeningGroup "test"]
1. e4 a6 {[%weight 1]} 2. d4 *`,
    "white",
  ),
});
const cards = (id: string) => rep.selectLines("white", [id]).cards("white");
const now = 30 * 86400000;
const clock = () => now;
it("starts with N lines, main first then first-branch reply weight, independently per side", () => {
  const result = cohort(rep, "white", [], 3, clock);
  expect(result.active.map((l) => l.line.id)).toEqual([
    "main",
    "sicilian",
    "french",
  ]);
  expect(result.locked.map((l) => l.line.id)).toEqual(["caro", "rare"]);
  expect(cohort(rep, "black", [], 3, clock).active).toEqual([]);
});
it("unlocks manually through the log without scheduling, discovering or promoting a line", () => {
  const unlock = unlockReview(cards("caro")[0], "unlock", now, "1");
  const result = cohort(rep, "white", [unlock], 3, clock);
  expect(result.active.map((l) => l.line.id)).toContain("caro");
  expect(result.locked.map((l) => l.line.id)).toEqual(["rare"]);
  expect(
    coverage(rep.selectLines("white", ["caro"]), "white", [unlock], rep),
  ).toMatchObject({ discovered: 0, practised: 0, drill: 0, mastered: 0 });
});
function scheduled(
  lineId: string,
  grade: Review["grade"],
  at: number,
  run: string,
): Review[] {
  return cards(lineId).map((card, i) => ({
    ...completionReview(card, "practice", run, at, `${run}-${i}`),
    context: "repertoire",
    lineCompleted: undefined,
    schedulingEligible: true,
    grade,
  }));
}
it("auto-unlocks exactly the next line only when all active cards are stable and lapses are seven days old", () => {
  const log = ["main", "sicilian", "french"].flatMap((id) => [
    ...scheduled(id, "again", now - 7 * 86400000, `fail-${id}`),
    ...scheduled(id, "good", now - 6 * 86400000, `first-${id}`),
    ...scheduled(id, "good", now - 5 * 86400000, `second-${id}`),
  ]);
  expect(
    cohort(rep, "white", log, 3, () => now - 1).locked.map((l) => l.line.id),
  ).toEqual(["caro", "rare"]);
  expect(
    cohort(rep, "white", log, 3, clock).locked.map((l) => l.line.id),
  ).toEqual(["rare"]);
  expect(
    cohort(rep, "white", log.slice(0, -1), 3, clock).locked.map(
      (l) => l.line.id,
    ),
  ).toEqual(["caro", "rare"]);
});
it("never re-locks Practice/Drill progress and shows weakest lines with a reason", () => {
  const practice = completionReview(cards("rare")[0], "learn", "learn", 1, "1");
  const log = [practice, ...scheduled("caro", "again", now, "fail")];
  const result = cohort(rep, "white", log, 3, clock);
  expect(result.active.map((l) => l.line.id)).toContain("rare");
  expect(result.active[0].line.id).toBe("caro");
  expect(result.active[0].reason).toMatch(/2 lapses.*2.30 ease/);
});
it("counts unique shared positions across discovery, practice, Drill and mastery without promoting shared lines", () => {
  const main = cards("main");
  const seen = {
    ...completionReview(main[0], "learn", "seen", 1, "1"),
    lineCompleted: undefined,
  };
  const practice = completionReview(main[1], "practice", "practice", 2, "2");
  const log: Review[] = [seen, practice];
  expect(coverage(rep, "white", log)).toEqual({
    total: 6,
    discovered: 1,
    practised: 1,
    drill: 2,
    mastered: 0,
  });
  expect(
    coverage(rep.selectLines("white", ["sicilian"]), "white", log, rep),
  ).toEqual({ total: 2, discovered: 1, practised: 0, drill: 1, mastered: 0 });
  for (let n = 0; n < 5; n++)
    log.push(...scheduled("main", "good", n + 3, `good-${n}`));
  expect(coverage(rep, "white", log).mastered).toBe(2);
  expect(coverage(rep, "black", log).total).toBe(0);
});

it("keeps progress and manual admissions when the target is reduced", () => {
  const log = [
    completionReview(cards("rare")[0], "learn", "learn", 1, "1"),
    unlockReview(cards("caro")[0], "unlock", 2, "2"),
  ];
  expect(cohort(rep, "white", log, 3, clock).active).toHaveLength(5);
  expect(cohort(rep, "white", log, 12, clock).locked).toEqual([]);
});
it("does not count skipped positions as discovered in new lessons with explicit visits", () => {
  const [root] = cards("main");
  const visit = {
    ...completionReview(root, "learn", "visit", 1, "1"),
    lineCompleted: undefined,
  };
  const complete = {
    ...completionReview(root, "learn", "complete", 2, "2"),
    discoveryMode: "visits" as const,
  };
  expect(coverage(rep, "white", [visit, complete]).discovered).toBe(1);
  expect(coverage(rep, "white", [complete]).discovered).toBe(0);
});

it("retains legacy discovered coverage when a completed lesson is revisited later or logs are merged", () => {
  const [root] = cards("main");
  const complete = {
    ...completionReview(root, "learn", "legacy", 1, "1"),
    discoveryMode: undefined,
  };
  const laterVisit = {
    ...completionReview(root, "learn", "visit", 2, "2"),
    lineCompleted: undefined,
  };
  expect(coverage(rep, "white", [laterVisit, complete]).discovered).toBe(2);
  expect(coverage(rep, "white", [complete]).discovered).toBe(2);
  expect(coverage(rep, "white", [{ ...laterVisit, at: 0 }, complete]).discovered).toBe(2);
});

it("does not invent discoveries when another line already recorded the shared start", () => {
  const visit = {
    ...completionReview(cards("main")[0], "learn", "visit", 1, "1"),
    lineCompleted: undefined,
  };
  const complete = {
    ...completionReview(cards("sicilian")[0], "learn", "complete", 2, "2"),
    discoveryMode: "visits" as const,
  };
  expect(coverage(rep, "white", [visit, complete]).discovered).toBe(1);
  expect(
    coverage(rep.selectLines("white", ["sicilian"]), "white", [visit, complete], rep),
  ).toMatchObject({ total: 2, discovered: 1 });
});

it("admits at most one automatic line per side when every line shares stable cards", () => {
  const pgn = ["a", "b", "c", "d", "e"]
    .map((id) => `[LineId "${id}"]\n1. e4 e5 2. Nf3 *`)
    .join("\n");
  const shared = new Repertoire({
    white: compilePgn(pgn, "white"),
    black: compilePgn(pgn, "black"),
  });
  const log: Review[] = (["white", "black"] as const).flatMap((side) =>
    shared.cards(side).flatMap((card, i) => [1, 2].map((run) => ({
      ...completionReview(card, "practice", `${side}-${run}`, run, `${side}-${i}-${run}`),
      lineId: "a",
      context: "repertoire" as const,
      lineCompleted: undefined,
      schedulingEligible: true,
    }))),
  );
  for (const side of ["white", "black"] as const) {
    const result = cohort(shared, side, log, 3, clock);
    expect(result.active.map((entry) => entry.line.id)).toEqual(["a", "b", "c", "d"]);
    expect(result.locked.map((entry) => entry.line.id)).toEqual(["e"]);
  }
});
