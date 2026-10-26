import { expect, it } from "vitest";
import { compilePgn } from "../repertoire/compiler";
import { Repertoire } from "../repertoire/Repertoire";
import { MemoryProgress, Scheduler } from "../scheduler/Scheduler";
import type { Review } from "../scheduler/Scheduler";
import {
  lineStage,
  drillCards,
  drillRepertoire,
  completionReview,
} from "./stages";
const rep = new Repertoire({
  white: compilePgn(
    "{[%line main]} 1. d4 d5 2. Nf3 Nf6 3. c4 ({[%line other]} 3. e3) *",
    "white",
  ),
});
const card = rep.cards("white")[0];
const learn = completionReview(card, "learn", "learn-session", 1, "1");
it("derives Learn, Practice and Drill from durable completion entries", () => {
  expect(lineStage(rep, "white", "main", [])).toBe("learn");
  expect(lineStage(rep, "white", "main", [learn])).toBe("practice");
  expect(drillCards(rep, [learn])).toEqual([]);
  const clean = completionReview(card, "practice", "run", 2, "2");
  expect(lineStage(rep, "white", "main", [learn, clean])).toBe("drill");
  expect(drillCards(rep, [learn, clean])).toHaveLength(3);
  expect(lineStage(rep, "white", "other", [learn, clean])).toBe("learn");
});
it("keeps the reviewed line in Drill without promoting transposed/shared lines", () => {
  const old: Review = {
    ...learn,
    context: "repertoire",
    lineCompleted: undefined,
    schedulingEligible: true,
  };
  expect(lineStage(rep, "white", "main", [old])).toBe("drill");
  expect(lineStage(rep, "white", "other", [old])).toBe("learn");
  expect(lineStage(rep, "white", "main", [{ ...old, lineId: undefined }])).toBe(
    "drill",
  );
  expect(lineStage(rep, "black", "main", [old])).toBe("learn");
});
it("does not promote incomplete, failed or hinted Practice attempts", () => {
  for (const changes of [
    { lineCompleted: undefined },
    { grade: "again" as const },
    { hintsUsed: 1 },
  ])
    expect(
      lineStage(rep, "white", "main", [
        learn,
        { ...learn, context: "practice", ...changes },
      ]),
    ).toBe("practice");
});
it("keeps legacy fallback stable when training a subset of shared lines", () => {
  const old: Review = {
    ...learn,
    context: "repertoire",
    lineId: undefined,
    lineCompleted: undefined,
    schedulingEligible: true,
  };
  expect(
    drillRepertoire(
      rep.selectLines("white", ["other"]),
      "white",
      [old],
      rep,
    ).cards("white"),
  ).toEqual([]);
});
it("a transposed card enters SRS once, without promoting its other reaching line", async () => {
  const transposed = new Repertoire({
    white: compilePgn(
      "{[%line main]} 1. d4 d5 2. Nf3 Nf6 3. c4 ({[%line other]} 3. e3 e6 4. c4 Be7 5. Nc3) e6 4. e3 Be7 5. Nc3 *",
      "white",
    ),
  });
  const main = transposed.selectLines("white", ["main"]);
  const other = transposed.selectLines("white", ["other"]);
  const shared = main.cards("white").find((c) => main.prelude(c).length === 8)!;
  expect(other.cards("white").some((c) => c.id === shared.id)).toBe(true);
  const clean = completionReview(shared, "practice", "clean", 1, "1");
  const progress = new MemoryProgress([clean]);
  const scheduler = new Scheduler(
    (log) => drillCards(transposed, log),
    progress,
  );
  expect(lineStage(transposed, "white", "other", [clean])).toBe("learn");
  expect(
    (await scheduler.due(2)).filter((c) => c.id === shared.id),
  ).toHaveLength(1);
  const before = await scheduler.due(2);
  await scheduler.record({
    ...clean,
    attemptId: "2",
    context: "repertoire",
    sessionId: "drill",
    lineCompleted: undefined,
  });
  expect(await scheduler.due(2)).toHaveLength(before.length - 1);
});
