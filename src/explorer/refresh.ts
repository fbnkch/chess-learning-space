import { Game, positionKey } from "../game/Game";
import type { Repertoire } from "../repertoire/Repertoire";
import { explorerQuery, weightId, type ReplyWeights } from "./weights";
import { requestWeights, pause, ExplorerError } from "./provider";

/** Walk line paths, never recursively traverse the merged graph (which could create unauthored paths). */
export function explorerPositions(
  rep: Repertoire,
): { key: string; fen: string; moves: Set<string> }[] {
  const positions = new Map<
    string,
    { key: string; fen: string; moves: Set<string> }
  >();
  for (const side of ["white", "black"] as const) {
    for (const line of rep.lineMeta(side)) {
      const game = new Game(line.startFen);
      for (const move of line.moves) {
        if (game.turn !== side) {
          const key = positionKey(game.fen);
          const entry = positions.get(key) ?? {
            key,
            fen: game.fen,
            moves: new Set<string>(),
          };
          if (rep.replies(side, key).some((edge) => edge.uci === move))
            entry.moves.add(move);
          positions.set(key, entry);
        }
        game.play(move);
      }
    }
  }
  return [...positions.values()];
}
export async function refreshWeights(
  rep: Repertoire,
  token: string,
  store: {
    saveReplyWeights(rows: ReplyWeights[], signal?: AbortSignal): Promise<void>;
  },
  signal: AbortSignal,
  options: {
    request?: typeof requestWeights;
    delay?: typeof pause;
    clock?: () => number;
    onProgress?: (done: number, total: number) => void;
  } = {},
): Promise<number> {
  if (!token.trim())
    throw new ExplorerError(
      "Add a Lichess personal API token in Settings first.",
    );
  const positions = explorerPositions(rep);
  const rows: ReplyWeights[] = [];
  for (const [index, position] of positions.entries()) {
    signal.throwIfAborted();
    if (index) await (options.delay ?? pause)(1000, signal);
    const fetched = await (options.request ?? requestWeights)(
      position.fen,
      token,
      signal,
    );
    const weights = Object.fromEntries(
      Object.entries(fetched).filter(([uci]) => position.moves.has(uci)),
    );
    rows.push({
      id: weightId(position.key, explorerQuery),
      positionKey: position.key,
      query: explorerQuery,
      fetchedAt: (options.clock ?? Date.now)(),
      weights,
    });
    options.onProgress?.(index + 1, positions.length);
  }
  signal.throwIfAborted();
  await store.saveReplyWeights(rows, signal);
  return rows.length;
}
