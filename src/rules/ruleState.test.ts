import { describe, expect, it } from "vitest";
import { mergeRuleStates, type RuleState } from "./ruleState";

const state = (
  ruleId: string,
  learned: boolean,
  learnedAt: number | null = null,
): RuleState => ({ ruleId, learned, learnedAt, updatedAt: 0 });

describe("rule state merge", () => {
  it("retains the latest edit timestamp independently of the earliest learned time", () => {
    expect(
      mergeRuleStates(
        [{ ruleId: "cct-scan", learned: true, learnedAt: 3, updatedAt: 9 }],
        [
          {
            ruleId: "cct-scan",
            learned: false,
            learnedAt: null,
            updatedAt: 12,
          },
        ],
      ),
    ).toEqual([
      { ruleId: "cct-scan", learned: true, learnedAt: 3, updatedAt: 12 },
    ]);
  });

  it("keeps a rule learned when either copy learned it", () => {
    expect(
      mergeRuleStates(
        [state("castle-early", false)],
        [state("castle-early", true, 5)],
      ),
    ).toEqual([state("castle-early", true, 5)]);
    expect(
      mergeRuleStates(
        [state("castle-early", true, 3)],
        [state("castle-early", false)],
      ),
    ).toEqual([state("castle-early", true, 3)]);
  });

  it("keeps the earliest learned time and ignores unlearned times", () => {
    expect(
      mergeRuleStates(
        [state("cct-scan", true, 9)],
        [state("cct-scan", true, 4)],
      ),
    ).toEqual([state("cct-scan", true, 4)]);
    expect(
      mergeRuleStates([state("cct-scan", false)], [state("cct-scan", false)]),
    ).toEqual([state("cct-scan", false, null)]);
  });

  it("is a union by rule ID", () => {
    expect(
      mergeRuleStates(
        [state("castle-early", true, 1)],
        [state("cct-scan", true, 2)],
      ),
    ).toEqual([state("cct-scan", true, 2), state("castle-early", true, 1)]);
  });
});
