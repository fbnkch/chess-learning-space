import { z } from "zod";
import { analysisSchema } from "./AnalysisCache";
import type { GameReview } from "../review/Review";

const score = analysisSchema.shape.lines.element;
const resultSchema = z
  .object({
    coachVersion: z.string(),
    evaluations: z.array(score).min(1),
    accuracy: z.object({
      white: z.number().finite().nullable(),
      black: z.number().finite().nullable(),
    }),
    moves: z.array(
      z.object({
        ply: z.number().int().positive(),
        side: z.enum(["white", "black"]),
        classification: z.enum([
          "Book",
          "Brilliant",
          "Great",
          "Miss",
          "Best",
          "Excellent",
          "Good",
          "Inaccuracy",
          "Mistake",
          "Blunder",
        ]),
        best: score,
        played: score,
        loss: z.number().finite(),
      }),
    ),
  })
  .refine((r) => r.evaluations.length === r.moves.length + 1);
const STORAGE_KEY = "chess-learning-space:engine-review-results:1";
/** Coach results are disposable engine-cache data, excluded from JSON backups. */
export class ReviewCache {
  private entries = new Map<string, GameReview>();
  constructor(private storage?: Pick<Storage, "getItem" | "setItem">) {
    try {
      this.entries = new Map(
        z
          .array(z.tuple([z.string(), resultSchema]))
          .parse(JSON.parse(storage?.getItem(STORAGE_KEY) ?? "[]")),
      );
    } catch {
      /* Recompute invalid derived facts. */
    }
  }
  get(key: string) {
    const result = this.entries.get(key);
    return result && structuredClone(result);
  }
  set(key: string, result: GameReview) {
    this.entries.set(key, structuredClone(result));
    let serialized = JSON.stringify([...this.entries]);
    while (serialized.length > 1_000_000 && this.entries.size > 1) {
      this.entries.delete(this.entries.keys().next().value!);
      serialized = JSON.stringify([...this.entries]);
    }
    try {
      this.storage?.setItem(STORAGE_KEY, serialized);
    } catch {
      /* Memory still works. */
    }
  }
}
