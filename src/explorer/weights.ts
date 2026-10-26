import { z } from "zod";
import { Game, positionKey } from "../game/Game";

export const explorerQuery = {
  variant: "standard",
  ratings: "1000,1200,1400",
  speeds: "blitz,rapid",
  moves: 8,
  topGames: 0,
  recentGames: 0,
} as const;
export const querySchema = z.strictObject({
  variant: z.literal("standard"),
  ratings: z.literal("1000,1200,1400"),
  speeds: z.literal("blitz,rapid"),
  moves: z.literal(8),
  topGames: z.literal(0),
  recentGames: z.literal(0),
});
export function weightId(key: string, query: typeof explorerQuery): string {
  return JSON.stringify([
    key,
    query.variant,
    query.ratings,
    query.speeds,
    query.moves,
    query.topGames,
    query.recentGames,
  ]);
}
export const replyWeightSchema = z
  .strictObject({
    id: z.string().max(1024),
    positionKey: z.string().max(200),
    query: querySchema,
    fetchedAt: z.number().int().nonnegative().max(8_000_000_000_000_000),
    weights: z.record(
      z.string().regex(/^[a-h][1-8][a-h][1-8][qrbn]?$/),
      z.number().finite().min(0).max(100),
    ),
  })
  .superRefine((row, ctx) => {
    try {
      const fen = `${row.positionKey} 0 1`;
      if (
        positionKey(fen) !== row.positionKey ||
        row.id !== weightId(row.positionKey, row.query)
      )
        throw new Error();
      for (const move of Object.keys(row.weights)) new Game(fen).play(move);
      if (
        Object.keys(row.weights).length > 8 ||
        Object.values(row.weights).reduce((sum, weight) => sum + weight, 0) >
          100 + 1e-8
      )
        throw new Error();
    } catch {
      ctx.addIssue({
        code: "custom",
        message: "Invalid explorer position or move",
      });
    }
  });
export type ReplyWeights = z.infer<typeof replyWeightSchema>;
export function mergeReplyWeights(
  local: ReplyWeights[],
  incoming: ReplyWeights[],
): ReplyWeights[] {
  const rows = new Map(local.map((row) => [row.id, row]));
  for (const row of incoming) {
    if (!rows.has(row.id) || row.fetchedAt > rows.get(row.id)!.fetchedAt)
      rows.set(row.id, row);
  }
  return [...rows.values()];
}
/** Only this boundary decides whether a reply uses explorer data or its authored estimate. */
export function effectiveReplyWeight(
  rows: readonly ReplyWeights[],
  key: string,
  uci: string,
  bundled: number,
): number {
  return (
    rows.find((row) => row.id === weightId(key, explorerQuery))?.weights[uci] ??
    bundled
  );
}
