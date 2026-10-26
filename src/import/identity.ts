import { Chess } from "chess.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { Game } from "../game/Game";

const hash = (value: unknown) =>
  bytesToHex(sha256(new TextEncoder().encode(JSON.stringify(value))));

/** Only public Chess.com game URLs can become identities or clickable links. */
export function chessComGameUrl(
  value: string | undefined | null,
): string | null {
  const match = value
    ?.trim()
    .match(/^https:\/\/www\.chess\.com\/game\/(live|daily)\/(\d+)\/?$/i);
  return match
    ? `https://www.chess.com/game/${match[1].toLowerCase()}/${match[2].replace(/^0+(?=\d)/, "")}`
    : null;
}

export function gameIdentity(pgn: string) {
  const game = Game.fromPgn(pgn);
  const chess = new Chess();
  chess.loadPgn(
    /\[FEN\s+"/.test(pgn) && !/\[SetUp\s+"/.test(pgn)
      ? '[SetUp "1"]\n' + pgn
      : pgn,
    { strict: true },
  );
  const headers = chess.getHeaders();
  // chess.js replaces the declared Result with the movetext end marker.
  // Keep contradictory headers from becoming apparently valid completed games.
  const declaredResult = pgn.match(/\[Result\s+"([^"]*)"\]/)?.[1];
  if (declaredResult !== undefined && declaredResult !== headers.Result)
    throw new Error("PGN result header and movetext disagree.");
  const url = chessComGameUrl(headers.Link) ?? chessComGameUrl(headers.Site);
  const id =
    url ??
    "pgn:" +
      hash([
        Object.entries(headers).sort(([a], [b]) =>
          a < b ? -1 : a > b ? 1 : 0,
        ),
        game.startFen,
        game.moves,
      ]);
  const fingerprint = hash([
    game.startFen,
    game.moves,
    (headers.White ?? "Unknown").trim().toLowerCase(),
    (headers.Black ?? "Unknown").trim().toLowerCase(),
    headers.UTCDate ?? headers.Date ?? "Unknown",
    headers.UTCTime ?? headers.StartTime ?? "Unknown",
    headers.Result ?? "*",
  ]);
  return { id, fingerprint, url };
}

const verified = (id: string) => id.startsWith("https://www.chess.com/game/");

/**
 * Same ID means the same game. A fingerprint match is a duplicate only when at
 * least one side has no verified Chess.com URL: two different game URLs are
 * always two games, even for an identical rematch.
 */
export class GameIndex {
  private ids = new Set<string>();
  private byFingerprint = new Map<string, { urls: number; plain: number }>();
  constructor(games: Iterable<{ id: string; fingerprint: string }> = []) {
    for (const game of games) this.add(game);
  }
  has(game: { id: string; fingerprint: string }) {
    if (this.ids.has(game.id)) return true;
    const seen = this.byFingerprint.get(game.fingerprint);
    if (!seen) return false;
    return verified(game.id) ? seen.plain > 0 : seen.urls + seen.plain > 0;
  }
  add(game: { id: string; fingerprint: string }) {
    this.ids.add(game.id);
    const seen = this.byFingerprint.get(game.fingerprint) ?? {
      urls: 0,
      plain: 0,
    };
    if (verified(game.id)) seen.urls++;
    else seen.plain++;
    this.byFingerprint.set(game.fingerprint, seen);
  }
}
