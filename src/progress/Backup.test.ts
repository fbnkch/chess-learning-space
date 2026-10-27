import "fake-indexeddb/auto";
import { expect, it, vi } from "vitest";
import { storeRegistry } from "./stores";
import { validateBackup } from "./Backup";
import { openProgress, schemaVersion } from "./Progress";
import { Backup, maxBackupBytes } from "./Backup";
import { openDB } from "idb";
import type { Settings } from "../settings";
import { rebuild } from "../scheduler/Scheduler";
import type { Review } from "../scheduler/Scheduler";

const review: Review = {
  attemptId: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
  sessionId: "session",
  cardId: "rep:white:retired",
  at: 1_790_000_000_000,
  grade: "good",
  context: "repertoire",
  hintsUsed: 0,
  durationMs: 100,
  schedulingEligible: true,
};
const settings = {
  sound: false,
  animationMs: 100,
  coordinates: true,
  reducedMotion: false,
};
const clock = () => review.at + 1000;
async function fixture() {
  const name = crypto.randomUUID();
  const store = await openProgress({ name });
  const download = vi
    .fn<(json: string, name: string) => Promise<void>>()
    .mockResolvedValue();
  return {
    name,
    store,
    download,
    backup: new Backup(store, {
      download,
      clock,
      appVersion: "1.0.0",
      contentVersions: { repertoire: "test" },
    }),
  };
}
it("roundtrips reviews and settings, then rebuilds scheduling from the imported log", async () => {
  const source = await fixture();
  const target = await fixture();
  const themedSettings: Settings = {
    ...settings,
    colorMode: "dark",
    colorTheme: "forest",
  };
  try {
    await source.store.record(review);
    await source.store.saveSettings(themedSettings);
    await source.backup.export();
    const json = source.download.mock.calls[0][0];
    expect(JSON.parse(json)).toMatchObject({
      format: "chess-learning-space",
      appVersion: "1.0.0",
      exportedAt: new Date(clock()).toISOString(),
    });
    await target.backup.import(json, "replace");
    await target.backup.undo();
    expect(await target.store.reviews()).toEqual([]);
    await target.backup.import(json, "replace");
    expect(await target.store.reviews()).toEqual([review]);
    expect(await target.store.settings()).toEqual(themedSettings);
    expect(
      rebuild(await target.store.reviews()).get(review.cardId),
    ).toMatchObject({ reps: 1, intervalDays: 1 });
    expect(target.download).toHaveBeenCalledTimes(2);
    expect(await source.store.metadata("lastExportAt")).toEqual({
      key: "lastExportAt",
      value: clock(),
    });
  } finally {
    source.store.close();
    target.store.close();
  }
});

