import { Game, positionKey } from "../game/Game";
import type { Repertoire } from "../repertoire/Repertoire";
import type { Side } from "../repertoire/types";

export function repertoireDeviation(
  game: Game,
  side: Side,
  repertoire: Repertoire,
) {
  let first: {
    ply: number;
    kind: "line-end" | "our-deviation" | "unknown-reply";
    bookMoves: string[];
    reentries: number[];
  } | null = null;
  let inside = repertoire.isBook(side, positionKey(game.startFen));
  // An unrelated setup position is not the normal end of a repertoire line.
  if (!inside) return null;
  for (const [ply, move] of game.notation.entries()) {
    const key = positionKey(move.before),
      next = positionKey(move.after);
    const edges = repertoire.edges(side, key);
    const known = repertoire.isBook(side, next);
    if (!first && !edges.some((e) => e.to === next)) {
      first = {
        ply,
        kind: !edges.length
          ? "line-end"
          : (move.color === "w" ? "white" : "black") === side
            ? "our-deviation"
            : "unknown-reply",
        bookMoves: edges.map((e) => e.uci),
        reentries: [],
      };
    }
    if (first && !inside && known) first.reentries.push(ply);
    inside = known;
  }
  return first;
}
