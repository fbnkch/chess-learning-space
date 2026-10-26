import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { openDB } from "idb";
import { Backup, validateBackup } from "./Backup";
import { migrateProgress, openProgress, schemaVersion } from "./Progress";
import type { ScanAttempt } from "../threats/scan";

const scan: ScanAttempt = {
  attemptId: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
  sessionId: "scan-session",
  at: 1790000000000,
  positionKey: "4k3/8/8/8/8/8/r7/R3K3 w Q -",
  mode: "scan",
  required: 3,
  found: 2,
  wrong: 1,
  durationMs: 1200,
};
it("migrates populated v5 forward, preserving progress and adding scanLog", async () => {
  const name = crypto.randomUUID();
  const old = await openProgress({ name, version: 5 });
  await old.saveRuleState({
    ruleId: "cct-scan",
    learned: true,
    learnedAt: 10,
    updatedAt: 10,
  });
  old.close();
  const store = await openProgress({ name });
  expect(await store.scans()).toEqual([]);
  expect(await store.ruleStates()).toHaveLength(1);
  await store.recordScan(scan);
  store.close();
  const reopened = await openProgress({ name });
  expect(await reopened.scans()).toEqual([scan]);
  reopened.close();
  const db = await openDB(name);
  expect(db.version).toBe(schemaVersion);
  expect(db.transaction("scanLog").store.keyPath).toBe("attemptId");
  db.close();
  for (let version = 0; version < schemaVersion; version++) {
    expect(
      migrateProgress({
        schemaVersion: version,
        data: { reviewLog: [], metadata: [] },
      }).data.scanLog,
    ).toEqual([]);
  }
});

it("roundtrips and unions scan IDs, and Undo retains later scans rather than imported timestamps", async () => {
  const store = await openProgress({ name: crypto.randomUUID() });
  let json = "";
  const backup = new Backup(store, {
    appVersion: "test",
    contentVersions: {},
    clock: () => scan.at + 1000,
    download: async (value) => {
      json = value;
    },
  });
  await store.recordScan(scan);
  await store.recordScan({ ...scan, found: 0 }); // Idempotent writes keep the first result.
  await backup.export();
  expect(validateBackup(json, scan.at).scanLog).toEqual([scan]);
  const incoming = JSON.parse(json);
  incoming.data.scanLog = [
    {
      ...scan,
      attemptId: "01ARZ3NDEKTSV4RRFFQ69G5FAW",
      mode: "changed",
      at: scan.at + 10000,
    },
  ];
  for (const mode of ["merge", "replace"] as const) {
    await backup.import(JSON.stringify(incoming), mode);
    expect(await store.scans()).toHaveLength(mode === "merge" ? 2 : 1);
    const later = {
      ...scan,
      attemptId: "01ARZ3NDEKTSV4RRFFQ69G5FAX",
      at: scan.at - 10000,
    };
    await store.recordScan(later);
    expect((await store.undoInfo())?.laterScans).toBe(mode === "merge" ? 1 : 0);
    await backup.undo();
    expect(await store.scans()).toEqual([scan, later]);
  }
  store.close();
});

it("rejects invalid scan counts, dates and conflicting IDs before changing data", async () => {
  const store = await openProgress({ name: crypto.randomUUID() });
  const backup = new Backup(store, {
    appVersion: "test",
    contentVersions: {},
    clock: () => scan.at,
    download: async () => {},
  });
  await store.recordScan(scan);
  const envelope = {
    format: "chess-learning-space",
    schemaVersion,
    appVersion: "test",
    contentVersions: {},
    exportedAt: new Date(scan.at).toISOString(),
    data: await store.snapshot(),
  };
  for (const bad of [
    { ...scan, found: 4 },
    { ...scan, required: 0 },
    { ...scan, at: scan.at + 86400001 },
  ]) {
    await expect(
      backup.import(
        JSON.stringify({
          ...envelope,
          data: { ...envelope.data, scanLog: [bad] },
        }),
        "replace",
      ),
    ).rejects.toThrow();
    expect(await store.scans()).toEqual([scan]);
  }
  expect(() =>
    validateBackup(
      JSON.stringify({
        ...envelope,
        data: { ...envelope.data, scanLog: [scan, { ...scan, found: 0 }] },
      }),
      scan.at,
    ),
  ).toThrow();
  store.close();
});
