import { SyncEpochChanged, type Data, type Progress } from "../progress/Progress";
import { serializeBackup, validateBackup } from "../progress/Backup";
import { exportData } from "../progress/stores";
import { deriveKeys, encrypt, decrypt } from "./crypto";
import { SyncClient, SyncHttpError } from "./client";
export type SyncStatus = {
  kind: "off" | "paused" | "syncing" | "synced" | "offline" | "error";
  at?: number;
  message?: string;
};
const pullInterval = 5 * 60_000,
  pushInterval = 120 * 60_000;
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
/** Content revision ignores device settings and backup bookkeeping. Survives reloads and other-tab writes. */
async function revision(data: Data) {
  const exported = exportData(data);
  delete exported.settings;
  delete exported.metadata;
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(
      canonical(
        Object.fromEntries(
          Object.entries(exported).map(([key, rows]) => [
            key,
            (rows as unknown[]).map(canonical).sort(),
          ]),
        ),
      ),
    ),
  );
  return [...new Uint8Array(hash)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
interface Options {
  fetcher?: typeof fetch;
  clock?: () => number;
  onMerged?: () => Promise<void>;
  onStatus?: (status: SyncStatus) => void;
  appVersion?: string;
  contentVersions?: Record<string, string>;
}
export class SyncEngine {
  status: SyncStatus = { kind: "off" };
  private running: Promise<void> | null = null;
  private lastPull = 0;
  private paused = false;
  private clock: () => number;
  private controller?: AbortController;
  private epoch?: number;
  private unsubscribe?: () => void;
  constructor(
    private store: Progress,
    private options: Options = {},
  ) {
    this.clock = options.clock ?? Date.now;
    this.watch();
  }
  private watch() {
    if (this.unsubscribe) return;
    this.unsubscribe = this.store.onSyncInvalidated((state) => {
      if (this.epoch !== undefined && state.epoch !== this.epoch) this.controller?.abort();
      if (state.paused) this.set({ kind: "paused" });
    });
  }
  private set(status: SyncStatus) {
    this.status = status;
    this.options.onStatus?.(status);
  }
  sync(options: { manual?: boolean; pull?: boolean } = {}): Promise<void> {
    return this.start(options.manual ?? true, options.pull ?? true);
  }
  private start(manual: boolean, pull: boolean, replaceCloud = false): Promise<void> {
    this.watch();
    if (this.paused) return Promise.resolve();
    if (this.running) return this.running;
    const execute = () =>
      this.run(manual, pull, replaceCloud);
    const operation = globalThis.navigator?.locks
      ? navigator.locks.request("chess-learning-space-sync", execute)
      : execute();
    this.running = operation.finally(() => {
      this.running = null;
    });
    return this.running;
  }
  private async run(manual: boolean, pull: boolean, replaceCloud: boolean) {
    const controller = new AbortController();
    this.controller = controller;
    try {
      const code = await this.store.secret("sync-code");
      if (!code) {
        this.set({ kind: "off" });
        return;
      }
      const state = await this.store.syncDataState();
      this.epoch = state.epoch;
      if (state.paused && !replaceCloud) {
        this.set({ kind: "paused" });
        return;
      }
      const check = async () => {
        const current = await this.store.syncDataState();
        if (current.epoch !== state.epoch) controller.abort();
        if (controller.signal.aborted) throw new SyncEpochChanged();
      };
      const keys = await deriveKeys(code),
        client = new SyncClient(keys.authToken, this.options.fetcher, controller.signal);
      await check();
      const prefix = `sync:${keys.hash}:`;
      const meta = async (key: string) =>
        (await this.store.metadata(prefix + key))?.value;
      const lastPush = Number((await meta("lastPush")) ?? 0);
      const previous = await meta("revision");
      if (!manual && pull && this.clock() - this.lastPull < pullInterval)
        return;
      const dirty = (await revision(await this.store.snapshot())) !== previous;
      const canPush = manual || this.clock() - lastPush >= pushInterval;
      if (
        !manual &&
        (!pull || this.clock() - this.lastPull < pullInterval) &&
        (!dirty || !canPush)
      )
        return;
      this.lastPull = this.clock();
      this.set({ kind: "syncing" });
      for (let attempt = 0; attempt < 3; attempt++) {
        await check();
        const remote = replaceCloud ? null : await client.pull();
        await check();
        let remoteRevision: string | undefined;
        let beforeMerge: string | undefined;
        if (remote) {
          const json = await decrypt(remote.bytes, keys);
          // Shared strict import validator rejects newer schemas before the merge transaction.
          remoteRevision = await revision(validateBackup(json, this.clock()));
          beforeMerge = await revision(await this.store.snapshot());
          await check();
          await this.store.mergeFromSync(json, this.clock(), state.epoch);
        }
        await check();
        const snapshot = await this.store.snapshot();
        const current = await revision(snapshot);
        if (remote && current !== beforeMerge) await this.options.onMerged?.();
        const needsPush = remote ? current !== remoteRevision : dirty || manual;
        if (needsPush && !canPush) {
          this.set({
            kind: "synced",
            at: this.clock(),
            message:
              "Cloud changes merged; local changes wait for the 120-minute upload interval.",
          });
          return;
        }
        if (needsPush) {
          const bytes = await encrypt(
            serializeBackup(
              snapshot,
              this.options.appVersion,
              this.options.contentVersions,
              this.clock(),
            ),
            keys,
          );
          await check();
          if (!(await this.store.reserveSyncPush(this.clock())))
            throw new Error(
              "Monthly limit of 400 sync upload attempts reached in this browser. Keep learning offline, export JSON, and retry next month.",
            );
          // Record BEFORE network IO, so uncertain uploads/reloads still respect the interval.
          await this.store.setMetadata([
            { key: prefix + "lastPush", value: this.clock() },
          ]);
          try {
            await check();
            if (replaceCloud) {
              await client.delete();
              await check();
            }
            await client.push(bytes, remote?.etag ?? null);
            await check();
          } catch (error) {
            if (
              error instanceof SyncHttpError &&
              error.status === 412 &&
              attempt < 2 && !replaceCloud
            )
              continue;
            throw error;
          }
        }
        await check();
        if (replaceCloud) await this.store.resumeSync(state.epoch);
        await this.store.setMetadata([
          { key: prefix + "revision", value: current },
          { key: prefix + "lastSynced", value: this.clock() },
        ]);
        const month = new Date(this.clock()).toISOString().slice(0, 7);
        const count = (await this.store.metadata("sync:pushMonth"))?.value === month
          ? Number((await this.store.metadata("sync:pushCount"))?.value ?? 0) : 0;
        await check();
        this.set({ kind: "synced", at: this.clock(), ...(count >= 360 ? { message: `Monthly upload limit is near: ${count} of 400 attempts used in this browser. Export JSON if needed.` } : {}) });
        return;
      }
    } catch (error) {
      if (controller.signal.aborted || error instanceof SyncEpochChanged) {
        const state = await this.store.syncDataState();
        this.set({ kind: state.paused ? "paused" : "off", message: state.paused ? undefined : "Local data changed. Retry Sync now." });
        return;
      }
      const offline =
        globalThis.navigator?.onLine === false ||
        error instanceof TypeError ||
        (error instanceof DOMException && error.name === "TimeoutError");
      const message =
        error instanceof Error
          ? error.message
          : "Sync failed. Keep a JSON backup and retry Sync now.";
      this.set({
        kind: replaceCloud ? "paused" : offline ? "offline" : "error",
        message: offline
          ? "Offline. Keep learning; retry Sync now when connected."
          : message,
      });
      throw error;
    } finally {
      this.controller = undefined;
      this.epoch = undefined;
    }
  }
  dispose() {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.controller?.abort();
  }
  async resumeAndMerge() {
    await this.running?.catch(() => {});
    const state = await this.store.syncDataState();
    await this.store.resumeSync(state.epoch);
    this.lastPull = 0;
    await this.sync();
  }
  async replaceCloudWithDevice() {
    await this.running?.catch(() => {});
    await this.start(true, true, true);
  }
  async turnOff() {
    this.paused = true;
    try {
      await this.running?.catch(() => {});
      await this.store.deleteSecret("sync-code");
      this.set({ kind: "off" });
    } finally {
      this.paused = false;
    }
  }
  async deleteCloud() {
    this.paused = true;
    try {
      await this.running?.catch(() => {});
      const code = await this.store.secret("sync-code");
      if (!code) return;
      const keys = await deriveKeys(code);
      await new SyncClient(keys.authToken, this.options.fetcher).delete();
      await this.store.deleteSecret("sync-code");
      this.set({ kind: "off" });
    } finally {
      this.paused = false;
    }
  }
}
