import { derivedRuleStates } from "./ruleState";
import { expect, it } from "vitest";
import graphs from "virtual:repertoire";
import { Chess } from "chess.js";
import { goldenRules } from "./catalogue";
import { quizItems, gradeAnswer, learnedRuleIds } from "./quiz";
import { eligibleReview, rebuild } from "../scheduler/Scheduler";

it("offers a verifiable example and exactly two choices for every golden rule", () => {
  expect(quizItems).toHaveLength(42);
  expect(new Set(quizItems.map((q) => q.rule.id)).size).toBe(42);
  for (const item of quizItems) {
    expect(item.choices).toHaveLength(2);
    expect(new Set(item.choices.map((r) => r.id)).size).toBe(2);
    expect(item.choices).toContain(item.rule);
    expect(goldenRules).toContain(item.rule);
    const chess = new Chess(item.fen);
    if (item.move) {
      expect(
        Object.values(graphs).some((graph) =>
          Object.values(graph.nodes).some(
            (node) =>
              node.fen === item.fen &&
              node.edges.some(
                (edge) =>
                  edge.uci === item.move &&
                  edge.kind === "ours" &&
                  edge.ruleIds.includes(item.rule.id),
              ),
          ),
        ),
      ).toBe(true);
      expect(chess.move(item.move)).toBeTruthy();
    } else expect(item.fen).toBe(item.rule.exampleFen);
  }
});
it("grades once, never schedules, and derives learned rules only from successful answers", () => {
  const item = quizItems.find((q) => q.rule.id === "castle-early")!;
  const facts = {
    attemptId: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
    sessionId: "quiz",
    at: 1000,
    durationMs: 100,
  };
  const wrong = gradeAnswer(
    item,
    item.choices.find((r) => r.id !== item.rule.id)!.id,
    facts,
  );
  expect(wrong.grade).toBe("again");
  expect(learnedRuleIds([], [wrong])).toEqual([]);
  const correct = gradeAnswer(item, item.rule.id, {
    ...facts,
    attemptId: "01ARZ3NDEKTSV4RRFFQ69G5FAW",
  });
  expect(correct.grade).toBe("good");
  expect(eligibleReview(correct, []).schedulingEligible).toBe(false);
  expect(rebuild([wrong, correct]).size).toBe(0);
  expect(learnedRuleIds([], [wrong, correct])).toEqual(["castle-early"]);
  expect(() => gradeAnswer(item, "unknown", facts)).toThrow();
});

it("honours a later explicit unlearn mark without losing quiz history", () => {
  const item = quizItems[0];
  const answer = gradeAnswer(item, item.rule.id, {
    attemptId: "id",
    sessionId: "quiz",
    at: 1000,
    durationMs: 1,
  });
  const states = [
    { ruleId: item.rule.id, learned: false, learnedAt: null, updatedAt: 2000 },
  ];
  expect(learnedRuleIds(states, [answer])).toEqual([]);
  expect(learnedRuleIds(states, [{ ...answer, at: 3000 }])).toEqual([
    item.rule.id,
  ]);
});

it("uses authored, existing, distinct distractors and explains why they do not apply", () => {
  for (const item of quizItems) {
    expect(item.distractor).toBeTruthy();
    expect(item.distractor).not.toBe(item.rule.id);
    expect(goldenRules.some((rule) => rule.id === item.distractor)).toBe(true);
    expect(goldenRules.some((rule) => rule.id === item.rule.id)).toBe(true);
    expect(item.choices.map((rule) => rule.id)).toContain(item.distractor);
    expect(item.distractorReason?.trim().length).toBeGreaterThan(20);
  }
});

it("never opposes overlapping threat and safety thinking rules", () => {
  const overlapping = new Set([
    "real-not-hope-chess",
    "better-move-safe-first",
    "cct-scan",
    "assume-best-move",
    "ask-opponent-intent",
    "question-your-move",
    "board-vision",
    "count-attackers-defenders",
  ]);
  for (const item of quizItems) {
    if (overlapping.has(item.rule.id))
      expect(
        overlapping.has(item.choices.find((r) => r.id !== item.rule.id)!.id),
      ).toBe(false);
  }
  expect(
    quizItems
      .find((q) => q.rule.id === "attack-pinned-cheaply")!
      .choices.map((r) => r.id),
  ).not.toContain("real-not-hope-chess");
});

it("derives earliest effective learning and latest update regardless of log order", () => {
  const item = quizItems[0];
  const success = gradeAnswer(item, item.rule.id, {
    attemptId: "quiz",
    sessionId: "quiz",
    at: 300,
    durationMs: 1,
  });
  const mark = {
    ruleId: item.rule.id,
    learned: false,
    learnedAt: null,
    updatedAt: 200,
  };
  for (const log of [
    [{ ...success, at: 500 }, success, { ...success, at: 100 }],
    [{ ...success, at: 100 }, success, { ...success, at: 500 }],
  ]) {
    expect(derivedRuleStates([mark], log)).toEqual([
      { ruleId: item.rule.id, learned: true, learnedAt: 300, updatedAt: 500 },
    ]);
  }
  expect(
    derivedRuleStates(
      [{ ...mark, learned: true, learnedAt: 50, updatedAt: 600 }],
      [success],
    ),
  ).toEqual([
    { ruleId: item.rule.id, learned: true, learnedAt: 50, updatedAt: 600 },
  ]);
});

it("shows a real flank attack for the centre-counter rule", () => {
  const item = quizItems.find(
    (q) => q.rule.id === "flank-attack-centre-counter",
  )!;
  // White has pushed g4 on the kingside; Black answers with ...d5.
  expect(item.fen.split(" ")[0]).toContain("2B1P1P1");
  expect(item.fen.split(" ")[1]).toBe("b");
  expect(new Chess(item.fen).move("d5")).toBeTruthy();
});
