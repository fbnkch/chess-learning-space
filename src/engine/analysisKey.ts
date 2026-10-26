import { Game } from "../game/Game";
import type { Position } from "./types";

/** ADR-0001: preserve counters and repetition history; never use positionKey. */
export function analysisKey(position: Position): string {
  const game = new Game(position.startFen);
  let recent: string[] = [];
  for (const uci of position.moves) {
    const move = game.play(uci);
    if (move.piece === "p" || move.captured) recent = [];
    else recent.push(uci);
  }
  // FNV-1a 64-bit: stable browser-only history fingerprint.
  let hash = 0xcbf29ce484222325n;
  for (const char of recent.join(" "))
    hash = BigInt.asUintN(
      64,
      (hash ^ BigInt(char.charCodeAt(0))) * 0x100000001b3n,
    );
  return `${game.fen}|${hash.toString(16)}`;
}
