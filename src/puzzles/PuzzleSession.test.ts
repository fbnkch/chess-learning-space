import { describe, it, expect } from "vitest";
import { PuzzleSession } from "./PuzzleSession";
import type { PuzzleRow } from "./types";
import { readFileSync } from "node:fs";
// Original row from the Lichess database documentation.
export const realPuzzle: PuzzleRow = [
  "00sO1",
  "1k1r4/pp3pp1/2p1p3/4b3/P3n1P1/8/KPP2PN1/3rBR1R b - - 2 31",
  "b8c7 e1a5 b7b6 f1d1",
  998,
  85,
  94,
  293,
  "advantage discoveredAttack master middlegame short",
  "https://lichess.org/vsfFkG0s/black#62",
  "",
];
describe("Puzzle Session", () => {
  it("offers motif then solution data, resets the step on position change, but freezes hint usage after the first hint decides the attempt", () => {
    const session = new PuzzleSession(realPuzzle);
    expect(session.hint()).toBeNull();
    session.advance();
    expect(session.hint()).toBe("Look for discovered attack.");
    expect(session.hint()).toContain("e1 → a5");
    expect(session.hintsUsed).toBe(1);
    session.submit("e1a5");
    expect(session.hintStep).toBe(0);
    session.advance();
    expect(session.hint()).toBe("Look for discovered attack.");
    expect(session.hintsUsed).toBe(1);
  });
  it("ignores the fifty-move clock while solving, as required by ADR-0001", () => {
    const row: PuzzleRow = [...realPuzzle];
    row[1] = row[1].replace("2 31", "150 31");
    const s = new PuzzleSession(row);
    s.advance();
    s.submit("e1a5");
    s.advance();
    s.submit("f1d1");
    expect(s.phase).toBe("solved");
  });
  it("accepts a different final mating move in a real mate puzzle", () => {
    const row: PuzzleRow = JSON.parse(
      readFileSync("public/puzzles/mateIn1.json", "utf8"),
    ).find((r: PuzzleRow) => r[0] === "00DPQ");
    const s = new PuzzleSession(row);
    s.advance();
    expect(s.submit("h8h2")).toBe(true);
    expect(s.phase).toBe("solved");
  });
  it("accepts a mating move on an earlier solver ply, as Lichess does", () => {
    const s = new PuzzleSession([
      "early-mate",
      "6k1/5ppp/8/8/8/8/5PPP/R5K1 b - - 0 1",
      "g8h8 a1a7 h7h6 a7a8",
      1000,
      80,
      90,
      100,
      "advantage long",
      "",
      "",
    ]);
    s.advance();
    expect(s.submit("a1a8")).toBe(true);
    expect(s.phase).toBe("solved");
  });
  it("treats stalemate as failure even on the expected final move", () => {
    const s = new PuzzleSession([
      "stalemate",
      "1k6/2Q5/2K5/8/8/8/8/8 b - - 0 1",
      "b8a8 c7b6",
      1000,
      80,
      90,
      100,
      "mateIn1",
      "",
      "",
    ]);
    s.advance();
    s.submit("c7b6");
    expect(s.phase).toBe("failed");
  });
  it("plays setup before solver input and forced replies before completion", () => {
    const s = new PuzzleSession(realPuzzle);
    expect(s.side).toBe("white");
    expect(s.phase).toBe("setup");
    expect(s.submit("e1a5")).toBe(false);
    s.advance();
    expect(s.game.lastMove).toEqual(["b8", "c7"]);
    expect(s.submit("e1a5")).toBe(true);
    expect(s.phase).toBe("reply");
    s.advance();
    expect(s.game.lastMove).toEqual(["b7", "b6"]);
    s.submit("f1d1");
    expect(s.phase).toBe("solved");
  });
  it("fails a wrong legal move and replays the complete solution", () => {
    const s = new PuzzleSession(realPuzzle);
    s.advance();
    s.submit("a4a5");
    expect(s.phase).toBe("failed");
    s.replay();
    while (s.phase === "replay") s.advance();
    expect(s.phase).toBe("reviewed");
    expect(s.game.lastMove).toEqual(["f1", "d1"]);
  });
  it("silently rejects illegal input without failing", () => {
    const s = new PuzzleSession(realPuzzle);
    s.advance();
    expect(s.submit("a1a8")).toBe(false);
    expect(s.phase).toBe("solving");
  });
});