it("merges by attemptId only, preserving local conflicts/settings and same-session attempts", async () => {
  const source = await fixture();
  const target = await fixture();
  try {
    await source.store.record(review);
    await source.store.record({
      ...review,
      attemptId: "01ARZ3NDEKTSV4RRFFQ69G5FAW",
      schedulingEligible: false,
    });
    await source.store.saveSettings(settings);
    await source.backup.export();
    await target.store.record({ ...review, grade: "again" });
    const local = { ...settings, sound: true };
    await target.store.saveSettings(local);
    await target.backup.import(source.download.mock.calls[0][0], "merge");
    expect(await target.store.reviews()).toEqual([
      { ...review, grade: "again" },
      {
        ...review,
        attemptId: "01ARZ3NDEKTSV4RRFFQ69G5FAW",
        schedulingEligible: false,
      },
    ]);
    expect(await target.store.settings()).toEqual(local);
    await target.backup.import(source.download.mock.calls[0][0], "merge");
    expect(await target.store.reviews()).toHaveLength(2);
  } finally {
    source.store.close();
    target.store.close();
  }
});
it("replace removes existing progress and restores incoming settings", async () => {
  const source = await fixture();
  const target = await fixture();
  try {
    await target.store.record(review);
    await target.store.saveSettings(settings);
    await source.backup.export();
    await target.backup.import(source.download.mock.calls[0][0], "replace");
    expect(await target.store.reviews()).toEqual([]);
    expect(await target.store.settings()).toEqual(settings);
    expect(JSON.parse(target.download.mock.calls[0][0]).data.reviewLog).toEqual(
      [review],
    );
  } finally {
    source.store.close();
    target.store.close();
  }
});
it.each([
  "bad JSON",
  "format",
  "size",
  "schema",
  "newer",
  "unknown store",
  "reference",
  "duplicate",
  "invalid settings",
])("rejects %s without changing any progress", async (kind) => {
  const f = await fixture();
  try {
    await f.store.record(review);
    await f.backup.export();
    const envelope = JSON.parse(f.download.mock.calls[0][0]);
    if (kind === "invalid settings") envelope.data.settings = null;
    if (kind === "format") envelope.format = "other";
    if (kind === "schema") envelope.data.reviewLog[0].grade = "great";
    if (kind === "newer") envelope.schemaVersion = 999;
    if (kind === "unknown store") envelope.data.secrets = [];
    if (kind === "reference") envelope.data.reviewLog[0].cardId = "unknown";
    if (kind === "duplicate")
      envelope.data.reviewLog.push({
        ...envelope.data.reviewLog[0],
        grade: "again",
      });
    const json =
      kind === "bad JSON"
        ? "{"
        : kind === "size"
          ? " ".repeat(maxBackupBytes + 1)
          : JSON.stringify(envelope);
    const before = await f.store.snapshot();
    await expect(f.backup.import(json, "replace")).rejects.toThrow();
    expect(await f.store.snapshot()).toEqual(before);
    expect(f.download).toHaveBeenCalledOnce();
  } finally {
    f.store.close();
  }
});
it.each([0, 1, 2, 3, 4])(
  "migrates schema %i through the shared forward path",
  async (version) => {
    const f = await fixture();
    try {
      await f.store.record(review);
      await f.backup.export();
      const envelope = JSON.parse(f.download.mock.calls[0][0]);
      envelope.schemaVersion = version;
      delete envelope.data.settings;
      await f.backup.import(JSON.stringify(envelope), "replace");
      expect(await f.store.reviews()).toEqual([review]);
    } finally {
      f.store.close();
    }
  },
);
it("excludes the secrets store and non-allowlisted metadata from exports and snapshots", async () => {
  const name = crypto.randomUUID();
  const store = await openProgress({ name });
  const db = await openDB(name);
  try {
    await db.put("secrets", "super-secret-token", "lichess");
    await store.saveSecret(
      "lichess-explorer-token",
      "fake-explorer-private-value",
    );
    await store.setMetadata([{ key: "unexpected-secret", value: "hidden" }]);
    const download = vi.fn().mockResolvedValue(undefined);
    const backup = new Backup(store, {
      download,
      clock,
      appVersion: "1",
      contentVersions: {},
    });
    await backup.export();
    const json = download.mock.calls[0][0];
    expect(json).not.toContain("secret");
    expect(json).not.toContain("hidden");
    expect(json).not.toContain("fake-explorer-private-value");
    expect(json).not.toContain("lichess-explorer-token");
    await backup.import(json, "replace");
    expect(download.mock.calls[1][0]).not.toContain("secret");
    expect(await db.get("secrets", "lichess")).toBe("super-secret-token");
    expect(JSON.stringify(await db.get("preImport", "last"))).not.toContain(
      "fake-explorer-private-value",
    );
    await backup.import(json, "merge");
    await backup.undo();
    expect(await store.secret("lichess-explorer-token")).toBe(
      "fake-explorer-private-value",
    );
  } finally {
    db.close();
    store.close();
  }
});
it("keeps Undo available if the optional snapshot cannot download", async () => {
  const f = await fixture();
  try {
    await f.backup.export();
    const json = f.download.mock.calls[0][0];
    await f.store.record(review);
    await vi.waitFor(async () =>
      expect(await f.store.metadata("storage")).toBeDefined(),
    );
    const before = await f.store.snapshot();
    f.download.mockRejectedValueOnce(new Error("Download failed"));
    await expect(f.backup.import(json, "replace")).resolves.toContain(
      "could not be saved",
    );
    await f.backup.undo();
    expect(await f.store.snapshot()).toEqual({ ...before, metadata: [...before!.metadata,
      { key: "sync:dataEpoch", value: 2 }, { key: "sync:paused", value: 0 },
    ] });
  } finally {
    f.store.close();
  }
});
it("does not mark a failed export as backed up", async () => {
  const f = await fixture();
  try {
    f.download.mockRejectedValueOnce(new Error("Download failed"));
    await expect(f.backup.export()).rejects.toThrow("Download failed");
    expect(await f.store.metadata("lastExportAt")).toBeUndefined();
  } finally {
    f.store.close();
  }
});
it("rolls back all stores on an async request failure after successful writes, including after reopening", async () => {
  const source = await fixture();
  const target = await fixture();
  let reopened;
  try {
    await source.store.record(review);
    await source.store.saveSettings(settings);
    await source.backup.export();
    await target.store.record({
      ...review,
      attemptId: "01ARZ3NDEKTSV4RRFFQ69G5FAX",
      grade: "again",
    });
    await target.store.saveSettings({ ...settings, sound: true });
    await vi.waitFor(async () =>
      expect(await target.store.metadata("storage")).toBeDefined(),
    );
    const before = await target.store.snapshot();
    const original = IDBObjectStore.prototype.put;
    let succeededWrites = 0;
    const put = vi
      .spyOn(IDBObjectStore.prototype, "put")
      .mockImplementation(function (this: IDBObjectStore, value, key) {
        // reviewLog was cleared and written before settings. add an existing key to provoke a real async ConstraintError.
        if (this.name === "settings") {
          expect(succeededWrites).toBeGreaterThan(0);
          const request = this.add(value, key);
          this.add(value, key);
          return request;
        }
        const request = original.call(this, value, key);
        request.addEventListener("success", () => succeededWrites++);
        return request;
      });
    try {
      await expect(
        target.backup.import(source.download.mock.calls[0][0], "replace"),
      ).rejects.toThrow("Nothing was changed.");
    } finally {
      put.mockRestore();
    }
    target.store.close();
    reopened = await openProgress({ name: target.name });
    expect(await reopened.snapshot()).toEqual(before);
    expect(await reopened.hasUndo()).toBe(false);
  } finally {
    source.store.close();
    target.store.close();
    reopened?.close();
  }
});
it("does not change any data if saving the internal safety copy exceeds quota", async () => {
  const f = await fixture();
  try {
    await f.store.record(review);
    await f.store.saveSettings(settings);
    await f.backup.export();
    const before = await f.store.snapshot();
    const original = IDBObjectStore.prototype.put;
    const put = vi
      .spyOn(IDBObjectStore.prototype, "put")
      .mockImplementation(function (this: IDBObjectStore, value, key) {
        if (this.name === "preImport")
          throw new DOMException("Full", "QuotaExceededError");
        return original.call(this, value, key);
      });
    try {
      await expect(
        f.backup.import(f.download.mock.calls[0][0], "replace"),
      ).rejects.toThrow("Nothing was changed.");
    } finally {
      put.mockRestore();
    }
    expect(await f.store.snapshot()).toEqual(before);
    expect(await f.store.hasUndo()).toBe(false);
  } finally {
    f.store.close();
  }
});
it("Undo restores the exact pre-import data including a review added during the optional download", async () => {
  const f = await fixture();
  try {
    await f.backup.export();
    const json = f.download.mock.calls[0][0];
    let before = await f.store.snapshot();
    f.download.mockImplementationOnce(async () => {
      await f.store.record(review);
      await f.store.saveSettings(settings);
      await vi.waitFor(async () =>
        expect(await f.store.metadata("storage")).toBeDefined(),
      );
      before = await f.store.snapshot();
    });
    await f.backup.import(json, "replace");
    await f.backup.undo();
    expect(await f.store.snapshot()).toEqual({ ...before, metadata: [...before!.metadata,
      { key: "sync:dataEpoch", value: 2 }, { key: "sync:paused", value: 0 },
    ] });
  } finally {
    f.store.close();
  }
});
it("nudges at seven days or 200 reviews and dismissal lasts until the next threshold", async () => {
  const f = await fixture();
  let now = review.at;
  const backup = new Backup(f.store, {
    download: f.download,
    clock: () => now,
    appVersion: "1",
    contentVersions: {},
  });
  try {
    expect(await backup.nudge()).toBe(false);
    await f.store.record(review);
    now += 7 * 86400000 - 1;
    expect(await backup.nudge()).toBe(false);
    now++;
    expect(await backup.nudge()).toBe(true);
    await backup.dismiss();
    expect(await backup.nudge()).toBe(false);
    now += 7 * 86400000;
    expect(await backup.nudge()).toBe(true);
    await backup.export();
    expect(await backup.nudge()).toBe(false);
    for (let i = 0; i < 199; i++)
      await f.store.record({ ...review, attemptId: `review-${i}` });
    expect(await backup.nudge()).toBe(false);
    await f.store.record({ ...review, attemptId: "review-200" });
    expect(await backup.nudge()).toBe(true);
    await backup.dismiss();
    expect(await backup.nudge()).toBe(false);
    now += 7 * 86400000;
    expect(await backup.nudge()).toBe(true);
  } finally {
    f.store.close();
  }
});

