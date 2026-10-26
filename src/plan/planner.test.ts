import { describe, expect, it } from "vitest";
import { planSession, weeklyProgress } from "./planner";
import type { Review } from "../scheduler/Scheduler";

describe("training plan", () => {
  it("keeps a short ordered session after a long gap instead of accumulating missed days", () => {
    const plan = planSession({ openings: 200, puzzles: 80, mistakes: 4 });
    expect(plan.map((step) => step.id)).toEqual([
      "openings",
      "tactics",
      "threats",
      "lesson",
    ]);
    expect(plan.reduce((sum, step) => sum + step.minutes, 0)).toBe(18);
  });
  it("counts sessions once and respects the local 04:00 boundary", () => {
    const at = new Date(2026, 9, 25, 3, 59).getTime();
    const review: Review = {
      attemptId: "a",
      sessionId: "s",
      cardId: "puzzle:a",
      at,
      context: "puzzle",
      grade: "good",
      hintsUsed: 0,
      durationMs: 1000,
      schedulingEligible: false,
    };
    expect(
      weeklyProgress([review, { ...review, attemptId: "b" }], [], {}, () => at)
        .tactics,
    ).toBe(1);
    expect(
      weeklyProgress(
        [review],
        [],
        { planStartedAt: new Date(2026, 9, 25, 4).getTime() },
        () => at + 120000,
      ).tactics,
    ).toBe(0);
    expect(weeklyProgress([review], [], {}, () => at).todaySessions).toBe(1);
    expect(
      weeklyProgress([review], [], {}, () => at + 120000).todaySessions,
    ).toBe(0);
  });
  it("keeps external checkoffs and unfinished work across gaps until the learner starts a new week", () => {
    const settings = {
      planStartedAt: 1000,
      planExternal: { play: 2, endgame: 0 },
    };
    expect(
      weeklyProgress([], [], settings, () => 1000 + 50 * 86400000),
    ).toMatchObject({ play: 2, endgame: 0, tactics: 0 });
  });
});

it("counts scan-only sessions once within the local 04:00 day, including shared review sessions", () => {
  const boundary = new Date(2026, 9, 25, 4).getTime();
  const scan = { attemptId: "scan", sessionId: "shared", at: boundary,
    positionKey: "position", mode: "scan" as const, required: 4, found: 3, wrong: 0, durationMs: 100 };
  const review: Review = { attemptId: "review", sessionId: "shared", at: boundary,
    cardId: "puzzle:a", context: "puzzle", grade: "good", hintsUsed: 0,
    durationMs: 100, schedulingEligible: false };
  const scans = [scan, { ...scan, attemptId: "retry" },
    { ...scan, sessionId: "old", at: boundary - 1 },
    { ...scan, sessionId: "future", at: boundary + 1 }];
  expect(weeklyProgress([], scans, {}, () => boundary).todaySessions).toBe(1);
  expect(weeklyProgress([review], scans, {}, () => boundary).todaySessions).toBe(1);
  expect(weeklyProgress([], scans, {}, () => boundary - 1).todaySessions).toBe(1);
  expect(weeklyProgress([], scans, {}, () => boundary + 1).todaySessions).toBe(2);
});
