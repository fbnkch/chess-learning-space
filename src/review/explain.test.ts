import { expect, it } from "vitest";
import { Game } from "../game/Game";
import { explain } from "./explain";
import { goldenRules } from "../rules/catalogue";

it("handles missed mate from Black's perspective", () => {
  const g = Game.fromPgn("1. f3 e5 2. g4 *");
  const findings = explain(g.fen, "b8c6", {
    best: { uci: ["d8h4"], mate: -1, winner: -1, depth: 12 },
    played: { uci: ["e2e4"], cp: 0, depth: 12 },
  });
  expect(findings.map((f) => f.motif)).toContain("missed-mate");
});

it("proves allowed mate with legal squares and a replayable line", () => {
  const g = Game.fromPgn("1. f3 e5 2. g4 *");
  const move = g.notation[2];
  const result = explain(move.before, "g2g4", {
    best: { uci: ["e2e4"], cp: 0, depth: 12 },
    played: { uci: ["d8h4"], mate: -1, winner: -1, depth: 12 },
  });
  expect(
    result.some((f) => f.motif === "allowed-mate" && f.squares.includes("h4")),
  ).toBe(true);
  for (const finding of result) {
    const replay = new Game(finding.fen);
    finding.line.forEach((m) => replay.play(m));
    expect(goldenRules.some((r) => r.id === finding.ruleId)).toBe(true);
  }
});

it("reports material loss only at a settled legal PV endpoint", () => {
  const fen = "r6k/8/8/8/8/8/7P/Q3K3 w - - 0 1";
  const best = { uci: ["a1a8"], cp: 400, depth: 12 };
  const proof = ["a8a1", "e1f2", "h8h7"];
  const findings = explain(fen, "h2h3", {
    best,
    played: { uci: proof, cp: -500, depth: 12 },
  });
  expect(findings.map((f) => f.motif)).toContain("hanging-piece");
  expect(findings.find((f) => f.motif === "material-loss")?.text).toContain(
    "9 points",
  );
  // A sacrifice with compensation is not a hanging-piece explanation.
  expect(
    explain(fen, "h2h3", {
      best,
      played: { uci: proof, cp: 300, depth: 12 },
    }).map((f) => f.motif),
  ).not.toContain("material-loss");
  // An incomplete exchange is not proof of net loss.
  expect(
    explain(fen, "h2h3", {
      best,
      played: { uci: proof.slice(0, 1), cp: -500, depth: 12 },
    }).map((f) => f.motif),
  ).not.toContain("hanging-piece");
});

it("rejects a pinned attacker's illegal PV and falls back to neutral engine facts", () => {
  const findings = explain("4k3/3Qr3/8/8/8/8/7P/4R1K1 w - - 0 1", "h2h3", {
    best: { uci: ["d7e7"], cp: 500, depth: 12 },
    played: { uci: ["e7d7", "g1h1", "e8f8"], cp: -100, depth: 12 },
  });
  expect(findings.map((f) => f.motif)).toEqual(["engine"]);
});

it.each([
  [
    "1q5k/r7/8/4N3/8/8/7P/7K w - - 0 1",
    ["e5c6", "h8h7", "c6b8"],
    "missed-fork",
  ],
  [
    "3q3k/8/8/3n4/8/8/8/R5K1 w - - 0 1",
    ["a1d1", "d5f4", "d1d8", "h8h7"],
    "missed-pin",
  ],
  [
    "3r3k/8/8/3q4/8/8/8/R5K1 w - - 0 1",
    ["a1d1", "d5e5", "d1d8", "h8h7"],
    "missed-skewer",
  ],
  [
    "3r4/8/8/3k4/8/8/8/R5K1 w - - 0 1",
    ["a1d1", "d5e5", "d1d8"],
    "missed-skewer",
  ],
])(
  "proves tactical alignment with an actual follow-up capture: %s",
  (fen, line, motif) => {
    const findings = explain(fen, "g1h1", {
      best: { uci: line as string[], cp: 500, depth: 12 },
      played: { uci: [], cp: 0, depth: 12 },
    });
    expect(findings.map((f) => f.motif)).toContain(motif);
    for (const f of findings) {
      const g = new Game(f.fen);
      f.line.forEach((m) => g.play(m));
    }
  },
);
