import { Chess } from "chess.js";
import { Game } from "../game/Game";
import type { Line } from "../engine/types";
import type { Side } from "../repertoire/types";

export const COACH_VERSION = "adr-0004-v1";
export type Classification =
  | "Book"
  | "Brilliant"
  | "Great"
  | "Miss"
  | "Best"
  | "Excellent"
  | "Good"
  | "Inaccuracy"
  | "Mistake"
  | "Blunder";
export type Evaluation = Pick<Line, "cp" | "mate"> & { winner?: 1 | -1 };
export function expectedPoints(score: Evaluation, mover: Side): number {
  if (score.mate !== undefined) {
    if (score.winner === undefined) throw new Error("Mate requires a winner");
    return (score.winner === 1) === (mover === "white") ? 1 : 0;
  }
  if (score.cp === undefined || !Number.isFinite(score.cp))
    throw new Error("Missing engine score");
  const cp = Math.max(
    -1000,
    Math.min(1000, score.cp * (mover === "white" ? 1 : -1)),
  );
  return 1 / (1 + Math.exp(-0.00368208 * cp));
}

export interface ClassificationInput {
  epBest: number;
  epPlayed: number;
  epSecond?: number;
  book?: boolean;
  sacrifice?: boolean;
  playedBest?: boolean;
  previous?: Classification;
  mateForBefore?: boolean;
  mateForAfter?: boolean;
}
/** First matching rule wins; all expected points must already be mover-relative. */
export function classify(input: ClassificationInput): Classification {
  const { epBest, epPlayed, epSecond } = input;
  const loss = Math.max(0, epBest - epPlayed);
  // Decimal threshold subtraction can cross a boundary by a few ULPs.
  const epsilon = 4 * Number.EPSILON;
  const within = (limit: number) => loss <= limit + epsilon;
  if (input.book) return "Book";
  if (within(0.02) && input.sacrifice && epPlayed >= 0.5 && epBest <= 0.9)
    return "Brilliant";
  if (
    within(0.02) &&
    epSecond !== undefined &&
    epBest - epSecond + epsilon >= 0.1
  )
    return "Great";
  if (
    ((input.previous === "Mistake" || input.previous === "Blunder") &&
      epBest >= 0.7 &&
      epPlayed <= 0.5) ||
    (input.mateForBefore && !input.mateForAfter)
  )
    return "Miss";
  if (input.playedBest || loss === 0) return "Best";
  if (within(0.02)) return "Excellent";
  if (within(0.05)) return "Good";
  if (within(0.1)) return "Inaccuracy";
  if (within(0.2)) return "Mistake";
  return "Blunder";
}

const value = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
function balance(fen: string, mover: Side) {
  const color = mover === "white" ? "w" : "b";
  return new Chess(fen)
    .board()
    .flat()
    .reduce(
      (sum, p) => sum + (p ? value[p.type] * (p.color === color ? 1 : -1) : 0),
      0,
    );
}
/** Replay legal exchanges, counting both sides and promotions. Never infer beyond the PV. */
export function provesSacrifice(
  beforeFen: string,
  playedPv: readonly string[],
  mover: Side,
): boolean {
  const pv = playedPv.slice(0, 8);
  if (pv.length < 4) return false;
  const game = new Game(beforeFen);
  const initial = balance(beforeFen, mover);
  let dropped = false;
  try {
    for (const move of pv) {
      game.play(move);
      if (initial - balance(game.fen, mover) >= 2) dropped = true;
    }
    return dropped && initial - balance(game.fen, mover) >= 2;
  } catch {
    return false;
  }
}
