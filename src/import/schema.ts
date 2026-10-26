import { z } from "zod";
import { Chess } from "chess.js";
import { gameIdentity, GameIndex } from "./identity";
import type { ImportedGame } from "./Import";

export const importedGameSchema = z
  .strictObject({
    fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    id: z.string().min(1).max(4096),
    pgn: z.string().min(1).max(2_000_000),
    result: z.enum(["1-0", "0-1", "1/2-1/2"]),
    date: z.string().max(100),
    timeControl: z.string().max(100),
    opening: z.string().max(4096),
    colour: z.enum(["white", "black"]).nullable(),
    url: z.url().nullable(),
    white: z.string().max(4096),
    black: z.string().max(4096),
  })
  .refine((game) => {
    try {
      const identity = gameIdentity(game.pgn);
      const chess = new Chess();
      chess.loadPgn(
        /\[FEN\s+"/.test(game.pgn) && !/\[SetUp\s+"/.test(game.pgn)
          ? '[SetUp "1"]\n' + game.pgn
          : game.pgn,
        { strict: true },
      );
      const headers = chess.getHeaders();
      return (
        chess.history().length > 0 &&
        identity.id === game.id &&
        identity.fingerprint === game.fingerprint &&
        identity.url === game.url &&
        headers.Result === game.result &&
        (headers.White ?? "Unknown") === game.white &&
        (headers.Black ?? "Unknown") === game.black &&
        (headers.UTCDate ?? headers.Date ?? "Unknown") === game.date
      );
    } catch {
      return false;
    }
  }, "Invalid game PGN or identity");

/** Records have only primitive fields; property order must not affect equality. */
function sameRecord(a: ImportedGame, b: ImportedGame) {
  return (Object.keys(a) as (keyof ImportedGame)[]).every(
    (key) => a[key] === b[key],
  );
}

export function mergeGames(local: ImportedGame[], incoming: ImportedGame[]) {
  const ids = new Map<string, ImportedGame>();
  const index = new GameIndex();
  const games: ImportedGame[] = [];
  for (const game of [...local, ...incoming]) {
    const previous = ids.get(game.id);
    if (previous && !sameRecord(previous, game))
      throw new Error("Conflicting copies of a game were found.");
    ids.set(game.id, game);
    if (!previous && !index.has(game)) games.push(game);
    index.add(game);
  }
  return games;
}
