import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { Chess } from "chess.js";
import { Game } from "../game/Game";
import { motifs, type PuzzleManifest, type PuzzleRow } from "./types";
const manifest: PuzzleManifest = JSON.parse(
  readFileSync("public/puzzles/manifest.json", "utf8"),
);
describe("Curated Lichess snapshot", () => {
  it("has exact manifest counts, original motifs, quality filters, no duplicates, and legal solutions", () => {
    const ids = new Set<string>();
    expect(manifest.droppedMotifs).toEqual(["overloading"]);
    expect(manifest.chunks.map((c) => c.motif)).toEqual(
      motifs.filter((m) => !manifest.droppedMotifs.includes(m)),
    );
    for (const chunk of manifest.chunks) {
      const rows: PuzzleRow[] = JSON.parse(
        readFileSync(`public/puzzles/${chunk.file}`, "utf8"),
      );
      expect(rows.length).toBe(chunk.count);
      expect(manifest.counts[chunk.motif]).toBe(rows.length);
      expect(rows.length).toBeGreaterThanOrEqual(300);
      for (const row of rows) {
        if (ids.has(row[0])) throw Error(`Duplicate ${row[0]}`);
        ids.add(row[0]);
        if (
          row[3] < 600 ||
          row[3] > 1700 ||
          row[4] > 100 ||
          row[5] < 80 ||
          row[6] < 100 ||
          !row[7].split(" ").includes(chunk.motif)
        )
          throw Error(`Bad quality/motif: ${row[0]}`);
        const game = new Game(row[1]);
        const moves = row[2].split(" ");
        if (moves.length < 2 || moves.length % 2 !== 0)
          throw Error(`Invalid solution length: ${row[0]}`);
        for (const move of moves) {
          try {
            game.play(move);
          } catch (error) {
            throw Error(`Illegal solution ${row[0]}: ${move}`, {
              cause: error,
            });
          }
        }
        if (new Chess(game.fen).isStalemate())
          throw Error(`Stalemate solution: ${row[0]}`);
      }
    }
    expect(ids.size).toBe(manifest.total);
    expect(ids.size).toBeGreaterThanOrEqual(49000);
  }, 120000);
});
