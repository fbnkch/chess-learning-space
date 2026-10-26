import { expect, it } from "vitest";
import { compilePgn } from "../repertoire/compiler";
import { Repertoire } from "../repertoire/Repertoire";
import { MemoryProgress, Scheduler } from "../scheduler/Scheduler";
import { OpeningSession } from "./OpeningSession";
import { Game, positionKey } from "../game/Game";
const rep = new Repertoire({
  white: compilePgn(
    "{[%line main]} 1. e4 {Take the centre.} e5 2. Nf3 {Develop the knight.} *",
    "white",
  ),
});
const now = new Date(2026, 9, 25, 12).getTime();
it("locks moves during the contextual prelude, accepts a clean move and emits good", async () => {
  const cards = rep.cards("white");
  const session = new OpeningSession(
    rep,
    [cards[1]],
    "session",
    () => now,
    () => "attempt",
  );
  expect(session.phase).toBe("prelude");
  expect(session.attempt("g1f3")).toBeNull();
  session.advancePrelude();
  session.advancePrelude();
  expect(session.phase).toBe("move");
  const result = session.attempt("g1f3")!;
  expect(result.correct).toBe(true);
  expect(result.review).toMatchObject({
    grade: "good",
    cardId: cards[1].id,
    schedulingEligible: false,
  });
  const store = new MemoryProgress();
  await store.record(result.review);
  expect(await new Scheduler(() => cards, store).due(now)).toHaveLength(1);
});
it("rejects a wrong move, shows the correct move and idea, and records again before retry", () => {
  let id = 0;
  const session = new OpeningSession(
    rep,
    rep.cards("white"),
    "s",
    () => now,
    () => String(++id),
  );
  const fen = session.game.fen;
  const wrong = session.attempt("d2d4")!;
  expect(wrong).toMatchObject({
    correct: false,
    solution: "e2e4",
    idea: "Take the centre.",
    review: { grade: "again", schedulingEligible: false },
  });
  expect(session.game.fen).toBe(fen);
  session.retry();
  expect(session.attempt("e2e4")!.review).toMatchObject({
    grade: "good",
    schedulingEligible: false,
  });
});
it("maps a hint to hard and accepts a different move order reaching a known child", () => {
  const graph = compilePgn(
    "{[%line main]} 1. d4 d5 2. c4 e6 3. Nf3 ({[%line alternative]} 3. Nc3 Nf6 4. Nf3) Nf6 4. Nc3 *",
    "white",
  );
  const repertoire = new Repertoire({ white: graph });
  const key = positionKey(Game.fromPgn("1. d4 d5 2. c4 e6 *").fen);
  const card = repertoire.cards("white").find((c) => c.positionKey === key)!;
  const session = new OpeningSession(
    repertoire,
    [card],
    "s",
    () => now,
    () => "a",
  );
  while (session.phase === "prelude") session.advancePrelude();
  session.hint();
  expect(session.attempt("b1c3")).toMatchObject({
    correct: true,
    review: { grade: "hard", hintsUsed: 1 },
  });
  const first = positionKey(
    Game.fromPgn("1. d4 d5 2. c4 e6 3. Nf3 Nf6 4. Nc3 *").fen,
  );
  const second = positionKey(
    Game.fromPgn("1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. Nf3 *").fen,
  );
  expect(first).toBe(second);
  expect(Object.keys(graph.nodes).filter((key) => key === first)).toHaveLength(
    1,
  );
});

