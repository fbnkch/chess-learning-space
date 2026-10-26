import { quizDistractors } from "./quizDistractors";
import { goldenRules, type GoldenRule } from "./catalogue";
import graphs from "virtual:repertoire";
import type { Review } from "../scheduler/Scheduler";
import { derivedRuleStates, type RuleState } from "./ruleState";

export interface QuizItem {
  id: string;
  rule: GoldenRule;
  fen: string;
  move?: string;
  idea: string;
  distractor: string;
  distractorReason: string;
  choices: GoldenRule[];
}

/**
 * Rules whose first tagged repertoire edge does not show the rule clearly on
 * its own (e.g. a central break with no flank attack on the board) use the
 * catalogue's authored example instead.
 */
const catalogueExampleRules = new Set(["flank-attack-centre-counter"]);

/** Only authored examples and tagged repertoire edges supply chess facts. */
export const quizItems: QuizItem[] = goldenRules.map((rule, index) => {
  const example = catalogueExampleRules.has(rule.id)
    ? undefined
    : Object.values(graphs).flatMap((graph) =>
        Object.values(graph.nodes).flatMap((node) =>
          node.edges
            .filter(
              (edge) => edge.kind === "ours" && edge.ruleIds.includes(rule.id),
            )
            .map((edge) => ({
              fen: node.fen,
              move: edge.uci,
              idea: edge.comment,
              ruleIds: edge.ruleIds,
            })),
        ),
      )[0];
  const authored = quizDistractors[rule.id];
  const distractor = goldenRules.find(
    (candidate) => candidate.id === authored.distractor,
  )!;
  return {
    id: `rule:${rule.id}:example-v1`,
    rule,
    ...authored,
    fen: example?.fen ?? rule.exampleFen,
    move: example?.move,
    idea: example?.idea || rule.exampleText || rule.reason,
    choices: index % 2 ? [distractor, rule] : [rule, distractor],
  };
});

export function gradeAnswer(
  item: QuizItem,
  selectedRuleId: string,
  facts: Pick<Review, "attemptId" | "sessionId" | "at" | "durationMs">,
): Review {
  if (!item.choices.some((choice) => choice.id === selectedRuleId))
    throw new Error("Choose one of the two rules.");
  return {
    ...facts,
    cardId: item.id,
    context: "rule-quiz",
    grade: selectedRuleId === item.rule.id ? "good" : "again",
    hintsUsed: 0,
    schedulingEligible: false,
  };
}

/** Successful quiz answers supplement explicit learned marks; failures never erase them. */
export function learnedRuleIds(
  states: readonly RuleState[],
  log: readonly Review[],
): string[] {
  return derivedRuleStates(states, log)
    .filter((state) => state.learned)
    .map((state) => state.ruleId);
}
