import { monotonicFactory } from "ulid";
import { expect, it } from "vitest";
import {
  MemoryProgress,
  Scheduler,
  rebuild,
  ordered,
  transition,
  dayStart,
  type Review,
  type SrsState,
} from "./Scheduler";
import type { RepertoireCard } from "../repertoire/types";
const card: RepertoireCard = {
  id: "rep:white:position",
  kind: "repertoire",
  side: "white",
  positionKey: "position",
  lineId: "italian",
};
const at = new Date(2026, 9, 25, 12).getTime();
const review = (
  grade: Review["grade"],
  extra: Partial<Review> = {},
): Review => ({
  attemptId: "01",
  sessionId: "session",
  cardId: card.id,
  lineId: card.lineId,
  at,
  grade,
  context: "repertoire",
  hintsUsed: 0,
  durationMs: 1000,
  schedulingEligible: true,
  ...extra,
});
const state: SrsState = {
  ease: 2.5,
  intervalDays: 10,
  reps: 3,
  lapses: 0,
  due: at,
};

it.each([
  ["again", 2.3, 1, 0, 1],
  ["hard", 2.35, 12, 4, 0],
  ["good", 2.5, 25, 4, 0],
  ["easy", 2.65, 33, 4, 0],
] as const)(
  "applies the exact %s transition",
  (grade, ease, days, reps, lapses) => {
    expect(transition(state, review(grade))).toEqual({
      ease,
      intervalDays: days,
      reps,
      lapses,
      due: new Date(2026, 9, 25 + days, 4).getTime(),
    });
  },
);
it("starts good at one day then three; easy multiplies the good interval", () => {
  const first = transition(undefined, review("good"));
  expect(first.intervalDays).toBe(1);
  expect(transition(first, review("good")).intervalDays).toBe(3);
  expect(transition(undefined, review("easy")).intervalDays).toBe(1);
  expect(transition({ ...state, ease: 1.3 }, review("again")).ease).toBe(1.3);
});

it("replays eligible reviews in timestamp then attempt-ID order, preserving failed retries", () => {
  const log = [
    review("good", {
      attemptId: "03",
      sessionId: "second",
      schedulingEligible: true,
    }),
    review("good", { attemptId: "02", schedulingEligible: false }),
    review("again", { attemptId: "01" }),
  ];
  expect(rebuild(log).get(card.id)).toMatchObject({
    reps: 1,
    lapses: 1,
    ease: 2.3,
    intervalDays: 1,
  });
  expect(rebuild(log)).toEqual(rebuild(log.slice().reverse()));
});
it("uses local 04:00 boundaries, including DST and reviews before 04:00", () => {
  expect(dayStart(new Date(2026, 9, 25, 3, 59).getTime())).toBe(
    new Date(2026, 9, 24, 4).getTime(),
  );
  expect(dayStart(new Date(2026, 9, 25, 4).getTime())).toBe(
    new Date(2026, 9, 25, 4).getTime(),
  );
  const before = new Date(2026, 9, 25, 2).getTime();
  expect(transition(undefined, review("good", { at: before })).due).toBe(
    new Date(2026, 9, 25, 4).getTime(),
  );
});
it("records every attempt but schedules only the first card attempt per session, replaying deterministically", async () => {
  const logStore = new MemoryProgress();
  const store = new Scheduler(() => [card], logStore);
  expect(await store.due(at)).toHaveLength(1);
  await store.record(review("again"));
  await store.record(review("good", { attemptId: "02" }));
  const log = logStore.reviews();
  expect(log.map((r) => r.schedulingEligible)).toEqual([true, false]);
  expect(rebuild(log).get(card.id)?.lapses).toBe(1);
  expect(rebuild(log.slice().reverse())).toEqual(rebuild(log));
  expect(await store.due(at)).toHaveLength(0);
  expect(await store.due(new Date(2026, 9, 26, 4).getTime())).toHaveLength(1);
  await store.record(
    review("easy", {
      attemptId: "03",
      sessionId: "other",
      context: "woodpecker",
    }),
  );
  expect(rebuild(logStore.reviews())).toEqual(rebuild(log));
});

it("ignores a non-eligible retry dated before the eligible attempt", () => {
  expect(
    rebuild([
      review("again", { at: at + 100, attemptId: "first" }),
      review("good", {
        at: at - 100,
        attemptId: "retry",
        schedulingEligible: false,
      }),
    ]).get(card.id),
  ).toMatchObject({ lapses: 1, reps: 0 });
});
it("rounds good before the easy bonus and keeps decimal ease exact", () => {
  expect(
    transition({ ...state, intervalDays: 5 }, review("good")).intervalDays,
  ).toBe(13);
  expect(
    transition({ ...state, intervalDays: 5 }, review("easy")).intervalDays,
  ).toBe(17);
  let next: SrsState | undefined;
  for (const grade of ["again", "good", "easy", "good", "good"] as const)
    next = transition(next, review(grade));
  expect(next).toMatchObject({
    ease: 2.45,
    intervalDays: 25,
    reps: 4,
    lapses: 1,
  });
});

it("orders actual monotonic ULIDs by code units at the same timestamp", () => {
  const id = monotonicFactory(() => 0);
  const ids = Array.from({ length: 40 }, () => id(at));
  const log = ids.map((attemptId, i) =>
    review(i === 0 ? "again" : "good", { attemptId, sessionId: attemptId }),
  );
  expect(ordered(log.slice().reverse()).map((r) => r.attemptId)).toEqual(ids);
  expect(rebuild(log.slice().reverse())).toEqual(rebuild(log));
  expect(rebuild(log).get(card.id)?.lapses).toBe(1);
});

it("composes a changing card source without binding progress or requiring puzzle line context", async () => {
  const progress = new MemoryProgress();
  let cards: import("../repertoire/types").Card[] = [
    { id: "puzzle:one", kind: "puzzle" },
  ];
  const scheduler = new Scheduler(() => cards, progress);
  expect(await scheduler.due(at)).toHaveLength(1);
  await scheduler.record({
    ...review("again"),
    cardId: "puzzle:one",
    context: "puzzle",
    lineId: undefined,
  });
  expect(await scheduler.due(at)).toHaveLength(0);
  cards = [{ id: "mistake:white:new", kind: "mistake", side: "white" }];
  expect((await scheduler.due(at))[0].id).toBe("mistake:white:new");
});

it("caps long clean streaks at ten years instead of producing an invalid due date", () => {
  let state: SrsState | undefined;
  for (let i = 0; i < 60; i++) state = transition(state, review("easy"));
  expect(state!.intervalDays).toBe(3650);
  expect(Number.isFinite(state!.due)).toBe(true);
});
