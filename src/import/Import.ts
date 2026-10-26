import { Chess } from "chess.js";
import { z } from "zod";
import { chessComGameUrl, gameIdentity, GameIndex } from "./identity";
import { Game } from "../game/Game";
import type { Line } from "../repertoire/types";

export interface ImportedGame {
  id: string;
  fingerprint: string;
  pgn: string;
  result: "1-0" | "0-1" | "1/2-1/2";
  date: string;
  timeControl: string;
  opening: string;
  colour: "white" | "black" | null;
  url: string | null;
  white: string;
  black: string;
}
export interface ImportResult {
  games: ImportedGame[];
  errors: { game: number; message: string }[];
  skipped: number;
  duplicates: number;
}
export type OpeningLines = Partial<Record<"white" | "black", readonly Line[]>>;
const empty = (): ImportResult => ({
  games: [],
  errors: [],
  skipped: 0,
  duplicates: 0,
});
const normalise = (pgn: string) =>
  pgn
    .replace(/^\uFEFF/, "")
    .replace(/\b0-0(?:-0)?\b/g, (s) => s.replaceAll("0", "O"));

/** PGN tokens keep result/header boundaries inside comments and variations opaque. */
export function splitPgn(input: string): string[] {
  const tokens =
    input
      .replace(/^\uFEFF/, "")
      .match(
        /\[(?:[^"\]]|"(?:\\.|[^"\\])*")*\]|\{[^}]*\}|;[^\r\n]*|[()]|[^\s[{}();]+/g,
      ) ?? [];
  const games: string[] = [];
  let current: string[] = [],
    moves = false,
    depth = 0;
  const flush = () => {
    if (current.length) games.push(current.join("\n"));
    current = [];
    moves = false;
    depth = 0;
  };
  for (const token of tokens) {
    if (token.startsWith("[") && moves) flush();
    current.push(token);
    if (token === "(") depth++;
    else if (token === ")") depth = Math.max(0, depth - 1);
    else if (!/^[[{;]/.test(token)) {
      moves = true;
      if (depth === 0 && /^(1-0|0-1|1\/2-1\/2|\*)$/.test(token)) flush();
    }
  }
  flush();
  return games.filter((pgn) => !/^(\s|\{[^}]*\}|;[^\n]*)*$/.test(pgn));
}
async function parseGame(
  pgn: string,
  username: string,
  url: string | null,
  lines: OpeningLines,
): Promise<ImportedGame | null> {
  let source = normalise(pgn);
  const sourceUrl = chessComGameUrl(url);
  // Retain the API identity in the PGN so backups can verify it independently.
  if (sourceUrl && gameIdentity(source).url !== sourceUrl)
    source =
      `[Link "${sourceUrl}"]\n` +
      source.replace(/^\[Link\s+"(?:\\.|[^"\\])*"\]\s*$/gm, "");
  const game = Game.fromPgn(source);
  if (!game.moves.length) throw new Error("No legal moves found.");
  const chess = new Chess();
  chess.loadPgn(
    /\[FEN\s+"/.test(source) && !/\[SetUp\s+"/.test(source)
      ? '[SetUp "1"]\n' + source
      : source,
    { strict: true },
  );
  const headers = chess.getHeaders();
  if (headers.Variant && !/^(standard|chess)$/i.test(headers.Variant))
    return null;
  const result = headers.Result;
  if (result === "*") return null;
  if (result !== "1-0" && result !== "0-1" && result !== "1/2-1/2")
    throw new Error("A completed game needs a result (1-0, 0-1 or 1/2-1/2).");
  const white = headers.White ?? "Unknown",
    black = headers.Black ?? "Unknown";
  const user = username.trim().toLowerCase();
  const colour =
    user && white.toLowerCase() === user
      ? "white"
      : user && black.toLowerCase() === user
        ? "black"
        : null;
  const identity = gameIdentity(source);
  const matching = (
    colour
      ? (lines[colour] ?? [])
      : [...(lines.white ?? []), ...(lines.black ?? [])]
  )
    .filter(
      (line) =>
        line.startFen === game.startFen &&
        line.moves.length <= game.moves.length &&
        line.moves.every((m, i) => game.moves[i] === m),
    )
    .sort((a, b) => b.moves.length - a.moves.length)[0];
  return {
    ...identity,
    pgn: source,
    result,
    date: headers.UTCDate ?? headers.Date ?? "Unknown",
    timeControl: headers.TimeControl ?? "Unknown",
    opening:
      headers.Opening ?? headers.ECO ?? matching?.name ?? "Unknown opening",
    colour,
    white,
    black,
  };
}
export async function importPgn(
  input: string,
  username: string,
  lines: OpeningLines = {},
  signal?: AbortSignal,
): Promise<ImportResult> {
  if (new TextEncoder().encode(input).byteLength > 50 * 1024 * 1024)
    throw new Error("PGN exceeds the 50 MB limit.");
  const result = empty(),
    known = new GameIndex();
  const games = splitPgn(input);
  for (const [index, pgn] of games.entries()) {
    signal?.throwIfAborted();
    try {
      const game = await parseGame(pgn, username, null, lines);
      signal?.throwIfAborted();
      if (!game) result.skipped++;
      else if (known.has(game)) result.duplicates++;
      else {
        known.add(game);
        result.games.push(game);
      }
    } catch {
      signal?.throwIfAborted();
      result.errors.push({
        game: index + 1,
        message: "Invalid PGN. Check its headers, moves and result.",
      });
    }
  }
  if (!games.length)
    result.errors.push({ game: 1, message: "Paste at least one PGN game." });
  return result;
}
const archiveSchema = z.object({ archives: z.array(z.string()) });
const monthSchema = z.object({
  games: z.array(
    z.object({
      rules: z.string(),
      pgn: z.string().optional(),
      url: z.url(),
      end_time: z.number().optional(),
    }),
  ),
});
export async function importChessCom(
  username: string,
  selection: { last: number } | { month: string },
  dependencies: {
    fetch: typeof fetch;
    sleep?: (ms: number) => Promise<void>;
    lines?: OpeningLines;
    signal?: AbortSignal;
  },
): Promise<ImportResult> {
  username = username.trim().toLowerCase();
  if (!/^[a-z0-9_-]{1,100}$/.test(username))
    throw new Error("Enter a valid Chess.com username.");
  if (
    "last" in selection &&
    (!Number.isInteger(selection.last) ||
      selection.last < 1 ||
      selection.last > 1000)
  )
    throw new Error("Choose between 1 and 1000 games.");
  if ("month" in selection && !/^\d{4}-(0[1-9]|1[0-2])$/.test(selection.month))
    throw new Error("Choose a valid month.");
  const signal = dependencies.signal;
  signal?.throwIfAborted();
  async function sleep(ms: number) {
    signal?.throwIfAborted();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let abort: (() => void) | undefined;
    try {
      await Promise.race([
        dependencies.sleep
          ? dependencies.sleep(ms)
          : new Promise<void>((resolve) => {
              timer = setTimeout(resolve, ms);
            }),
        new Promise<never>((_, reject) => {
          abort = () => reject(signal?.reason);
          signal?.addEventListener("abort", abort, { once: true });
          if (signal?.aborted) abort();
        }),
      ]);
      signal?.throwIfAborted();
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      if (abort) signal?.removeEventListener("abort", abort);
    }
  }
  async function request(url: string, missingMonth = false): Promise<unknown> {
    for (let attempt = 0; attempt < 4; attempt++) {
      signal?.throwIfAborted();
      let response: Response;
      try {
        response = await dependencies.fetch(url, { signal });
      } catch {
        signal?.throwIfAborted();
        if (attempt === 3)
          throw new Error("Chess.com could not be reached. Please try again.");
        await sleep(500 * 2 ** attempt);
        continue;
      }
      signal?.throwIfAborted();
      if (response.status === 429) {
        if (attempt === 3)
          throw new Error("Chess.com is busy (429). Please try again later.");
        await sleep(500 * 2 ** attempt);
        continue;
      }
      if (response.status === 404 && missingMonth) return { games: [] };
      if (response.status === 404)
        throw new Error("Chess.com player not found.");
      if (!response.ok)
        throw new Error(
          `Chess.com request failed (${response.status}). Please try again.`,
        );
      return response.json();
    }
    throw new Error("Chess.com request failed.");
  }
  const base = `https://api.chess.com/pub/player/${username}/games/`;
  const archives = archiveSchema.parse(
    await request(base + "archives"),
  ).archives;
  // Only follow this player's monthly PubAPI paths, even if upstream data is malformed.
  const months = [...new Set(archives)]
    .filter(
      (url) =>
        url.startsWith(base) &&
        /^\d{4}\/(0[1-9]|1[0-2])$/.test(url.slice(base.length)),
    )
    .filter(
      (url) =>
        !("month" in selection) ||
        url.endsWith(selection.month.replace("-", "/")),
    )
    .sort()
    .reverse();
  const result = empty(),
    known = new GameIndex();
  let index = 0;
  for (const month of months) {
    let games: z.infer<typeof monthSchema>["games"];
    try {
      games = monthSchema.parse(await request(month, true)).games;
    } catch (error) {
      signal?.throwIfAborted();
      result.errors.push({
        game: index + 1,
        message: `Archive ${month.slice(base.length)}: ${error instanceof Error ? error.message : "Invalid archive response."} Import stopped; completed games have been kept.`,
      });
      return result;
    }
    games.sort((a, b) => (b.end_time ?? 0) - (a.end_time ?? 0));
    for (const item of games) {
      signal?.throwIfAborted();
      index++;
      if (item.rules !== "chess" || !item.end_time) {
        result.skipped++;
        continue;
      }
      try {
        if (!item.pgn) throw new Error("Missing PGN");
        const game = await parseGame(
          item.pgn,
          username,
          item.url,
          dependencies.lines ?? {},
        );
        signal?.throwIfAborted();
        if (!game) result.skipped++;
        else if (known.has(game)) result.duplicates++;
        else {
          known.add(game);
          result.games.push(game);
        }
      } catch {
        signal?.throwIfAborted();
        result.errors.push({
          game: index,
          message: "Chess.com returned an invalid PGN.",
        });
      }
      if ("last" in selection && result.games.length >= selection.last)
        return result;
    }
  }
  return result;
}
