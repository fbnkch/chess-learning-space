import { goldenRules } from "./catalogue";
import type { Review } from "../scheduler/Scheduler";

/** ADR-0003: a rule is learned once it has been learned anywhere. */
export interface RuleState {
  ruleId: string;
  learned: boolean;
  learnedAt: number | null;
  updatedAt: number;
}

export function mergeRuleStates(
  local: RuleState[],
  incoming: RuleState[],
): RuleState[] {
  const merged = new Map<string, RuleState>();
  for (const state of [...incoming, ...local]) {
    const previous = merged.get(state.ruleId);
    if (!previous) {
      merged.set(state.ruleId, state);
      continue;
    }
    const learned = previous.learned || state.learned;
    const times = [previous.learnedAt, state.learnedAt].filter(
      (at): at is number => at !== null,
    );
    merged.set(state.ruleId, {
      ruleId: state.ruleId,
      learned,
      updatedAt: Math.max(previous.updatedAt, state.updatedAt),
      learnedAt: learned && times.length ? Math.min(...times) : null,
    });
  }
  return [...merged.values()];
}

/** A read model only: later local unlearn marks suppress earlier quiz successes. */
export function derivedRuleStates(
  states: readonly RuleState[],
  log: readonly Review[],
): RuleState[] {
  const result = new Map(states.map((state) => [state.ruleId, { ...state }]));
  const known = new Set(goldenRules.map((rule) => rule.id));
  for (const review of log) {
    const match = /^rule:([a-z0-9-]+):example-v1$/.exec(review.cardId);
    if (
      review.context !== "rule-quiz" ||
      review.grade !== "good" ||
      !match ||
      !known.has(match[1])
    )
      continue;
    // Consult the original explicit mark, independent of review iteration order.
    const explicit = states.find((state) => state.ruleId === match[1]);
    if (explicit && !explicit.learned && explicit.updatedAt >= review.at)
      continue;
    const previous = result.get(match[1]);
    result.set(match[1], {
      ruleId: match[1],
      learned: true,
      learnedAt: Math.min(previous?.learnedAt ?? review.at, review.at),
      updatedAt: Math.max(previous?.updatedAt ?? review.at, review.at),
    });
  }
  return [...result.values()];
}
