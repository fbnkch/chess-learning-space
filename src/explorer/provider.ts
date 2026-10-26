import { z } from "zod";
import { Game } from "../game/Game";
import { explorerQuery } from "./weights";
export const tokenSecret = "lichess-explorer-token";
export class ExplorerError extends Error {}
export function pause(ms: number, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal.addEventListener("abort", abort, { once: true });
  });
}
const count = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER / 100);
const results = { white: count, draws: count, black: count };
const responseSchema = z.object({
  ...results,
  moves: z.array(z.object({ ...results, uci: z.string() })).max(8),
});
/** Fixed origin, no redirects, credentials, response bodies or raw fetch errors in messages. */
export async function requestWeights(
  fen: string,
  token: string,
  signal: AbortSignal,
  options: {
    fetch?: typeof fetch;
    delay?: typeof pause;
  } = {},
): Promise<Record<string, number>> {
  const fetcher = options.fetch ?? fetch;
  const delay = options.delay ?? pause;
  const url = new URL("https://explorer.lichess.ovh/lichess");
  for (const [key, value] of Object.entries({ ...explorerQuery, fen }))
    url.searchParams.set(key, String(value));
  for (let attempt = 0; attempt < 3; attempt++) {
    signal.throwIfAborted();
    let response: Response;
    try {
      response = await fetcher(url, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "omit",
        redirect: "error",
        signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]),
      });
    } catch {
      signal.throwIfAborted();
      throw new ExplorerError(
        "Lichess could not be reached. Check your connection and try again. Previous weights kept.",
      );
    }
    if (response.status === 401)
      throw new ExplorerError(
        "Lichess rejected the token (401). Check your personal API token. Previous weights kept.",
      );
    if (response.status === 429) {
      if (attempt === 2)
        throw new ExplorerError(
          "Lichess is rate limiting requests (429). Try again later. Previous weights kept.",
        );
      const retry = response.headers.get("Retry-After");
      const seconds = retry === null ? NaN : Number(retry);
      const requested = Number.isFinite(seconds)
        ? seconds * 1000
        : Date.parse(retry ?? "") - Date.now();
      const ms = Math.max(
        60_000 * 2 ** attempt,
        Number.isFinite(requested) ? requested : 0,
      );
      // Do not retry earlier than Retry-After when a long server pause is requested.
      if (ms > 300_000)
        throw new ExplorerError(
          "Lichess requested a longer pause (429). Try again later. Previous weights kept.",
        );
      await delay(ms, signal);
      continue;
    }
    if (!response.ok)
      throw new ExplorerError(
        "Lichess returned an error. Try again later. Previous weights kept.",
      );
    try {
      const data = responseSchema.parse(await response.json());
      const total = data.white + data.draws + data.black;
      const weights: Record<string, number> = {};
      let listed = 0;
      for (const move of data.moves) {
        if (Object.hasOwn(weights, move.uci)) throw new Error();
        new Game(fen).play(move.uci);
        const games = move.white + move.draws + move.black;
        listed += games;
        weights[move.uci] = total ? (games / total) * 100 : 0;
      }
      if (listed > total) throw new Error();
      signal.throwIfAborted();
      return total ? weights : {};
    } catch {
      signal.throwIfAborted();
      throw new ExplorerError(
        "Lichess returned invalid opening data. Previous weights kept.",
      );
    }
  }
  throw new ExplorerError("Lichess refresh failed. Previous weights kept.");
}
