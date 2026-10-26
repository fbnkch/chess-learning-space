import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { Game, positionKey } from "../game/Game";
import { puzzleScanPositions } from "./scanPositions";
import { generateScan } from "../threats/scan";
import type { PuzzleRow } from "./types";
it("adapts positions after setup, preserving the existing 1–12-mark and no-check filters", () => {
  const rows: PuzzleRow[] = JSON.parse(
    readFileSync("public/puzzles/fork.json", "utf8"),
  ).slice(0, 25);
  const positions = puzzleScanPositions(rows);
  expect(positions.length).toBeGreaterThan(0);
  for (const p of positions) {
    expect(new Game(p.fen).check).toBe(false);
    expect(p.required.length).toBeGreaterThanOrEqual(1);
    expect(p.required.length).toBeLessThanOrEqual(12);
    expect(p.required).toEqual(generateScan(p.fen).marks);
    expect(
      rows.some((r) => {
        const g = new Game(r[1]);
        g.play(r[2].split(" ")[0]);
        return positionKey(g.fen) === p.key;
      }),
    ).toBe(true);
  }
});