it("roundtrips every exportable registry entry through export, replace and Undo", async () => {
  const source = await fixture();
  const target = await fixture();
  try {
    await source.store.record(review);
    await source.store.saveSettings(settings);
    await source.backup.export();
    const exported = JSON.parse(source.download.mock.calls[0][0]);
    const parsed = target.backup.preview(source.download.mock.calls[0][0]);
    const before = await target.store.snapshot();
    await expect(
      target.backup.import(
        validateBackup(source.download.mock.calls[0][0], clock()) as never,
        "replace",
      ),
    ).rejects.toThrow("Nothing was changed.");
    await target.backup.import(parsed, "replace");
    const after = await target.store.snapshot();
    for (const entry of storeRegistry) {
      if (!entry.exportable) {
        expect(exported.data).not.toHaveProperty(entry.name);
        continue;
      }
      expect(exported.data).toHaveProperty(entry.name);
      if (entry.name !== "metadata")
        expect(after[entry.name]).toEqual(parsed[entry.name]);
      else
        expect(after.metadata).toEqual(expect.arrayContaining(parsed.metadata));
    }
    await target.backup.undo();
    expect(await target.store.snapshot()).toEqual({ ...before, metadata: [...before.metadata,
      { key: "sync:dataEpoch", value: 2 }, { key: "sync:paused", value: 0 },
    ] });
  } finally {
    source.store.close();
    target.store.close();
  }
});
it.each(["ulid", "practice", "woodpecker", "future"])(
  "rejects semantic review error %s using the injected clock",
  async (kind) => {
    const f = await fixture();
    try {
      await f.store.record(review);
      await f.backup.export();
      const file = JSON.parse(f.download.mock.calls[0][0]);
      const r = file.data.reviewLog[0];
      if (kind === "ulid") r.attemptId = "bad";
      if (kind === "practice" || kind === "woodpecker") r.context = kind;
      if (kind === "future") r.at = clock() + 86400001;
      expect(() => f.backup.preview(JSON.stringify(file))).toThrow(
        /Nothing was changed\.$/,
      );
    } finally {
      f.store.close();
    }
  },
);
it("checks newer version before records and accepts exact duplicate attempts", async () => {
  const f = await fixture();
  try {
    await f.store.record(review);
    await f.backup.export();
    const file = JSON.parse(f.download.mock.calls[0][0]);
    file.schemaVersion = 999;
    file.data = { futureData: "anything" };
    expect(() => f.backup.preview(JSON.stringify(file))).toThrow(
      "needs a newer app version",
    );
    const valid = JSON.parse(f.download.mock.calls[0][0]);
    valid.data.reviewLog.push(valid.data.reviewLog[0]);
    expect(f.backup.preview(JSON.stringify(valid)).reviewLog).toEqual([review]);
  } finally {
    f.store.close();
  }
});
it("Merge preserves export counters and settings and never clears any data", async () => {
  const f = await fixture();
  const source = await fixture();
  try {
    await f.store.setMetadata([
      { key: "lastExportAt", value: 10 },
      { key: "exportReviewCount", value: 99 },
    ]);
    await f.store.saveSettings(settings);
    await source.store.record(review);
    await source.backup.export();
    const clear = vi.spyOn(IDBObjectStore.prototype, "clear");
    await f.backup.import(source.download.mock.calls[0][0], "merge");
    expect(clear).not.toHaveBeenCalled();
    clear.mockRestore();
    expect(await f.store.metadata("lastExportAt")).toEqual({
      key: "lastExportAt",
      value: 10,
    });
    expect(await f.store.metadata("exportReviewCount")).toEqual({
      key: "exportReviewCount",
      value: 99,
    });
    expect(await f.store.settings()).toEqual(settings);
  } finally {
    f.store.close();
    source.store.close();
  }
});
it("snoozes for three days without shifting the original export deadline", async () => {
  const f = await fixture();
  let now = review.at;
  const backup = new Backup(f.store, {
    download: f.download,
    clock: () => now,
    appVersion: "1",
    contentVersions: {},
  });
  try {
    await f.store.record(review);
    await backup.export();
    now += 6 * 86400000;
    await backup.dismiss();
    now += 3 * 86400000 - 1;
    expect(await backup.nudge()).toBe(false);
    now++;
    expect(await backup.nudge()).toBe(true);
    expect(await f.store.metadata("lastExportAt")).toEqual({
      key: "lastExportAt",
      value: review.at,
    });
  } finally {
    f.store.close();
  }
});

