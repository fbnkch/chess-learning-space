import { validateBackup, serializeBackup } from "./Backup";
import {
  replyWeightSchema,
  mergeReplyWeights,
  type ReplyWeights,
} from "../explorer/weights";
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import {
  personalCardSchema,
  mergePersonalCards,
  type PersonalCard,
} from "../review/personalCards";
import { stores, storeRegistry } from "./stores";
import type { Settings } from "../settings";
import {
  eligibleReview,
  ordered,
  type Review,
  type ReviewStore,
} from "../scheduler/Scheduler";
import type { ScanAttempt } from "../threats/scan";
import type { ImportedGame } from "../import/Import";
import { importedGameSchema, mergeGames } from "../import/schema";
import { GameIndex } from "../import/identity";
import { scanAttemptSchema } from "./stores";
import type { RuleState } from "../rules/ruleState";
import { mergeRuleStates, derivedRuleStates } from "../rules/ruleState";
import { initialRating, glicko2, type PuzzleRating } from "../puzzles/rating";
import { preparePuzzleReview, type WoodpeckerSet } from "../puzzles/training";

// v2 session/card index; v3 settings/secrets; v4 import copy; v5 rule state; v6 scan log; v7 puzzle rating/woodpecker sets; v8 imported games; v9 personal mistake cards; v10 rule quiz review context; v11 explorer reply weights.
export const schemaVersion = 11;
export interface SyncDataState {
  epoch: number;
  paused: boolean;
}
const syncListeners = new Map<string, Set<(state: SyncDataState) => void>>();
export class SyncEpochChanged extends Error {
  constructor() {
    super("Local data changed during sync.");
  }
}
export interface Metadata {
  key: string;
  value: string | number;
}
export interface Data {
  replyWeights: ReplyWeights[];
  personalCards: PersonalCard[];
  games: ImportedGame[];
  reviewLog: Review[];
  metadata: Metadata[];
  settings: Settings[];
  ruleState: RuleState[];
  scanLog: ScanAttempt[];
  puzzleRating: PuzzleRating[];
  woodpeckerSets: WoodpeckerSet[];
}
export interface Snapshot {
  schemaVersion: number;
  data: Partial<Data>;
}
export type Migrations = Record<number, (old: Snapshot) => Snapshot>;
const migrations: Migrations = {
  10: (old) => ({
    ...old,
    schemaVersion: 11,
    data: { ...old.data, replyWeights: old.data.replyWeights ?? [] },
  }),
  9: (old) => ({ ...old, schemaVersion: 10 }),
  8: (old) => ({
    ...old,
    schemaVersion: 9,
    data: { ...old.data, personalCards: old.data.personalCards ?? [] },
  }),
  7: (old) => ({
    ...old,
    schemaVersion: 8,
    data: { ...old.data, games: old.data.games ?? [] },
  }),
  6: (old) => ({
    ...old,
    schemaVersion: 7,
    data: { ...old.data, puzzleRating: [], woodpeckerSets: [] },
  }),
  5: (old) => ({
    ...old,
    schemaVersion: 6,
    data: { ...old.data, scanLog: old.data.scanLog ?? [] },
  }),
  0: (old) => ({
    schemaVersion: 1,
    data: {
      reviewLog: old.data.reviewLog ?? [],
      metadata: old.data.metadata ?? [],
    },
  }),
  1: (old) => ({ ...old, schemaVersion: 2 }),
  3: (old) => ({ ...old, schemaVersion: 4 }),
  2: (old) => ({
    ...old,
    schemaVersion: 3,
    data: { ...old.data, settings: old.data.settings ?? [] },
  }),
  4: (old) => ({
    ...old,
    schemaVersion: 5,
    data: { ...old.data, ruleState: old.data.ruleState ?? [] },
  }),
};
interface ProgressDb extends DBSchema {
  replyWeights: { key: string; value: ReplyWeights };
  personalCards: { key: string; value: PersonalCard };
  puzzleRating: { key: string; value: PuzzleRating };
  woodpeckerSets: { key: string; value: WoodpeckerSet };
  games: { key: string; value: ImportedGame };
  reviewLog: {
    key: string;
    value: Review;
    indexes: { sessionCard: [string, string] };
  };
  metadata: { key: string; value: Metadata };
  settings: { key: string; value: Settings };
  ruleState: { key: string; value: RuleState };
  scanLog: { key: string; value: ScanAttempt };
  secrets: { key: string; value: string };
  preImport: {
    key: string;
    value: {
      data: Data;
      at: number;
      mode: "replace" | "merge";
      /** Review IDs the import added; everything else newer is the learner's own later work. */
      importedIds?: string[];
      importedScanIds?: string[];
      importedGameIds?: string[];
      cardsAfterImport?: PersonalCard[];
      /** Exact post-import state distinguishes later edits from imported future timestamps. */
      ruleStatesAfterImport?: RuleState[];
      setsAfterImport?: WoodpeckerSet[];
      weightsAfterImport?: ReplyWeights[];
    };
  };
}
function laterReviews(
  copy: { data: Data; importedIds?: string[] },
  current: Review[],
): Review[] {
  const known = new Set([
    ...copy.data.reviewLog.map((r) => r.attemptId),
    ...(copy.importedIds ?? []),
  ]);
  return current.filter((r) => !known.has(r.attemptId));
}
function laterGames(
  copy: { data: Data; importedGameIds?: string[] },
  current: ImportedGame[],
) {
  const known = new Set([
    ...copy.data.games.map((g) => g.id),
    ...(copy.importedGameIds ?? []),
  ]);
  return current.filter((g) => !known.has(g.id));
}
function laterScans(
  copy: { data: Data; importedScanIds?: string[] },
  current: ScanAttempt[],
) {
  const known = new Set([
    ...copy.data.scanLog.map((r) => r.attemptId),
    ...(copy.importedScanIds ?? []),
  ]);
  return current.filter((r) => !known.has(r.attemptId));
}
function laterRuleStates(
  copy: { data: Data; ruleStatesAfterImport?: RuleState[] },
  current: RuleState[],
): RuleState[] {
  const baseline = new Map(
    (copy.ruleStatesAfterImport ?? copy.data.ruleState).map((state) => [
      state.ruleId,
      state,
    ]),
  );
  return current.filter((state) => {
    const previous = baseline.get(state.ruleId);
    return (
      !previous ||
      state.updatedAt !== previous.updatedAt ||
      state.learned !== previous.learned ||
      state.learnedAt !== previous.learnedAt
    );
  });
}
/** The same forward-only data path is used by versionchange and JSON import. */
export function migrateProgress(
  snapshot: Snapshot,
  target = schemaVersion,
  steps = migrations,
): { schemaVersion: number; data: Data } {
  if (
    !Number.isInteger(snapshot.schemaVersion) ||
    snapshot.schemaVersion < 0 ||
    snapshot.schemaVersion > target
  )
    throw new Error("Unsupported progress schema version");
  let next = structuredClone(snapshot);
  while (next.schemaVersion < target) {
    const step = steps[next.schemaVersion];
    if (!step) throw new Error("Missing progress migration");
    const migrated = step(next);
    if (migrated.schemaVersion !== next.schemaVersion + 1)
      throw new Error("Migration must advance one version");
    next = migrated;
  }
  if (!next.data.reviewLog || !next.data.metadata)
    throw new Error("Incomplete progress data");
  return {
    schemaVersion: next.schemaVersion,
    data: Object.fromEntries(
      stores.map((entry) => [
        entry.name,
        next.data[entry.name] === undefined ? [] : next.data[entry.name],
      ]),
    ) as unknown as Data,
  };
}
export interface Progress extends ReviewStore {
  replyWeights(): Promise<ReplyWeights[]>;
  saveReplyWeights(rows: ReplyWeights[], signal?: AbortSignal): Promise<void>;
  personalCards(): Promise<PersonalCard[]>;
  savePersonalCard(card: PersonalCard): Promise<void>;
  puzzleRating(): Promise<PuzzleRating>;
  woodpeckerSets(): Promise<WoodpeckerSet[]>;
  saveWoodpeckerSet(set: WoodpeckerSet): Promise<void>;
  games(): Promise<ImportedGame[]>;
  importGames(games: ImportedGame[], signal?: AbortSignal): Promise<number>;
  reviews(): Promise<Review[]>;
  scans(): Promise<ScanAttempt[]>;
  recordScan(attempt: ScanAttempt): Promise<void>;
  metadata(key: string): Promise<Metadata | undefined>;
  setMetadata(records: Metadata[]): Promise<void>;
  secret(key: string): Promise<string | undefined>;
  saveSecret(key: string, value: string): Promise<void>;
  settings(): Promise<Settings | undefined>;
  saveSettings(settings: Settings): Promise<void>;
  ruleStates(): Promise<RuleState[]>;
  saveRuleState(state: RuleState): Promise<void>;
  snapshot(): Promise<Data>;
  mergeFromSync(json: string, now?: number, epoch?: number): Promise<void>;
  syncDataState(): Promise<SyncDataState>;
  onSyncInvalidated(listener: (state: SyncDataState) => void): () => void;
  resumeSync(epoch: number): Promise<void>;
  deleteSecret(key: string): Promise<void>;
  reserveSyncPush(now: number): Promise<boolean>;
  restore(
    data: Data,
    mode: "replace" | "merge",
    backedUpAt: number,
  ): Promise<void>;
  undo(): Promise<void>;
  hasUndo(): Promise<boolean>;
  /** Details for the Undo confirmation: when the import ran and how many later reviews are kept. */
  undoInfo(): Promise<
    | {
        at: number;
        mode: "replace" | "merge";
        laterReviews: number;
        laterRules: number;
        laterScans: number;
        laterGames: number;
        laterCards: number;
      }
    | undefined
  >;
  requestPersistence(): Promise<void>;
  close(): void;
}
export async function openProgress(
  options: {
    name?: string;
    onVersionChange?: () => void;
    onBlocked?: () => void;
    onStorageChange?: () => void;
    version?: number;
    migrations?: Migrations;
  } = {},
): Promise<Progress> {
  let closed = false;
  let connection: Promise<IDBPDatabase<ProgressDb>>;
  const connect = () =>
    openDB<ProgressDb>(
      options.name ?? "chess-learning-space",
      options.version ?? schemaVersion,
      {
        upgrade(db, oldVersion, _newVersion, tx) {
          for (const entry of storeRegistry) {
            if (
              entry.since <= (options.version ?? schemaVersion) &&
              !db.objectStoreNames.contains(entry.name)
            )
              db.createObjectStore(
                entry.name,
                entry.key ? { keyPath: entry.key } : undefined,
              );
          }
          // The Undo copy is stored in the old record format; never replay it across an upgrade.
          if (oldVersion > 0 && db.objectStoreNames.contains("preImport"))
            void tx.objectStore("preImport").clear();
          const log = tx.objectStore("reviewLog");
          if (oldVersion < 2 && !log.indexNames.contains("sessionCard"))
            log.createIndex("sessionCard", ["sessionId", "cardId"]);
          // Keep all reads/writes inside this versionchange transaction. A failure aborts the upgrade.
          void (async () => {
            const data = Object.fromEntries(
              await Promise.all(
                stores.map(async (entry) => [
                  entry.name,
                  db.objectStoreNames.contains(entry.name)
                    ? await tx.objectStore(entry.name).getAll()
                    : [],
                ]),
              ),
            ) as unknown as Data;
            const migrated = migrateProgress(
              {
                schemaVersion: oldVersion,
                data,
              },
              options.version ?? schemaVersion,
              options.migrations ?? migrations,
            );
            for (const entry of stores) {
              if (!db.objectStoreNames.contains(entry.name)) continue;
              const target = tx.objectStore(entry.name);
              await target.clear();
              for (const record of migrated.data[entry.name])
                await target.put(
                  record as never,
                  entry.key ? undefined : "current",
                );
            }
          })().catch(() => {
            tx.abort();
          });
        },
        blocked() {
          options.onBlocked?.();
        },
        blocking() {
          closed = true;
          void connection.then((db) => db.close());
          options.onVersionChange?.();
        },
        terminated() {
          if (!closed) connection = connect();
        },
      },
    );
  connection = connect();
  await connection;
  async function database() {
    if (closed) throw new Error("Progress connection is closed");
    return connection;
  }
  const name = options.name ?? "chess-learning-space";
  const listeners =
    syncListeners.get(name) ?? new Set<(state: SyncDataState) => void>();
  syncListeners.set(name, listeners);
  const ownedListeners = new Set<(state: SyncDataState) => void>();
  const channel =
    typeof window !== "undefined" && typeof BroadcastChannel !== "undefined"
      ? new BroadcastChannel(`progress-sync:${name}`)
      : undefined;
  const notify = (state: SyncDataState) => {
    for (const listener of listeners) listener(state);
  };
  if (channel) channel.onmessage = (event: MessageEvent<SyncDataState>) => notify(event.data);
  const publish = (state: SyncDataState) => {
    notify(state);
    channel?.postMessage(state);
  };
  async function invalidate(
    meta: {
      get(key: string): Promise<Metadata | undefined>;
      put(row: Metadata): Promise<unknown>;
    },
    pause: boolean,
  ): Promise<SyncDataState> {
    const epoch = Number((await meta.get("sync:dataEpoch"))?.value ?? 0) + 1;
    const paused = pause || (await meta.get("sync:paused"))?.value === 1;
    await meta.put({ key: "sync:dataEpoch", value: epoch });
    await meta.put({ key: "sync:paused", value: paused ? 1 : 0 });
    return { epoch, paused };
  }
  let persistence: Promise<void> | undefined;
  async function requestPersistence() {
    if (
      (await (await database()).get("metadata", "storage"))?.value ===
      "persistent"
    )
      return;
    let persistent = false;
    try {
      persistent = (await globalThis.navigator?.storage?.persist?.()) ?? false;
    } catch {
      /* best effort */
    }
    await (
      await database()
    ).put("metadata", {
      key: "storage",
      value: persistent ? "persistent" : "best-effort",
    });
    options.onStorageChange?.();
  }
  return {
    async replyWeights() {
      return (await database()).getAll("replyWeights");
    },
    async saveReplyWeights(rows, signal) {
      const checked = rows.map((row) => replyWeightSchema.parse(row));
      const db = await database();
      signal?.throwIfAborted();
      const tx = db.transaction("replyWeights", "readwrite");
      void tx.done.catch(() => {});
      const abort = () => {
        try {
          tx.abort();
        } catch {
          /* Already committed. */
        }
      };
      signal?.addEventListener("abort", abort, { once: true });
      try {
        const merged = mergeReplyWeights(await tx.store.getAll(), checked);
        for (const row of merged) await tx.store.put(row);
        signal?.throwIfAborted();
        await tx.done;
      } catch (error) {
        abort();
        throw error;
      } finally {
        signal?.removeEventListener("abort", abort);
      }
    },
    async personalCards() {
      return (await database()).getAll("personalCards");
    },
    async savePersonalCard(card) {
      const valid = personalCardSchema.parse(card);
      const tx = (await database()).transaction("personalCards", "readwrite");
      void tx.done.catch(() => {});
      const old = await tx.store.get(card.cardId);
      await tx.store.put(mergePersonalCards(old ? [old] : [], [valid])[0]);
      await tx.done;
    },
    async games() {
      return (await database()).getAll("games");
    },
    async importGames(games, signal) {
      const valid = games.map((game) => importedGameSchema.parse(game));
      const tx = (await database()).transaction(["games", "metadata"], "readwrite");
      void tx.done.catch(() => {});
      const abort = () => tx.abort();
      signal?.addEventListener("abort", abort, { once: true });
      try {
        signal?.throwIfAborted();
        let added = 0;
        const index = new GameIndex(await tx.objectStore("games").getAll());
        for (const game of valid) {
          signal?.throwIfAborted();
          if (!index.has(game)) {
            index.add(game);
            await tx.objectStore("games").add(game);
            added++;
          }
        }
        const state = await invalidate(tx.objectStore("metadata"), false);
        signal?.throwIfAborted();
        await tx.done;
        publish(state);
        return added;
      } catch (error) {
        try {
          tx.abort();
        } catch {
          /* Already aborted or committed. */
        }
        throw error;
      } finally {
        signal?.removeEventListener("abort", abort);
      }
    },
    async record(review) {
      const db = await database();
      const hasRating = db.objectStoreNames.contains("puzzleRating");
      const tx = db.transaction(
        hasRating
          ? ["reviewLog", "metadata", "puzzleRating"]
          : ["reviewLog", "metadata"],
        "readwrite",
      );
      void tx.done.catch(() => {});
      const log = tx.objectStore("reviewLog");
      let stored = await log.get(review.attemptId);
      if (!stored) {
        if (review.puzzle && hasRating) {
          const result = preparePuzzleReview(
            review,
            await log.getAll(),
            (await tx.objectStore("puzzleRating").get("current")) ??
              initialRating,
          );
          stored = result.review;
          await tx.objectStore("puzzleRating").put(result.rating, "current");
        } else
          stored = eligibleReview(
            review,
            await log
              .index("sessionCard")
              .getAll([review.sessionId, review.cardId]),
          );
        await log.add(stored);
        const meta = tx.objectStore("metadata");
        if (!(await meta.get("firstReviewAt")))
          await meta.put({ key: "firstReviewAt", value: review.at });
      }
      await tx.done;
      // Durability prompts must never delay or prevent the first review write.
      persistence ??= requestPersistence().catch(() => {
        persistence = undefined;
      });
      return stored;
    },
    async scans() {
      return (await database()).getAll("scanLog");
    },
    async puzzleRating() {
      return (
        (await (await database()).get("puzzleRating", "current")) ?? {
          ...initialRating,
        }
      );
    },
    async woodpeckerSets() {
      return (await database()).getAll("woodpeckerSets");
    },
    async saveWoodpeckerSet(set) {
      storeRegistry
        .find((entry) => entry.name === "woodpeckerSets")!
        .schema.parse([set]);
      await (await database()).put("woodpeckerSets", set);
    },
    async recordScan(attempt) {
      scanAttemptSchema.parse(attempt);
      const tx = (await database()).transaction("scanLog", "readwrite");
      void tx.done.catch(() => {});
      if (!(await tx.store.get(attempt.attemptId))) await tx.store.add(attempt);
      await tx.done;
      persistence ??= requestPersistence().catch(() => {
        persistence = undefined;
      });
    },
    async reviews() {
      return (await database()).getAll("reviewLog");
    },
    async metadata(key) {
      return (await database()).get("metadata", key);
    },
    async setMetadata(records) {
      const tx = (await database()).transaction("metadata", "readwrite");
      void tx.done.catch(() => {});
      for (const record of records) await tx.store.put(record);
      await tx.done;
    },
    async secret(key) {
      return (await database()).get("secrets", key);
    },
    async saveSecret(key, value) {
      await (await database()).put("secrets", value, key);
    },
    async syncDataState() {
      const tx = (await database()).transaction("metadata");
      const epoch = Number((await tx.store.get("sync:dataEpoch"))?.value ?? 0);
      const paused = (await tx.store.get("sync:paused"))?.value === 1;
      await tx.done;
      return { epoch, paused };
    },
    onSyncInvalidated(listener) {
      listeners.add(listener);
      ownedListeners.add(listener);
      return () => {
        listeners.delete(listener);
        ownedListeners.delete(listener);
      };
    },
    async resumeSync(epoch) {
      const tx = (await database()).transaction("metadata", "readwrite");
      void tx.done.catch(() => {});
      if (Number((await tx.store.get("sync:dataEpoch"))?.value ?? 0) !== epoch) {
        await tx.done;
        throw new SyncEpochChanged();
      }
      await tx.store.put({ key: "sync:paused", value: 0 });
      await tx.done;
      publish({ epoch, paused: false });
    },
    async reserveSyncPush(now) {
      // Serialize reservations across tabs. Count attempts, including conflicts and uncertain responses.
      const month = new Date(now).toISOString().slice(0, 7);
      const tx = (await database()).transaction("metadata", "readwrite");
      const savedMonth = (await tx.store.get("sync:pushMonth"))?.value;
      const count =
        savedMonth === month
          ? Number((await tx.store.get("sync:pushCount"))?.value ?? 0)
          : 0;
      if (!Number.isSafeInteger(count) || count < 0 || count >= 400) {
        await tx.done;
        return false;
      }
      await tx.store.put({ key: "sync:pushMonth", value: month });
      await tx.store.put({ key: "sync:pushCount", value: count + 1 });
      await tx.done;
      return true;
    },
    async deleteSecret(key) {
      await (await database()).delete("secrets", key);
    },
    async settings() {
      return (await database()).get("settings", "current");
    },
    async saveSettings(settings) {
      await (await database()).put("settings", settings, "current");
    },
    async ruleStates() {
      return (await database()).getAll("ruleState");
    },
    async saveRuleState(state) {
      await (await database()).put("ruleState", state);
    },
    requestPersistence,
    async snapshot() {
      const tx = (await database()).transaction(stores.map((s) => s.name));
      const data = Object.fromEntries(
        await Promise.all(
          stores.map(async (s) => [
            s.name,
            await tx.objectStore(s.name).getAll(),
          ]),
        ),
      ) as unknown as Data;
      await tx.done;
      return data;
    },
    async mergeFromSync(json, now = Date.now(), epoch) {
      const data = validateBackup(json, now);
      const tx = (await database()).transaction(
        [...stores.map((s) => s.name), "preImport"],
        "readwrite",
      );
      void tx.done.catch(() => {});
      try {
        if (
          epoch !== undefined &&
          Number((await tx.objectStore("metadata").get("sync:dataEpoch"))?.value ?? 0) !== epoch
        ) throw new SyncEpochChanged();
        const local = Object.fromEntries(
          await Promise.all(
            stores.map(async (s) => [
              s.name,
              await tx.objectStore(s.name).getAll(),
            ]),
          ),
        ) as unknown as Data;
        const merged = { ...local };
        for (const entry of stores) {
          if (entry.name === "settings" || entry.name === "metadata") continue;
          const records =
            entry.name === "ruleState"
              ? mergeRuleStates(
                  derivedRuleStates(local.ruleState, local.reviewLog),
                  derivedRuleStates(data.ruleState, data.reviewLog),
                )
              : entry.merge(
                  local[entry.name] as never,
                  data[entry.name] as never,
                );
          Object.assign(merged, { [entry.name]: records });
        }
        // Validate the COMPLETE union (including caps and cross-copy ID conflicts) before writes.
        for (const name of ["reviewLog", "scanLog"] as const) {
          // Zod normalizes object property order before comparing identical facts.
          const schema =
            name === "reviewLog"
              ? storeRegistry.find((entry) => entry.name === "reviewLog")!
                  .schema
              : scanAttemptSchema.array();
          const known = new Map(
            schema
              .parse(local[name])
              .map((r) => [r.attemptId, JSON.stringify(r)]),
          );
          if (
            data[name].some(
              (r) =>
                known.has(r.attemptId) &&
                known.get(r.attemptId) !== JSON.stringify(r),
            )
          )
            throw new Error(
              "Conflicting copies of a review attempt were found.",
            );
        }
        validateBackup(serializeBackup(merged), now);
        for (const entry of stores) {
          if (entry.name === "settings" || entry.name === "metadata") continue;
          const target = tx.objectStore(entry.name);
          await target.clear();
          for (const record of merged[entry.name])
            await target.put(
              record as never,
              entry.key ? undefined : "current",
            );
        }
        const first = merged.reviewLog.reduce((at, row) => Math.min(at, row.at), Infinity);
        if (Number.isFinite(first))
          await tx.objectStore("metadata").put({ key: "firstReviewAt", value: first });
        else await tx.objectStore("metadata").delete("firstReviewAt");
        const copy = await tx.objectStore("preImport").get("last");
        if (copy) {
          const edited = new Set(laterRuleStates(copy, local.ruleState).map((row) => row.ruleId));
          const baseline = new Map((copy.ruleStatesAfterImport ?? copy.data.ruleState).map((row) => [row.ruleId, row]));
          const fromReviews = new Map(mergeRuleStates(
            [...baseline.values()],
            derivedRuleStates([], [...local.reviewLog, ...data.reviewLog]),
          ).map((row) => [row.ruleId, row]));
          // Only baseline review-derived rows. Independent remote marks are later work too.
          for (const row of merged.ruleState) {
            const derived = fromReviews.get(row.ruleId);
            if (!edited.has(row.ruleId) && derived &&
              derived.learned === row.learned && derived.learnedAt === row.learnedAt &&
              derived.updatedAt === row.updatedAt) baseline.set(row.ruleId, row);
          }
          await tx.objectStore("preImport").put({ ...copy, ruleStatesAfterImport: [...baseline.values()] }, "last");
        }
        await tx.done;
      } catch (error) {
        try {
          tx.abort();
        } catch {
          /* already aborted */
        }
        throw error;
      }
    },
    async restore(data, mode, backedUpAt) {
      const tx = (await database()).transaction(
        [...stores.map((s) => s.name), "preImport", "secrets"],
        "readwrite",
      );
      void tx.done.catch(() => {});
      try {
        const local = Object.fromEntries(
          await Promise.all(
            stores.map(async (s) => [
              s.name,
              await tx.objectStore(s.name).getAll(),
            ]),
          ),
        ) as unknown as Data;
        // Reject game conflicts before even writing the Undo point.
        if (mode === "merge") mergeGames(local.games, data.games);
        // This write shares the restore transaction: a quota failure changes nothing.
        await tx
          .objectStore("preImport")
          .put({ data: local, at: backedUpAt, mode }, "last");
        for (const entry of stores) {
          const target = tx.objectStore(entry.name);
          if (mode === "replace") {
            // Older backups may not include settings. Keep this browser's preferences.
            if (entry.name === "settings" && data.settings.length === 0)
              continue;
            await target.clear();
            for (const record of data[entry.name])
              await target.put(
                record as never,
                entry.key ? undefined : "current",
              );
          } else {
            // Apply the OR rule to each side's read model before unioning logs:
            // an unlearn mark on one device cannot erase learning on the other.
            const merged =
              entry.name === "ruleState"
                ? mergeRuleStates(
                    derivedRuleStates(local.ruleState, local.reviewLog),
                    derivedRuleStates(data.ruleState, data.reviewLog),
                  )
                : entry.merge(
                    local[entry.name] as never,
                    data[entry.name] as never,
                  );
            for (const record of merged) {
              const key = entry.key
                ? (record as unknown as Record<string, string>)[entry.key]
                : "current";
              // The merge rule decides the winner; a union alone cannot express
              // "learned if learned in either" for an existing key.
              await target.put(record as never, entry.key ? undefined : key);
            }
          }
        }
        // Device persistence and backup counters are local to this browser.
        const meta = tx.objectStore("metadata");
        if (mode === "replace") {
          for (const record of local.metadata) {
            if (!["firstReviewAt", "lastExportAt"].includes(record.key))
              await meta.put(record);
          }
        }
        const reviews = await tx.objectStore("reviewLog").getAll();
        const localIds = new Set(local.reviewLog.map((r) => r.attemptId));
        const localScanIds = new Set(local.scanLog.map((r) => r.attemptId));
        const localGameIds = new Set(local.games.map((g) => g.id));
        await tx.objectStore("preImport").put(
          {
            data: local,
            at: backedUpAt,
            mode,
            cardsAfterImport: await tx.objectStore("personalCards").getAll(),
            ruleStatesAfterImport: await tx.objectStore("ruleState").getAll(),
            setsAfterImport: await tx.objectStore("woodpeckerSets").getAll(),
            weightsAfterImport: await tx.objectStore("replyWeights").getAll(),
            importedGameIds: (await tx.objectStore("games").getAll())
              .map((g) => g.id)
              .filter((id) => !localGameIds.has(id)),
            importedScanIds: (await tx.objectStore("scanLog").getAll())
              .map((r) => r.attemptId)
              .filter((id) => !localScanIds.has(id)),
            importedIds: reviews
              .map((r) => r.attemptId)
              .filter((id) => !localIds.has(id)),
          },
          "last",
        );
        const first = reviews.reduce((at, r) => Math.min(at, r.at), Infinity);
        if (Number.isFinite(first)) {
          if ((await meta.get("firstReviewAt"))?.value !== first)
            await meta.put({ key: "firstReviewAt", value: first });
        } else if (mode === "replace") await meta.delete("firstReviewAt");
        if (mode === "replace") {
          await meta.put({ key: "lastExportAt", value: backedUpAt });
          await meta.put({ key: "exportReviewCount", value: reviews.length });
          await meta.delete("backupDismissedAt");
        }
        const state = await invalidate(
          meta,
          mode === "replace" && !!(await tx.objectStore("secrets").get("sync-code")),
        );
        await tx.done;
        publish(state);
      } catch (error) {
        try {
          tx.abort();
        } catch {
          /* already aborted */
        }
        throw error;
      }
    },
    async hasUndo() {
      return !!(await (await database()).get("preImport", "last"));
    },
    async undoInfo() {
      const db = await database();
      const copy = await db.get("preImport", "last");
      if (!copy) return undefined;
      const later = laterReviews(copy, await db.getAll("reviewLog"));
      return {
        at: copy.at,
        mode: copy.mode,
        laterReviews: later.length,
        laterGames: laterGames(copy, await db.getAll("games")).length,
        laterCards: (await db.getAll("personalCards")).filter(
          (c) =>
            !(copy.cardsAfterImport ?? copy.data.personalCards).some(
              (old) => JSON.stringify(old) === JSON.stringify(c),
            ) || later.some((r) => r.cardId === c.cardId),
        ).length,
        laterScans: laterScans(copy, await db.getAll("scanLog")).length,
        laterRules: laterRuleStates(copy, await db.getAll("ruleState")).length,
      };
    },
    async undo() {
      const tx = (await database()).transaction(
        [...stores.map((s) => s.name), "preImport", "secrets"],
        "readwrite",
      );
      void tx.done.catch(() => {});
      try {
        const copy = await tx.objectStore("preImport").get("last");
        if (!copy) throw new Error("There is no import to undo.");
        const later = laterReviews(
          copy,
          await tx.objectStore("reviewLog").getAll(),
        );
        const games = laterGames(copy, await tx.objectStore("games").getAll());
        const baselineCards = new Map(
          (copy.cardsAfterImport ?? copy.data.personalCards).map((c) => [
            c.cardId,
            JSON.stringify(c),
          ]),
        );
        const laterCards = (
          await tx.objectStore("personalCards").getAll()
        ).filter(
          (c) =>
            baselineCards.get(c.cardId) !== JSON.stringify(c) ||
            later.some((r) => r.cardId === c.cardId),
        );
        const scans = laterScans(
          copy,
          await tx.objectStore("scanLog").getAll(),
        );
        const laterRules = laterRuleStates(
          copy,
          await tx.objectStore("ruleState").getAll(),
        );
        const baselineSets = new Map(
          (copy.setsAfterImport ?? copy.data.woodpeckerSets).map((s) => [
            s.id,
            JSON.stringify(s),
          ]),
        );
        const laterSetIds = new Set(
          later.map((r) => r.puzzle?.setId).filter(Boolean),
        );
        const laterSets = (
          await tx.objectStore("woodpeckerSets").getAll()
        ).filter(
          (s) =>
            laterSetIds.has(s.id) ||
            baselineSets.get(s.id) !== JSON.stringify(s),
        );
        const baselineWeights = new Map(
          (copy.weightsAfterImport ?? copy.data.replyWeights).map((row) => [
            row.id,
            JSON.stringify(row),
          ]),
        );
        const laterWeights = (
          await tx.objectStore("replyWeights").getAll()
        ).filter((row) => baselineWeights.get(row.id) !== JSON.stringify(row));
        const syncMetadata = (await tx.objectStore("metadata").getAll()).filter(
          (row) => row.key.startsWith("sync:"),
        );
        for (const entry of stores) {
          const target = tx.objectStore(entry.name);
          await target.clear();
          for (const record of copy.data[entry.name])
            await target.put(
              record as never,
              entry.key ? undefined : "current",
            );
        }
        for (const row of syncMetadata)
          await tx.objectStore("metadata").put(row);
        for (const row of mergeReplyWeights(
          copy.data.replyWeights,
          laterWeights,
        ))
          await tx.objectStore("replyWeights").put(row);
        // Reviews recorded after the import belong to the learner, not to the import: keep them.
        const log = tx.objectStore("reviewLog");
        for (const review of later) await log.put(review);
        for (const scan of scans) await tx.objectStore("scanLog").put(scan);
        for (const card of mergePersonalCards(
          copy.data.personalCards,
          laterCards,
        ))
          await tx.objectStore("personalCards").put(card);
        for (const game of games) await tx.objectStore("games").put(game);
        for (const state of laterRules)
          await tx.objectStore("ruleState").put(state);
        for (const set of laterSets)
          await tx.objectStore("woodpeckerSets").put(set);
        // Undo restores the pre-import rating, then applies the learner's later rated work.
        let rating = copy.data.puzzleRating[0] ?? initialRating;
        const seen = new Set(copy.data.reviewLog.map((r) => r.cardId));
        // Only a counted rated review claims its puzzle; an unrated retry with an
        // earlier clock must not hide the rated first attempt.
        for (const review of ordered(later)) {
          if (!review.puzzle?.rated || seen.has(review.cardId)) continue;
          rating = {
            ...glicko2(rating, [
              {
                rating: review.puzzle.rating,
                rd: review.puzzle.rd,
                score: review.grade === "good" ? 1 : 0,
              },
            ]),
            ratedAttempts: rating.ratedAttempts + 1,
          };
          seen.add(review.cardId);
        }
        if (copy.data.puzzleRating.length || later.some((r) => r.puzzle?.rated))
          await tx.objectStore("puzzleRating").put(rating, "current");
        const all = await log.getAll();
        const first = all.reduce((at, r) => Math.min(at, r.at), Infinity);
        const meta = tx.objectStore("metadata");
        if (Number.isFinite(first))
          await meta.put({ key: "firstReviewAt", value: first });
        else await meta.delete("firstReviewAt");
        await tx.objectStore("preImport").delete("last");
        const state = await invalidate(meta, !!(await tx.objectStore("secrets").get("sync-code")));
        await tx.done;
        publish(state);
      } catch (error) {
        try {
          tx.abort();
        } catch {
          /* already aborted */
        }
        throw error;
      }
    },
    close() {
      for (const listener of ownedListeners) listeners.delete(listener);
      channel?.close();
      closed = true;
      void connection.then((db) => db.close());
    },
  };
}
