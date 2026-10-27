import { replyWeightSchema, mergeReplyWeights } from "../explorer/weights";
import { z } from "zod";
import {
  personalCardSchema,
  mergePersonalCards,
} from "../review/personalCards";
import { importedGameSchema, mergeGames } from "../import/schema";
import { mergeRuleStates } from "../rules/ruleState";
import type { Data } from "./Progress";
import { motifs } from "../puzzles/types";
import { colorModes, colorThemes } from "../appearance";
const text = z.string().min(1).max(4096);
const timestamp = z.number().int().min(0).max(8_000_000_000_000_000);
const reviewSchema = z.strictObject({
  attemptId: z.string().regex(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/),
  sessionId: text,
  cardId: text,
  lineId: text.optional(),
  at: timestamp,
  grade: z.enum(["again", "hard", "good", "easy"]),
  lineCompleted: z.boolean().optional(),
  discoveryMode: z.literal("visits").optional(),
  lineUnlocked: z.boolean().optional(),
  context: z.enum([
    "rule-quiz",
    "learn",
    "repertoire",
    "practice",
    "woodpecker",
    "puzzle",
    "mistake",
  ]),
  hintsUsed: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative(),
  schedulingEligible: z.boolean(),
  puzzle: z
    .strictObject({
      rating: z.number().min(0).max(4000),
      rd: z.number().positive().max(1000),
      rated: z.boolean(),
      setId: text.optional(),
      cycle: z.number().int().positive().optional(),
    })
    .optional(),
});
export const scanAttemptSchema = z
  .strictObject({
    attemptId: z.string().regex(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/),
    sessionId: text,
    at: timestamp,
    positionKey: text,
    mode: z.enum(["scan", "changed"]),
    required: z.number().int().min(1).max(12),
    found: z.number().int().nonnegative(),
    wrong: z.number().int().nonnegative(),
    durationMs: z.number().int().nonnegative(),
  })
  .refine((record) => record.found <= record.required);
const settingsSchema = z.strictObject({
  colorMode: z.enum(colorModes).optional(),
  colorTheme: z.enum(colorThemes).optional(),
  welcomeComplete: z.boolean().optional(),
  startingOpening: z.enum(["italian", "london", "caro", "qgd"]).optional(),
  planStartedAt: timestamp.optional(),
  planReviewedGames: z.array(text).max(10000).optional(),
  planExternal: z
    .strictObject({
      play: z.number().int().min(0).max(2),
      endgame: z.number().int().min(0).max(1),
    })
    .optional(),
  chessComUsername: z.string().max(100).optional(),
  safetyCheck: z.boolean().optional(),
  activeLines: z.number().int().min(3).max(12).optional(),
  sound: z.boolean(),
  animationMs: z.union([
    z.literal(0),
    z.literal(100),
    z.literal(200),
    z.literal(400),
  ]),
  coordinates: z.boolean(),
  reducedMotion: z.boolean(),
});
const metadataSchema = z.strictObject({
  key: z.enum(["firstReviewAt", "lastExportAt"]),
  value: timestamp,
});
const ruleStateSchema = z.strictObject({
  ruleId: text,
  learned: z.boolean(),
  learnedAt: timestamp.nullable(),
  updatedAt: timestamp,
});

// The registry is the only list of persisted stores and backup rules.
export const storeRegistry = [
  {
    name: "replyWeights",
    key: "id",
    since: 11,
    exportable: true,
    schema: z
      .array(replyWeightSchema)
      .max(10000)
      .refine((rows) => new Set(rows.map((r) => r.id)).size === rows.length),
    merge: mergeReplyWeights,
  },
  {
    name: "personalCards",
    key: "cardId",
    since: 9,
    exportable: true,
    schema: z.array(personalCardSchema).max(100000),
    merge: mergePersonalCards,
  },
  {
    name: "puzzleRating",
    key: null,
    since: 7,
    exportable: true,
    schema: z
      .array(
        z.strictObject({
          rating: z.number().finite(),
          rd: z.number().positive().max(1000),
          volatility: z.number().positive().max(1),
          ratedAttempts: z.number().int().nonnegative(),
        }),
      )
      .max(1),
    merge: (local: Data["puzzleRating"], incoming: Data["puzzleRating"]) =>
      (incoming[0]?.ratedAttempts ?? -1) > (local[0]?.ratedAttempts ?? -1)
        ? incoming
        : local,
  },
  {
    name: "woodpeckerSets",
    key: "id",
    since: 7,
    exportable: true,
    schema: z
      .array(
        z.strictObject({
          id: text,
          puzzleIds: z
            .array(z.string().regex(/^[A-Za-z0-9]+$/))
            .min(1)
            .max(1000)
            .refine((ids) => new Set(ids).size === ids.length),
          motif: z.enum(motifs),
          createdAt: timestamp,
        }),
      )
      .max(1000),
    merge: (
      local: Data["woodpeckerSets"],
      incoming: Data["woodpeckerSets"],
    ) => [...new Map([...incoming, ...local].map((s) => [s.id, s])).values()],
  },
  {
    name: "games",
    key: "id",
    since: 8,
    schema: z
      .array(importedGameSchema)
      .max(100000)
      .refine((games) => {
        try {
          mergeGames([], games);
          return true;
        } catch {
          return false;
        }
      }, "Conflicting copies of a game were found."),
    exportable: true,
    merge: mergeGames,
  },
  {
    name: "scanLog",
    key: "attemptId",
    since: 6,
    schema: z.array(scanAttemptSchema).max(200000),
    exportable: true,
    merge: (local: Data["scanLog"], incoming: Data["scanLog"]) => [
      ...new Map([...incoming, ...local].map((r) => [r.attemptId, r])).values(),
    ],
  },
  {
    name: "reviewLog",
    key: "attemptId",
    since: 1,
    schema: z.array(reviewSchema).max(200000),
    exportable: true,
    merge: (local: Data["reviewLog"], incoming: Data["reviewLog"]) => [
      ...new Map([...incoming, ...local].map((r) => [r.attemptId, r])).values(),
    ],
  },
  {
    name: "metadata",
    key: "key",
    since: 1,
    schema: z.array(metadataSchema),
    exportable: true,
    merge: (local: Data["metadata"]) => local,
  },
  {
    name: "settings",
    key: null,
    since: 3,
    schema: z.array(settingsSchema).max(1),
    exportable: true,
    merge: (local: Data["settings"]) => local,
  },
  {
    name: "ruleState",
    key: "ruleId",
    since: 5,
    schema: z.array(ruleStateSchema).max(2000),
    exportable: true,
    // ADR-0003: learned if learned in either copy.
    merge: mergeRuleStates,
  },

  {
    name: "secrets",
    key: null,
    since: 3,
    schema: z.unknown(),
    exportable: false,
    merge: null,
  },
  {
    name: "preImport",
    key: null,
    since: 4,
    schema: z.unknown(),
    exportable: false,
    merge: null,
  },
] as const;
export const stores = storeRegistry.filter((s) => s.exportable);
export const dataSchema = z.strictObject(
  Object.fromEntries(stores.map((s) => [s.name, s.schema])),
);
export const incomingDataSchema = z.strictObject(
  Object.fromEntries(stores.map((s) => [s.name, z.unknown().optional()])),
);
export function exportData(data: Data) {
  return Object.fromEntries(
    stores.map((s) => [
      s.name,
      s.name === "metadata"
        ? data.metadata.filter((m) => metadataSchema.safeParse(m).success)
        : data[s.name],
    ]),
  );
}