it("imports the validated preview without parsing the file again", async () => {
  const f = await fixture();
  try {
    await f.store.record(review);
    await f.backup.export();
    const preview = f.backup.preview(f.download.mock.calls[0][0]);
    const parse = vi.spyOn(JSON, "parse");
    try {
      await f.backup.import(preview, "replace");
      expect(parse).not.toHaveBeenCalled();
    } finally {
      parse.mockRestore();
    }
  } finally {
    f.store.close();
  }
});
it("re-requests persistence on export when storage is best-effort", async () => {
  const persist = vi
    .fn()
    .mockResolvedValueOnce(false)
    .mockResolvedValueOnce(true);
  vi.stubGlobal("navigator", { storage: { persist } });
  const f = await fixture();
  try {
    await f.store.record(review);
    await vi.waitFor(async () =>
      expect(await f.store.metadata("storage")).toEqual({
        key: "storage",
        value: "best-effort",
      }),
    );
    await f.backup.export();
    expect(persist).toHaveBeenCalledTimes(2);
    expect(await f.store.metadata("storage")).toEqual({
      key: "storage",
      value: "persistent",
    });
  } finally {
    f.store.close();
    vi.unstubAllGlobals();
  }
});

it("keeps the last successful Undo copy if a later import fails", async () => {
  const f = await fixture();
  try {
    await f.store.record(review);
    await f.store.saveSettings(settings);
    await f.backup.export();
    const json = f.download.mock.calls[0][0];
    const before = await f.store.snapshot();
    await f.backup.import(json, "replace");
    const db = await openDB(f.name);
    const copy = await db.getAll("preImport");
    expect(copy).toHaveLength(1);
    expect(copy[0]).toMatchObject({
      at: clock(),
      mode: "replace",
      data: before,
    });
    const original = IDBObjectStore.prototype.put;
    const put = vi
      .spyOn(IDBObjectStore.prototype, "put")
      .mockImplementation(function (this: IDBObjectStore, value, key) {
        if (this.name === "reviewLog")
          throw new DOMException("Full", "QuotaExceededError");
        return original.call(this, value, key);
      });
    try {
      await expect(f.backup.import(json, "replace")).rejects.toThrow(
        "Nothing was changed.",
      );
    } finally {
      put.mockRestore();
    }
    expect(await db.getAll("preImport")).toEqual(copy);
    db.close();
    await f.backup.undo();
    expect(await f.store.snapshot()).toEqual({ ...before, metadata: [...before!.metadata,
      { key: "sync:dataEpoch", value: 2 }, { key: "sync:paused", value: 0 },
    ] });
  } finally {
    f.store.close();
  }
});
it("Undo keeps reviews recorded after the import and drops only the imported ones", async () => {
  const f = await fixture();
  try {
    await f.store.record(review);
    await f.backup.export();
    const json = f.download.mock.calls[0][0];
    // Another device's history: one review that this browser has never seen.
    const foreign = JSON.parse(json);
    foreign.data.reviewLog = [
      {
        ...review,
        attemptId: "01J0000000000000000000MPRT",
        sessionId: "other",
      },
    ];
    await f.backup.import(JSON.stringify(foreign), "merge");
    const later = {
      ...review,
      attemptId: "01J0000000000000000000NEXT",
      sessionId: "after-import",
      at: review.at + 1000,
    };
    await f.store.record(later);
    expect((await f.backup.undoInfo())?.laterReviews).toBe(1);
    await f.backup.undo();
    const ids = (await f.store.reviews()).map((r) => r.attemptId).sort();
    expect(ids).toEqual([review.attemptId, later.attemptId].sort());
    expect(await f.store.hasUndo()).toBe(false);
  } finally {
    f.store.close();
  }
});
it("drops the Undo point on a schema upgrade instead of replaying an old-format copy", async () => {
  const f = await fixture();
  let upgraded;
  try {
    await f.store.record(review);
    await f.backup.export();
    await f.backup.import(f.download.mock.calls[0][0], "merge");
    expect(await f.store.hasUndo()).toBe(true);
    f.store.close();
    upgraded = await openProgress({
      name: f.name,
      version: schemaVersion + 1,
      migrations: {
        [schemaVersion]: (snapshot) => ({
          ...snapshot,
          schemaVersion: schemaVersion + 1,
        }),
      },
    });
    expect(await upgraded.hasUndo()).toBe(false);
    expect((await upgraded.reviews()).map((r) => r.attemptId)).toEqual([
      review.attemptId,
    ]);
  } finally {
    f.store.close();
    upgraded?.close();
  }
});

