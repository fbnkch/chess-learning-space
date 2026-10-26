import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { openDB } from "idb";
import { Game, positionKey } from "../game/Game";
import { openProgress, migrateProgress } from "../progress/Progress";
import { Backup, validateBackup } from "../progress/Backup";
import { explorerQuery, weightId } from "./weights";
const game = new Game();
game.play("e2e4");
const key = positionKey(game.fen);
const row = {
  id: weightId(key, explorerQuery),
  positionKey: key,
  query: explorerQuery,
  fetchedAt: 100,
  weights: { e7e5: 25 },
};
it("upgrades v10, roundtrips public weights and merges newer dates; Undo retains later refreshes", async () => {
  const name = crypto.randomUUID();
  const old = await openProgress({ name, version: 10 });
  await old.saveSecret("lichess-explorer-token", "fake-local-token");
  old.close();
  const store = await openProgress({ name });
  expect(
    migrateProgress({
      schemaVersion: 10,
      data: { reviewLog: [], metadata: [] },
    }).data.replyWeights,
  ).toEqual([]);
  expect(await store.replyWeights()).toEqual([]);
  await store.saveReplyWeights([row]);
  let json = "";
  const backup = new Backup(store, {
    appVersion: "test",
    contentVersions: {},
    clock: () => 1000,
    download: async (s) => {
      json = s;
    },
  });
  await backup.export();
  expect(json).not.toContain("fake-local-token");
  expect(json).not.toContain("lichess-explorer-token");
  expect(validateBackup(json, 1000).replyWeights).toEqual([row]);
  const incoming = validateBackup(json, 1000);
  incoming.replyWeights = [{ ...row, fetchedAt: 200, weights: { e7e5: 80 } }];
  await store.restore(incoming, "merge", 1000);
  expect((await store.replyWeights())[0].weights.e7e5).toBe(80);
  await store.saveReplyWeights([
    { ...row, fetchedAt: 300, weights: { e7e5: 10 } },
  ]);
  await store.undo();
  expect((await store.replyWeights())[0].weights.e7e5).toBe(10);
  await store.restore(incoming, "replace", 1000);
  const db = await openDB(name);
  const undoCopy = await db.get("preImport", "last");
  expect(undoCopy).toBeDefined();
  expect(JSON.stringify(undoCopy)).not.toContain("fake-local-token");
  db.close();
  await store.undo();
  expect((await store.replyWeights())[0].fetchedAt).toBe(300);
  expect(await store.secret("lichess-explorer-token")).toBe("fake-local-token");
  store.close();
});
it("rejects invalid imported moves, keys, future dates and injected secrets without writes", async () => {
  const store = await openProgress({ name: crypto.randomUUID() });
  await store.saveReplyWeights([row]);
  const data = await store.snapshot();
  const envelope = {
    format: "chess-learning-space",
    schemaVersion: 11,
    appVersion: "test",
    contentVersions: {},
    exportedAt: new Date(1000).toISOString(),
    data,
  };
  for (const invalid of [
    { ...row, weights: { a1a8: 20 } },
    { ...row, weights: { e7e5: 90, c7c5: 90 } },
    { ...row, id: "bad" },
    { ...row, fetchedAt: 86401001 },
  ]) {
    expect(() =>
      validateBackup(
        JSON.stringify({
          ...envelope,
          data: { ...data, replyWeights: [invalid] },
        }),
        1000,
      ),
    ).toThrow();
  }
  expect(() =>
    validateBackup(
      JSON.stringify({
        ...envelope,
        data: {
          ...data,
          secrets: { "lichess-explorer-token": "fake-imported-token" },
        },
      }),
      1000,
    ),
  ).toThrow();
  expect(await store.replyWeights()).toEqual([row]);
  store.close();
});
