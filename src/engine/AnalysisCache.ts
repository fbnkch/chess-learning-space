import { z } from "zod";
import { analysisKey } from "./analysisKey";
import { ENGINE_VERSION } from "./Engine";
import { Game } from "../game/Game";
import { Chess } from "chess.js";
import type { Analysis, Budget, Engine, Position } from "./types";

const line = z.object({
  uci: z.array(z.string().regex(/^[a-h][1-8][a-h][1-8][qrbn]?$/)),
  depth: z.number().int().nonnegative(),
});
export const analysisSchema = z.object({
  complete: z.literal(true),
  lines: z
    .array(
      z.union([
        line.extend({ cp: z.number().finite() }),
        line.extend({
          mate: z.number().int(),
          winner: z.union([z.literal(1), z.literal(-1)]),
        }),
      ]),
    )
    .min(1),
});
const STORAGE_KEY = "chess-learning-space:engine-review-cache:1";

/** Derived raw engine facts only. Never part of the progress/backup store registry.
 * Best-effort persistence falls back to memory when storage is unavailable/full.
 */
export class AnalysisCache implements Engine {
  private entries = new Map<string, Analysis>();
  constructor(
    private engine: Engine,
    private storage?: Pick<Storage, "getItem" | "setItem">,
    private version = ENGINE_VERSION,
  ) {
    try {
      const saved = z
        .array(z.tuple([z.string(), analysisSchema]))
        .parse(JSON.parse(storage?.getItem(STORAGE_KEY) ?? "[]"));
      this.entries = new Map(saved);
    } catch {
      /* Invalid/evicted derived cache is rebuilt. */
    }
  }
  async analyse(
    position: Position,
    budget: Budget,
    signal?: AbortSignal,
  ): Promise<Analysis> {
    signal?.throwIfAborted();
    const key = `${analysisKey(position)}|${budget.depth === undefined ? `ms:${budget.movetime}` : `depth:${budget.depth}`}|${budget.multipv}|${this.version}`;
    const game = new Game(position.startFen);
    position.moves.forEach((move) => game.play(move));
    const required = Math.max(
      1,
      Math.min(budget.multipv, new Chess(game.fen).moves().length),
    );
    const cached = this.entries.get(key);
    if (cached && cached.lines.length >= required)
      return structuredClone(cached);
    const result = await this.engine.analyse(position, budget, signal);
    signal?.throwIfAborted();
    if (result.complete && result.lines.length >= required) {
      this.entries.set(key, structuredClone(result));
      let serialized = JSON.stringify([...this.entries]);
      while (serialized.length > 1_500_000 && this.entries.size > 1) {
        this.entries.delete(this.entries.keys().next().value!);
        serialized = JSON.stringify([...this.entries]);
      }
      try {
        this.storage?.setItem(STORAGE_KEY, serialized);
      } catch {
        /* Keep memory cache. */
      }
    }
    return result;
  }
}
