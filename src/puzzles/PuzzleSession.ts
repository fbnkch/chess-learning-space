import { Chess } from "chess.js";
import { Game } from "../game/Game";
import type { PuzzleRow } from "./types";
import { motifs } from "./types";
import { motifLabel } from "./data";
export type PuzzlePhase =
  | "setup"
  | "solving"
  | "reply"
  | "solved"
  | "failed"
  | "replay"
  | "reviewed";
/** No timers, storage or engine: the caller animates one automatic ply at a time. */
export class PuzzleSession {
  game: Game;
  phase: PuzzlePhase = "setup";
  readonly side: "white" | "black";
  readonly moves: string[];
  private cursor = 0;
  hintsUsed = 0;
  hintStep = 0;
  hint(): string | null {
    if (this.phase !== "solving") return null;
    if (this.hintStep < 2) {
      this.hintStep++;
      // The first hint ends the rated/SRS attempt. Later steps only reveal data.
      this.hintsUsed = 1;
    }
    const move = this.moves[this.cursor];
    if (this.hintStep === 1) {
      const motif = this.puzzle[7]
        .split(" ")
        .find((theme) => motifs.some((m) => m === theme));
      return motif
        ? `Look for ${motifLabel(motif).toLowerCase()}.`
        : `Look at the piece on ${move.slice(0, 2)}.`;
    }
    const game = new Game(this.game.fen);
    return `Play ${game.play(move).san} (${move.slice(0, 2)} → ${move.slice(2, 4)}).`;
  }
  constructor(readonly puzzle: PuzzleRow) {
    this.game = new Game(puzzle[1]);
    this.moves = puzzle[2].split(" ");
    this.side = this.game.turn === "white" ? "black" : "white";
  }
  advance(): void {
    if (!["setup", "reply", "replay"].includes(this.phase)) return;
    const replaying = this.phase === "replay";
    this.game.play(this.moves[this.cursor++]);
    this.hintStep = 0;
    if (replaying) {
      if (this.cursor === this.moves.length) this.phase = "reviewed";
      return;
    }
    const chess = new Chess(this.game.fen);
    if (chess.isStalemate() || chess.isCheckmate()) {
      this.phase = "failed";
      return;
    }
    this.phase = this.cursor === this.moves.length ? "solved" : "solving";
  }
  submit(uci: string): boolean {
    if (this.phase !== "solving") return false;
    const candidate = new Game(this.game.fen);
    try {
      candidate.play(uci);
    } catch {
      return false;
    }
    const chess = new Chess(candidate.fen);
    const final = this.cursor === this.moves.length - 1;
    // As on Lichess, any checkmating move solves the puzzle, at any solver ply.
    const mates = chess.isCheckmate();
    const accepted = uci === this.moves[this.cursor] || mates;
    this.game.play(uci);
    this.hintStep = 0;
    if (!accepted || chess.isStalemate()) {
      this.phase = "failed";
      return false;
    }
    this.cursor++;
    this.phase = final || mates ? "solved" : "reply";
    return true;
  }
  solution(): string[] {
    const g = new Game(this.puzzle[1]);
    return this.moves.map((m) => g.play(m).san);
  }
  replay(): void {
    if (!["failed", "solved", "reviewed"].includes(this.phase)) return;
    this.game = new Game(this.puzzle[1]);
    this.cursor = 0;
    this.phase = "replay";
  }
}
