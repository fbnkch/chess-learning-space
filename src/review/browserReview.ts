import graphs from "virtual:repertoire";
import { repertoire } from "../repertoire/bundled";
import { StockfishEngine, ENGINE_VERSION } from "../engine/Engine";
import { ReviewCache } from "../engine/ReviewCache";
import { Game } from "../game/Game";
import { COACH_VERSION } from "./classify";
import type { Engine } from "../engine/types";
import { Review, REVIEW_BUDGET } from "./Review";

let storage: Storage | undefined;
try {
  storage = window.localStorage;
} catch {
  /* Private browsing: memory cache. */
}
const results = new ReviewCache(storage);
let review: Review | undefined;
let stockfish: StockfishEngine | undefined;
export const reviewEngine: Engine = {
  analyse(position, budget, signal) {
    stockfish ??= new StockfishEngine();
    return stockfish.analyse(position, budget, signal);
  },
};
const content = Object.values(graphs)
  .map((graph) => graph.contentVersion)
  .join("|");
const key = (game: Game) =>
  JSON.stringify([
    game.startFen,
    game.moves,
    REVIEW_BUDGET,
    ENGINE_VERSION,
    COACH_VERSION,
    content,
  ]);
export function cachedReview(game: Game) {
  return results.get(key(game));
}
export function releaseReview() {
  stockfish?.dispose();
  stockfish = undefined;
}
export async function analyseGame(
  game: Game,
  signal: AbortSignal,
  progress: (done: number, total: number) => void,
) {
  review ??= new Review(
    reviewEngine,
    (key) => repertoire.isBook("white", key) || repertoire.isBook("black", key),
    REVIEW_BUDGET,
    storage,
  );
  const cached = cachedReview(game);
  if (cached) return cached;
  const result = await review.analyse(game, signal, progress);
  signal.throwIfAborted();
  results.set(key(game), result);
  return result;
}