it("exports rule state and merges it as learned if learned in either copy", async () => {
  const source = await fixture();
  const target = await fixture();
  try {
    await source.store.saveRuleState({
      ruleId: "castle-early",
      learned: true,
      learnedAt: 5,
      updatedAt: 5,
    });
    await source.backup.export();
    const exported = JSON.parse(source.download.mock.calls[0][0]);
    expect(exported.data.ruleState).toEqual([
      { ruleId: "castle-early", learned: true, learnedAt: 5, updatedAt: 5 },
    ]);
    await target.store.saveRuleState({
      ruleId: "castle-early",
      learned: false,
      learnedAt: null,
      updatedAt: 0,
    });
    await target.backup.import(source.download.mock.calls[0][0], "merge");
    expect(await target.store.ruleStates()).toEqual([
      { ruleId: "castle-early", learned: true, learnedAt: 5, updatedAt: 5 },
    ]);
  } finally {
    source.store.close();
    target.store.close();
  }
});

for (const mode of ["replace", "merge"] as const) {
  it(`Undo ${mode} keeps later learned and unlearned rules, excluding untouched imported timestamps`, async () => {
    const f = await fixture();
    const other = await fixture();
    try {
      await f.store.saveRuleState({
        ruleId: "castle-early",
        learned: true,
        learnedAt: 1,
        updatedAt: 1,
      });
      await other.store.saveRuleState({
        ruleId: "castle-early",
        learned: true,
        learnedAt: 2,
        updatedAt: clock() + 9000,
      });
      await other.store.saveRuleState({
        ruleId: "push-passed-pawns",
        learned: true,
        learnedAt: 2,
        updatedAt: clock() + 9000,
      });
      await other.backup.export();
      await f.backup.import(other.download.mock.calls[0][0], mode);
      await f.store.saveRuleState({
        ruleId: "castle-early",
        learned: false,
        learnedAt: null,
        updatedAt: clock() + 1,
      });
      await f.store.saveRuleState({
        ruleId: "cct-scan",
        learned: true,
        learnedAt: clock() + 1,
        updatedAt: clock() + 1,
      });
      expect((await f.backup.undoInfo())?.laterRules).toBe(2);
      await f.backup.undo();
      expect(await f.store.ruleStates()).toEqual([
        {
          ruleId: "castle-early",
          learned: false,
          learnedAt: null,
          updatedAt: clock() + 1,
        },
        {
          ruleId: "cct-scan",
          learned: true,
          learnedAt: clock() + 1,
          updatedAt: clock() + 1,
        },
      ]);
    } finally {
      f.store.close();
      other.store.close();
    }
  });
}

