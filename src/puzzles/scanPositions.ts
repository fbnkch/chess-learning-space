import { Game, positionKey } from "../game/Game";
import {
  eligiblePosition,
  generateScan,
  newThreats,
  seededShuffle,
  type ScanMode,
  type ScanPosition,
} from "../threats/scan";
import type { PuzzleRow } from "./types";

/** Adapter only: the Threat Scan ground truth stays in threats/scan. */
export function puzzleScanPositions(
  rows: readonly PuzzleRow[],
  mode: ScanMode = "scan",
): ScanPosition[] {
  const positions = new Map<string, ScanPosition>();
  for (const row of rows) {
    const game = new Game(row[1]);
    game.play(row[2].split(" ")[0]);
    if (game.check) continue;
    const required =
      mode === "changed"
        ? newThreats(row[1], game.fen)
        : generateScan(game.fen).marks;
    const key = positionKey(game.fen);
    if (eligiblePosition(required) && !positions.has(key))
      positions.set(key, {
        side: game.turn,
        fen: game.fen,
        key,
        title: `Puzzle ${row[0]} · ${row[3]} · Lichess`,
        required,
        before: mode === "changed" ? row[1] : undefined,
        lastMove: game.lastMove,
      });
  }
  return seededShuffle([...positions.values()], 9);
}
