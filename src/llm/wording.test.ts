import { describe, expect, it } from "vitest";
import { buildFacts, buildPrompt, validateWording } from "./wording";
import type { Finding } from "../review/explain";
import { DEFAULT_POSITION } from "chess.js";
const finding: Finding = {
  motif: "engine",
  text: "Better was e4; evaluation -1.5 pawns.",
  ruleId: "assume-best-move",
  fen: DEFAULT_POSITION,
  line: ["e2e4", "e7e5", "g1f3"],
  squares: ["e2", "e4"],
};
describe("wording facts and validation", () => {
  it("passes verified structured facts without a game, position or credentials", () => {
    const facts = buildFacts("Blunder", [finding], DEFAULT_POSITION, [
      "e2e4",
      "e7e5",
      "g1f3",
    ]);
    expect(facts.bestMove).toBe("e4");
    expect(facts.pv).toEqual(["e4", "e5", "Nf3"]);
    expect(buildPrompt(facts)).not.toContain(DEFAULT_POSITION);
    expect(buildPrompt(facts)).toContain("plain English");
    expect(() =>
      buildFacts(
        "Blunder",
        [{ ...finding, line: ["e2e5"] }],
        DEFAULT_POSITION,
        [],
      ),
    ).toThrow();
  });
  it("rejects invented moves, squares, numbers and rule IDs", () => {
    const facts = buildFacts("Blunder", [finding], DEFAULT_POSITION, [
      "e2e4",
      "e7e5",
      "g1f3",
    ]);
    expect(
      validateWording(
        '{"text":"Try e4, then e5 and Nf3. Evaluation -1.5 pawns."}',
        facts,
      ),
    ).toContain("Try e4");
    for (const text of [
      "Try Qh4.",
      "Try d4.",
      "Use e2e5.",
      "Mate in 7.",
      "Mate in seven.",
      "Try nf3.",
      "Try E4.",
      "Follow invented-rule.",
      "Play O-O.",
      "Play Nf3+.",
      "Move the queen to e4.",
      "Move the king to f3.",
      "Play ♛e4.",
      "Play Ｑｅ４.",
      "Play еe4 now.",
      "Castle kingside.",
      "Put the knight on e4.",
      "Queen takes on e4.",
      "Capture with the queen on e4.",
      "King-side castling is good.",
      "Short castling is good.",
      "Long castle now.",
      "The queen can go to e4.",
      "Qxe4.",
      "Nf-3.",
    ]) {
      expect(validateWording(JSON.stringify({ text }), facts)).toBeNull();
    }
    // Written-out references to verified moves stay acceptable.
    expect(
      validateWording(
        '{"text":"Develop the knight to f3 after e4 and e5."}',
        facts,
      ),
    ).toContain("knight to f3");
    expect(
      validateWording('{"text":"Push the pawn to e4 now."}', facts),
    ).toContain("pawn to e4");
    // The verified move written with a piece word or as from-to squares is fine.
    for (const text of [
      "Knight f3 is the idea.",
      "The KNIGHT goes to f3.",
      "Play e2 to e4.",
    ])
      expect(validateWording(JSON.stringify({ text }), facts)).toBe(text);
    expect(validateWording("not JSON", facts)).toBeNull();
  });
});