it("rejects rule state without a valid updatedAt without changing progress", async () => {
  const f = await fixture();
  try {
    await f.store.saveRuleState({
      ruleId: "castle-early",
      learned: true,
      learnedAt: 5,
      updatedAt: 5,
    });
    await f.backup.export();
    const file = JSON.parse(f.download.mock.calls[0][0]);
    delete file.data.ruleState[0].updatedAt;
    const before = await f.store.snapshot();
    await expect(
      f.backup.import(JSON.stringify(file), "replace"),
    ).rejects.toThrow("Nothing was changed");
    expect(await f.store.snapshot()).toEqual(before);
  } finally {
    f.store.close();
  }
});

it("roundtrips cohort settings and manual unlocks through replace, merge and Undo", async () => {
  const source = await fixture();
  const target = await fixture();
  const unlock: Review = {
    ...review,
    context: "learn",
    lineId: "next",
    lineUnlocked: true,
    schedulingEligible: false,
  };
  const complete: Review = {
    ...unlock,
    attemptId: "01ARZ3NDEKTSV4RRFFQ69G5FAW",
    lineUnlocked: undefined,
    lineCompleted: true,
    discoveryMode: "visits",
  };
  try {
    await source.store.record(unlock);
    await source.store.record(complete);
    await source.store.saveSettings({ ...settings, activeLines: 9 });
    await source.backup.export();
    const json = source.download.mock.calls[0][0];
    await target.backup.import(json, "replace");
    expect(await target.store.settings()).toMatchObject({ activeLines: 9 });
    expect(await target.store.reviews()).toEqual([unlock, complete]);
    expect(rebuild(await target.store.reviews()).size).toBe(0);
    await target.backup.undo();
    expect(await target.store.reviews()).toEqual([]);
    await target.backup.import(json, "merge");
    await target.backup.import(json, "merge");
    expect(await target.store.reviews()).toEqual([unlock, complete]);
    const later = {
      ...unlock,
      attemptId: "01ARZ3NDEKTSV4RRFFQ69G5FAX",
      lineId: "later",
    };
    await target.store.record(later);
    await target.backup.undo();
    expect(await target.store.reviews()).toEqual([unlock, complete, later]);
    await target.backup.import(json, "replace");
    await target.store.record({
      ...later,
      attemptId: "01ARZ3NDEKTSV4RRFFQ69G5FAY",
      lineId: "after-replace",
    });
    await target.backup.undo();
    expect((await target.store.reviews()).map((r) => r.lineId)).toEqual([
      "next",
      "next",
      "later",
      "after-replace",
    ]);
  } finally {
    source.store.close();
    target.store.close();
  }
});
it("rejects out-of-range cohort settings and accepts older backups without the setting", async () => {
  const source = await fixture();
  try {
    await source.store.saveSettings(settings);
    await source.backup.export();
    const data = JSON.parse(source.download.mock.calls[0][0]);
    expect(validateBackup(JSON.stringify(data), clock()).settings).toEqual([
      settings,
    ]);
    for (const activeLines of [2, 13, 6.5]) {
      data.data.settings[0].activeLines = activeLines;
      expect(() => validateBackup(JSON.stringify(data), clock())).toThrow();
    }
  } finally {
    source.store.close();
  }
});
