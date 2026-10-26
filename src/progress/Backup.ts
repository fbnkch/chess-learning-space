import { z } from "zod";
import { mergePersonalCards } from "../review/personalCards";
import { mergeGames } from "../import/schema";
import {
  migrateProgress,
  schemaVersion,
  type Data,
  type Progress,
} from "./Progress";
import { dataSchema, incomingDataSchema, exportData } from "./stores";

/** Allow-listed envelope shared by downloaded backups and encrypted sync. No bookkeeping writes. */
export function serializeBackup(
  data: Data,
  appVersion = "1.0.0",
  contentVersions: Record<string, string> = {},
  now = Date.now(),
) {
  return JSON.stringify({
    format: "chess-learning-space",
    schemaVersion,
    appVersion,
    contentVersions,
    exportedAt: new Date(now).toISOString(),
    data: exportData(data),
  });
}

export const maxBackupBytes = 50 * 1024 * 1024;
export function importError(error: unknown): Error {
  const allowed = new Set([
    "Backup exceeds the 50 MB limit.",
    "This file is not valid JSON.",
    "This file is not a Chess Learning Space backup.",
    "This backup needs a newer app version of Chess Learning Space.",
    "This backup contains unsupported data.",
    "This backup contains invalid progress or settings.",
    "This backup contains an invalid review attempt or date.",
    "Conflicting copies of a review attempt were found.",
    "Conflicting copies of a game were found.",
    "This backup refers to an invalid training card.",
    "Choose Replace or Merge.",
    "There is no import to undo.",
  ]);
  const detail =
    error instanceof Error
      ? error.message.replace(/ Nothing was changed\.$/, "")
      : "";
  const message = allowed.has(detail)
    ? detail
    : "This import could not be completed. Please try again.";
  return new Error(`${message} Nothing was changed.`);
}
export function validateBackup(json: string, now = Date.now()): Data {
  try {
    if (new TextEncoder().encode(json).byteLength > maxBackupBytes)
      throw new Error("Backup exceeds the 50 MB limit.");
    let input: unknown;
    try {
      input = JSON.parse(json);
    } catch {
      throw new Error("This file is not valid JSON.");
    }
    const header = z
      .object({
        format: z.literal("chess-learning-space"),
        schemaVersion: z.number().int().nonnegative(),
      })
      .safeParse(input);
    if (!header.success)
      throw new Error("This file is not a Chess Learning Space backup.");
    if (header.data.schemaVersion > schemaVersion)
      throw new Error(
        "This backup needs a newer app version of Chess Learning Space.",
      );
    const envelope = z
      .strictObject({
        format: z.literal("chess-learning-space"),
        schemaVersion: z.number().int().nonnegative(),
        appVersion: z.string(),
        contentVersions: z.record(z.string(), z.string()),
        exportedAt: z.iso.datetime(),
        data: incomingDataSchema,
      })
      .safeParse(input);
    if (!envelope.success)
      throw new Error("This backup contains unsupported data.");
    const migrated = migrateProgress(
      envelope.data as unknown as Parameters<typeof migrateProgress>[0],
    );
    const parsed = dataSchema.safeParse(migrated.data);
    if (!parsed.success)
      throw new Error("This backup contains invalid progress or settings.");
    const data = parsed.data as unknown as Data;
    if (data.replyWeights.some((row) => row.fetchedAt > now + 86400000))
      throw new Error("This backup contains invalid progress or settings.");
    data.games = mergeGames([], data.games);
    data.personalCards = mergePersonalCards([], data.personalCards);
    const ids = new Map<string, string>();
    for (const review of data.reviewLog) {
      if (
        (["learn", "practice", "woodpecker", "rule-quiz"].includes(
          review.context,
        ) &&
          review.schedulingEligible) ||
        review.at > now + 86400000 ||
        (review.cardId.startsWith("rule:") && review.context !== "rule-quiz") ||
        (review.context === "rule-quiz" &&
          (!/^rule:[a-z0-9-]+:example-v1$/.test(review.cardId) ||
            !["good", "again"].includes(review.grade) ||
            review.hintsUsed !== 0)) ||
        (review.puzzle &&
          (!review.cardId.startsWith("puzzle:") ||
            (review.hintsUsed > 0 && review.grade !== "again") ||
            (review.context === "woodpecker" && review.puzzle.rated)))
      )
        throw new Error(
          "This backup contains an invalid review attempt or date.",
        );
      const content = JSON.stringify(review);
      if (ids.has(review.attemptId) && ids.get(review.attemptId) !== content)
        throw new Error("Conflicting copies of a review attempt were found.");
      ids.set(review.attemptId, content);
      if (
        !/^(rep|mistake):(white|black):.+$|^puzzle:[A-Za-z0-9]+$|^rule:[a-z0-9-]+:example-v1$/.test(
          review.cardId,
        )
      )
        throw new Error("This backup refers to an invalid training card.");
    }
    const scans = new Map<string, string>();
    for (const scan of data.scanLog) {
      if (scan.at > now + 86400000)
        throw new Error(
          "This backup contains an invalid review attempt or date.",
        );
      const content = JSON.stringify(scan);
      if (scans.has(scan.attemptId) && scans.get(scan.attemptId) !== content)
        throw new Error("Conflicting copies of a review attempt were found.");
      scans.set(scan.attemptId, content);
    }
    data.scanLog = [
      ...new Map(data.scanLog.map((r) => [r.attemptId, r])).values(),
    ];
    data.reviewLog = [
      ...new Map(data.reviewLog.map((r) => [r.attemptId, r])).values(),
    ];
    return data;
  } catch (error) {
    throw importError(error);
  }
}

