import { Chess } from "chess.js";
import { Game, positionKey } from "../game/Game";
import { AnalysisCache } from "../engine/AnalysisCache";
import type { Analysis, Budget, Engine, Line } from "../engine/types";
import {
  classify,
  COACH_VERSION,
  expectedPoints,
  provesSacrifice,
  type Classification,
} from "./classify";
import { gameAccuracy } from "./accuracy";
import type { Side } from "../repertoire/types";

export interface ReviewedMove {
  ply: number;
  side: Side;
  classification: Classification;
  best: Line;
  played: Line;
  loss: number;
}
export interface GameReview {
  coachVersion: string;
  moves: ReviewedMove[];
  evaluations: Line[];
  accuracy: Record<Side, number | null>;
}
export const REVIEW_BUDGET: Budget = {
  depth: 12,
  multipv: 2,
  priority: "background",
};

/** Post-game use case; it is never called by move submission or live board events. */
export class Review {
  private engine: Engine;
  constructor(
    engine: Engine,
    private book: (key: string) => boolean,
    private budget = REVIEW_BUDGET,
    storage?: Pick<Storage, "getItem" | "setItem">,
  ) {
    if (budget.multipv < 2) throw new Error("Review requires MultiPV >= 2");
    this.engine = new AnalysisCache(engine, storage);
  }
  async analyse(
    game: Game,
    signal?: AbortSignal,
    progress: (done: number, total: number) => void = () => {},
  ): Promise<GameReview> {
    const replay = new Game(game.startFen);
    const chess = new Chess(game.startFen);
    const start = replay.turn;
    const analyses: Analysis[] = [];
    const notation = game.notation;
    for (let ply = 0; ply <= game.moves.length; ply++) {
      signal?.throwIfAborted();
      let result: Analysis;
      // Stalemate and dead positions always end the game. Threefold and the
      // fifty-move rule only end it where the game actually stopped; earlier
      // they are optional claims, so the engine analyses the position normally.
      const terminal =
        chess.isCheckmate() ||
        chess.isStalemate() ||
        chess.isInsufficientMaterial() ||
        (ply === game.moves.length && chess.isDraw());
      if (chess.isCheckmate())
        result = {
          complete: true,
          lines: [
            {
              uci: [],
              depth: 0,
              mate: 0,
              winner: chess.turn() === "w" ? -1 : 1,
            },
          ],
        };
      else if (terminal)
        result = { complete: true, lines: [{ uci: [], depth: 0, cp: 0 }] };
      else
        result = await this.engine.analyse(
          { startFen: game.startFen, moves: game.moves.slice(0, ply) },
          this.budget,
          signal,
        );
      signal?.throwIfAborted();
      const required = Math.min(this.budget.multipv, chess.moves().length);
      if (
        !result.complete ||
        !result.lines.length ||
        (!terminal && result.lines.length < required)
      )
        throw new Error(
          "Incomplete engine analysis. Resume to retry this position.",
        );
      analyses.push(result);
      progress(ply + 1, game.moves.length + 1);
      if (ply < game.moves.length) {
        const move = replay.play(game.moves[ply]);
        chess.move({ from: move.from, to: move.to, promotion: move.promotion });
      }
    }
    signal?.throwIfAborted();
    const reviewed: ReviewedMove[] = [];
    for (const [i, move] of notation.entries()) {
      const side = move.color === "w" ? "white" : "black";
      const best = analyses[i].lines[0],
        played = analyses[i + 1].lines[0];
      const epBest = expectedPoints(best, side),
        epPlayed = expectedPoints(played, side);
      const second = analyses[i].lines[1];
      reviewed.push({
        ply: i + 1,
        side,
        best,
        played,
        loss: Math.max(0, epBest - epPlayed),
        classification: classify({
          epBest,
          epPlayed,
          epSecond: second ? expectedPoints(second, side) : undefined,
          book: i < 16 && this.book(positionKey(move.after)),
          playedBest: best.uci[0] === game.moves[i],
          sacrifice: provesSacrifice(
            move.before,
            [game.moves[i], ...played.uci].slice(0, 8),
            side,
          ),
          previous: reviewed[i - 1]?.classification,
          mateForBefore: best.mate !== undefined && epBest === 1,
          mateForAfter: played.mate !== undefined && epPlayed === 1,
        }),
      });
    }
    const evaluations = analyses.map((a) => a.lines[0]);
    return {
      coachVersion: COACH_VERSION,
      moves: reviewed,
      evaluations,
      accuracy: gameAccuracy(
        evaluations.map((e) => expectedPoints(e, "white") * 100),
        start,
        reviewed.map((m) => m.classification === "Book"),
      ),
    };
  }
}