it("uses authored reply weights and an injected seeded random source", () => {
  const repertoire = new Repertoire({
    white: compilePgn(
      "{[%line main]} 1. e4 e5 {[%weight 1]} ( {[%line sicilian]} 1... c5 {[%weight 3]} ) *",
      "white",
    ),
  });
  // LCG seed: first draw is about 0.81, selecting the weight-3 Sicilian.
  let seed = 1234;
  const random = () => (seed = (1664525 * seed + 1013904223) >>> 0) / 2 ** 32;
  const session = new OpeningSession(
    repertoire,
    repertoire.cards("white"),
    "seeded",
    () => now,
    () => "id",
    "repertoire",
    random,
  );
  session.attempt("e2e4");
  expect(session.phase).toBe("reply");
  session.advanceReply();
  expect(session.game.moves).toEqual(["e2e4", "c7c5"]);
});
it("requeues a failed card once and reads eligibility from saved reviews", async () => {
  const store = new MemoryProgress();
  let id = 0;
  const session = new OpeningSession(
    rep,
    [rep.cards("white")[0]],
    "run",
    () => now,
    () => String(++id),
  );
  const failed = session.attempt("d2d4")!;
  session.saved(await store.record(failed.review));
  expect(session.feedback?.review.schedulingEligible).toBe(true);
  expect(session.cards).toHaveLength(2);
  const retry = session.attempt("e2e4")!; // Direct board retry, no retry button.
  session.saved(await store.record(retry.review));
  expect(session.feedback?.review.schedulingEligible).toBe(false);
  session.advanceReply();
  session.next();
  const repeated = session.attempt("e2e4")!;
  session.saved(await store.record(repeated.review));
  expect(session.feedback?.review.schedulingEligible).toBe(false);
  expect(session.summary).toEqual({ attempts: 3, correct: 2, again: 1 });
});
it("Practice recalls the whole line without hints and only a clean run emits completion", async () => {
  let id = 0;
  const run = (sessionId: string) =>
    new OpeningSession(
      rep,
      rep.cards("white"),
      sessionId,
      () => now,
      () => String(++id),
      "practice",
    );
  const store = new MemoryProgress();
  const failed = run("failed");
  expect(failed.hint()).toBe("");
  expect(failed.attempt("d2d4")?.idea).toBe("Take the centre.");
  failed.saved(await store.record(failed.feedback!.review));
  failed.attempt("e2e4");
  failed.saved(await store.record(failed.feedback!.review));
  failed.advanceReply();
  failed.next();
  expect(failed.phase).toBe("move");
  expect(failed.game.moves).toEqual(["e2e4", "e7e5"]);
  expect(failed.attempt("g1f3")?.review.lineCompleted).not.toBe(true);
  expect(failed.cards).toHaveLength(2);
  failed.reset();
  expect(failed.summary.again).toBe(0);
  failed.attempt("e2e4");
  failed.advanceReply();
  failed.next();
  expect(failed.attempt("g1f3")?.review.lineCompleted).toBe(true);
  const clean = run("clean");
  clean.attempt("e2e4");
  clean.advanceReply();
  clean.next();
  const last = clean.attempt("g1f3")!;
  expect(last.review.lineCompleted).toBe(true);
  expect((await store.record(last.review)).schedulingEligible).toBe(false);
  clean.reset();
  expect(clean.attempt("e2e4")?.review.lineCompleted).not.toBe(true);
});

it("drills due cards in the supplied weakest-line priority without changing eligibility", async () => {
  const cards = rep.cards("white");
  const scheduler = new Scheduler(() => cards, new MemoryProgress());
  const session = await OpeningSession.due(
    rep,
    scheduler,
    "priority",
    () => now,
    () => "attempt",
    (card) => (card.id === cards[1].id ? 0 : 1),
  );
  expect(session.cards.map((card) => card.id)).toEqual([
    cards[1].id,
    cards[0].id,
  ]);
});

it("caps the two hint steps and ignores hints after the move is decided", () => {
  const session = new OpeningSession(
    rep,
    rep.cards("white"),
    "s",
    () => now,
    () => "a",
  );
  const first = session.hint();
  // Step 1 never shows the authored comment or the move itself.
  expect(first).not.toContain("Take the centre");
  expect(first).not.toContain("e4");
  expect(first).toContain("e2");
  expect(session.hint()).toContain("e4");
  session.hint();
  expect(session.hintsUsed).toBe(2);
  const attempt = session.attempt("e2e4")!;
  session.hint();
  expect(attempt.review).toMatchObject({ grade: "hard", hintsUsed: 2 });
  expect(session.hintsUsed).toBe(2);
});