export interface BackupOptions {
  download: (json: string, filename: string) => Promise<void | string>;
  clock?: () => number;
  appVersion: string;
  contentVersions: Record<string, string>;
}
declare const checked: unique symbol;
/** Backup data that passed `preview()` in this session. */
export type ValidatedBackup = Data & { readonly [checked]: true };
const validated = new WeakSet<object>();
export class Backup {
  private clock: () => number;
  constructor(
    private store: Progress,
    private options: BackupOptions,
  ) {
    this.clock = options.clock ?? Date.now;
  }
  private envelope(data: Data) {
    return serializeBackup(
      data,
      this.options.appVersion,
      this.options.contentVersions,
      this.clock(),
    );
  }

  async export() {
    await this.store.requestPersistence();
    const data = await this.store.snapshot();
    const at = this.clock();
    await this.options.download(
      this.envelope(data),
      "chess-learning-space-backup.json",
    );
    await this.store.setMetadata([
      { key: "lastExportAt", value: at },
      { key: "exportReviewCount", value: data.reviewLog.length },
      { key: "backupDismissedAt", value: 0 },
    ]);
  }
  /** Validates once; only data that came through here can be imported without re-parsing. */
  preview(json: string): ValidatedBackup {
    const data = validateBackup(json, this.clock());
    validated.add(data);
    return data as ValidatedBackup;
  }
  async import(input: string | ValidatedBackup, mode: "replace" | "merge") {
    try {
      if (typeof input !== "string" && !validated.has(input))
        throw new Error("This backup was not checked before importing.");
      const data = typeof input === "string" ? this.preview(input) : input;
      if (mode !== "replace" && mode !== "merge")
        throw new Error("Choose Replace or Merge.");
      const before = await this.store.snapshot();
      let snapshot = "The optional snapshot file could not be saved.";
      try {
        const location = await this.options.download(
          this.envelope(before),
          "chess-learning-space-before-import.json",
        );
        snapshot =
          typeof location === "string"
            ? location
            : "Optional snapshot download requested: chess-learning-space-before-import.json (your browser's download location).";
      } catch {
        /* Undo is protected by the database transaction, independently of downloads. */
      }
      await this.store.restore(data, mode, this.clock());
      return snapshot;
    } catch (error) {
      throw importError(error);
    }
  }
  async undo() {
    try {
      await this.store.undo();
    } catch (error) {
      throw importError(error);
    }
  }
  hasUndo() {
    return this.store.hasUndo();
  }
  undoInfo() {
    return this.store.undoInfo();
  }
  async nudge() {
    const data = await this.store.snapshot();
    const value = (key: string) =>
      Number(data.metadata.find((m) => m.key === key)?.value ?? 0);
    const exported = value("lastExportAt");
    const start = exported > 0 ? exported : value("firstReviewAt");
    const dismissed = value("backupDismissedAt");
    return (
      data.reviewLog.length > 0 &&
      !(dismissed > 0 && this.clock() - dismissed < 3 * 86400000) &&
      (this.clock() - start >= 7 * 86400000 ||
        data.reviewLog.length - value("exportReviewCount") >= 200)
    );
  }

  async dismiss() {
    await this.store.setMetadata([
      { key: "backupDismissedAt", value: this.clock() },
    ]);
  }
}
