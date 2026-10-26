import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { openProgress } from "../progress/Progress";
import { serializeBackup } from "../progress/Backup";
import { importPgn } from "../import/Import";
import { handleSync } from "../../api/sync";
import { memoryBlobStore } from "./fakeStore";
import { createCode, deriveKeys, encrypt } from "./crypto";
import { SyncEngine } from "./engine";
import { learnedRuleIds } from "../rules/quiz";
const now = Date.UTC(2026, 9, 26, 12);
it("two devices converge on disjoint reviews, scans and games; replay only merges; idle automatic sync does not push", async () => {
  const blob = memoryBlobStore();
  let puts = 0;
  let conflicts = 0;
  const fetcher: typeof fetch = async (url, init) => {
    const req = new Request(new URL(String(url), "https://test"), init);
    if (req.method === "PUT") {
      puts++;
      if (conflicts-- > 0) return new Response(null, { status: 412 });
    }
    return handleSync(req, blob);
  };
  const a = await openProgress({ name: crypto.randomUUID() }),
    b = await openProgress({ name: crypto.randomUUID() });
  const code = createCode();
  await a.saveSecret("sync-code", code);
  await b.saveSecret("sync-code", code);
  for (const [i, p] of [a, b].entries()) {
    const id = i ? "01ARZ3NDEKTSV4RRFFQ69G5FAW" : "01ARZ3NDEKTSV4RRFFQ69G5FAV";
    await p.record({
      attemptId: id,
      sessionId: id,
      cardId: "puzzle:abc",
      at: now,
      grade: "good",
      context: "puzzle",
      hintsUsed: 0,
      durationMs: 10,
      schedulingEligible: true,
    });
    await p.recordScan({
      attemptId: id,
      sessionId: id,
      at: now,
      positionKey: "position",
      mode: "scan",
      required: 2,
      found: 1,
      wrong: 0,
      durationMs: 10,
    });
    const game = await importPgn(
      `[White "fbnkch"]\n[Black "${i}"]\n[Result "1-0"]\n\n1. e4 e5 1-0`,
      "fbnkch",
    );
    await p.importGames(game.games);
  }
  const ea = new SyncEngine(a, { fetcher, clock: () => now }),
    eb = new SyncEngine(b, { fetcher, clock: () => now });
  await ea.sync();
  const old = await blob.read(
    `sync/${(await deriveKeys(code)).hash}/snapshot.bin`,
  );
  await eb.sync();
  await ea.sync();
  for (const p of [a, b]) {
    expect(await p.reviews()).toHaveLength(2);
    expect(await p.scans()).toHaveLength(2);
    expect(await p.games()).toHaveLength(2);
  }
  expect(await a.reviews()).toEqual(await b.reviews());
  const count = puts;
  await ea.sync({ manual: false, pull: true });
  expect(puts).toBe(count);
  // A replay cannot replace locally accumulated work.
  const path = `sync/${(await deriveKeys(code)).hash}/snapshot.bin`;
  await blob.write(path, old!.bytes, (await blob.read(path))!.etag);
  await ea.sync();
  expect(await a.reviews()).toHaveLength(2);
  conflicts = 1;
  await a.saveRuleState({
    ruleId: "test",
    learned: true,
    learnedAt: now,
    updatedAt: now,
  });
  await ea.sync();
  expect(ea.status.kind).toBe("synced");
  conflicts = 4;
  await a.saveRuleState({
    ruleId: "another",
    learned: true,
    learnedAt: now,
    updatedAt: now,
  });
  await expect(ea.sync()).rejects.toThrow(/another device/i);
  a.close();
  b.close();
});
it("rejects newer schemas and corrupt clouds without any local write; monthly guard survives reopening and allows pulls", async () => {
  const p = await openProgress({ name: crypto.randomUUID() });
  const code = createCode();
  await p.saveSecret("sync-code", code);
  const blob = memoryBlobStore();
  const keys = await deriveKeys(code);
  const path = `sync/${keys.hash}/snapshot.bin`;
  const fetcher: typeof fetch = (url, init) =>
    handleSync(new Request(new URL(String(url), "https://test"), init), blob);
  const engine = new SyncEngine(p, { fetcher, clock: () => now });
  const data = await p.snapshot();
  await blob.write(
    path,
    await encrypt(
      serializeBackup(data).replace(
        '"schemaVersion":11',
        '"schemaVersion":999',
      ),
      keys,
    ),
    null,
  );
  await expect(engine.sync()).rejects.toThrow(/newer app/);
  expect(await p.snapshot()).toEqual(data);
  await blob.write(path, new Uint8Array(40), (await blob.read(path))!.etag);
  await expect(engine.sync()).rejects.toThrow();
  expect(await p.snapshot()).toEqual(data);
  await blob.delete(path);
  await p.setMetadata([
    { key: "sync:pushMonth", value: "2026-10" },
    { key: "sync:pushCount", value: 400 },
  ]);
  await expect(engine.sync()).rejects.toThrow(/400/);
  expect(await blob.read(path)).toBeNull();
  const nextMonth = new SyncEngine(p, {
    fetcher,
    clock: () => Date.UTC(2026, 10, 1),
  });
  await nextMonth.sync();
  expect(nextMonth.status.kind).toBe("synced");
  p.close();
});
it("throttles focus pulls and dirty pushes, leaves unchanged sessions alone, and retains offline work", async () => {
  const p = await openProgress({ name: crypto.randomUUID() });
  await p.saveSecret("sync-code", createCode());
  const blob = memoryBlobStore();
  let time = now;
  let gets = 0;
  let puts = 0;
  let refreshes = 0;
  let offline = false;
  const fetcher: typeof fetch = (url, init) => {
    if (offline) throw new TypeError("network unavailable");
    if (init?.method === "GET") gets++;
    if (init?.method === "PUT") puts++;
    return handleSync(
      new Request(new URL(String(url), "https://test"), init),
      blob,
    );
  };
  const engine = new SyncEngine(p, {
    fetcher,
    clock: () => time,
    onMerged: async () => {
      refreshes++;
    },
  });
  await engine.sync();
  expect(puts).toBe(1);
  time += 4 * 60_000;
  await engine.sync({ manual: false, pull: true });
  expect(gets).toBe(1);
  time += 2 * 60_000;
  await engine.sync({ manual: false, pull: true });
  expect(gets).toBe(2);
  expect(refreshes).toBe(0); // An unchanged focus pull must not reset an active lesson.
  await p.saveRuleState({
    ruleId: "test",
    learned: true,
    learnedAt: time,
    updatedAt: time,
  });
  await engine.sync({ manual: false, pull: false });
  expect(puts).toBe(1);
  time += 15 * 60_000;
  await engine.sync({ manual: false, pull: false });
  expect(puts).toBe(1);
  time += 100 * 60_000;
  await engine.sync({ manual: false, pull: false });
  expect(puts).toBe(2);
  offline = true;
  const before = await p.snapshot();
  await expect(engine.sync()).rejects.toThrow();
  expect(engine.status.kind).toBe("offline");
  expect(await p.snapshot()).toEqual(before);
  offline = false;
  await engine.sync();
  expect(engine.status.kind).toBe("synced");
  p.close();
});
it("manual sync bypasses the interval, warns near the cap and counts conflict retries", async () => {
  const p = await openProgress({ name: crypto.randomUUID() });
  await p.saveSecret("sync-code", createCode());
  const blob = memoryBlobStore();
  let conflicts = false;
  let puts = 0;
  const fetcher: typeof fetch = (url, init) => {
    if (init?.method === "PUT") {
      puts++;
      if (conflicts) return Promise.resolve(new Response(null, { status: 412 }));
    }
    return handleSync(new Request(new URL(String(url), "https://test"), init), blob);
  };
  const engine = new SyncEngine(p, { fetcher, clock: () => now });
  await engine.sync();
  await p.saveRuleState({ ruleId: "test", learned: true, learnedAt: now, updatedAt: now });
  await p.setMetadata([{ key: "sync:pushCount", value: 359 }]);
  await engine.sync();
  expect(puts).toBe(2);
  expect(engine.status.message).toMatch(/360 of 400/);
  await engine.sync();
  expect(puts).toBe(2); // Equal remote content never costs a write, even manually.
  await p.saveRuleState({ ruleId: "another", learned: true, learnedAt: now, updatedAt: now });
  await p.setMetadata([{ key: "sync:pushCount", value: 399 }]);
  conflicts = true;
  await expect(engine.sync()).rejects.toThrow(/400/);
  expect(puts).toBe(3);
  expect((await p.metadata("sync:pushCount"))?.value).toBe(400);
  p.close();
});
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}
const quizReview = {
  attemptId: "01ARZ3NDEKTSV4RRFFQ69G5FAV", sessionId: "quiz",
  cardId: "rule:castle-early:example-v1", at: now,
  context: "rule-quiz" as const, grade: "good" as const, hintsUsed: 0,
  durationMs: 10, schedulingEligible: false,
};
it.each([false, true])("Undo removes Replace-only quiz learning after sync (resume=%s)", async (resume) => {
  const p = await openProgress({ name: crypto.randomUUID() });
  const incoming = await p.snapshot();
  incoming.reviewLog.push(quizReview);
  const code = createCode();
  await p.saveSecret("sync-code", code);
  const blob = memoryBlobStore();
  const keys = await deriveKeys(code);
  await blob.write(`sync/${keys.hash}/snapshot.bin`, await encrypt(serializeBackup(incoming), keys), null);
  let requests = 0;
  const engine = new SyncEngine(p, { clock: () => now, fetcher: (url, init) => {
    requests++;
    return handleSync(new Request(new URL(String(url), "https://test"), init), blob);
  } });
  await p.restore(incoming, "replace", now);
  await engine.sync();
  expect(engine.status.kind).toBe("paused");
  expect(requests).toBe(0);
  if (resume) {
    await engine.resumeAndMerge();
    expect(engine.status.kind).toBe("synced");
    expect(await p.ruleStates()).toContainEqual({ ruleId: "castle-early", learned: true, learnedAt: now, updatedAt: now });
  }
  expect(learnedRuleIds(await p.ruleStates(), await p.reviews())).toEqual(["castle-early"]);
  await p.undo();
  expect(await p.reviews()).toEqual([]);
  expect(learnedRuleIds(await p.ruleStates(), await p.reviews())).toEqual([]);
  const before = requests;
  await engine.sync();
  await engine.sync({ manual: false, pull: false });
  expect(requests).toBe(before);
  expect(engine.status.kind).toBe("paused");
  engine.dispose();
  p.close();
});
it.each([
  ["GET", "Undo"], ["PUT", "Undo"], ["GET", "Replace"], ["PUT", "Replace"],
])("%s stalled before %s cannot write stale data", async (method, action) => {
  const p = await openProgress({ name: crypto.randomUUID() });
  const empty = await p.snapshot();
  const incoming = structuredClone(empty);
  incoming.reviewLog.push(quizReview);
  await p.restore(incoming, "replace", now);
  const code = createCode();
  await p.saveSecret("sync-code", code);
  const blob = memoryBlobStore();
  const keys = await deriveKeys(code);
  const path = `sync/${keys.hash}/snapshot.bin`;
  if (method === "GET") await blob.write(path, await encrypt(serializeBackup(incoming), keys), null);
  const entered = deferred(), release = deferred();
  let signal: AbortSignal | null | undefined;
  const fetcher: typeof fetch = async (url, init) => {
    if (init?.method === method) {
      signal = init.signal;
      entered.resolve();
      await release.promise;
      signal?.throwIfAborted();
    }
    return handleSync(new Request(new URL(String(url), "https://test"), init), blob);
  };
  const engine = new SyncEngine(p, { fetcher, clock: () => now });
  const run = engine.sync();
  await entered.promise;
  if (action === "Undo") await p.undo();
  else await p.restore(empty, "replace", now);
  release.resolve();
  await run;
  expect(signal?.aborted).toBe(true);
  expect(await p.reviews()).toEqual([]);
  expect(engine.status.kind).toBe("paused");
  if (method === "PUT") expect(await blob.read(path)).toBeNull();
  p.close();
});
it("Replace pauses sync across reload; explicit merge resumes and can restore cloud data", async () => {
  const name = crypto.randomUUID();
  let p = await openProgress({ name });
  const empty = await p.snapshot();
  await p.record(quizReview);
  await p.saveSecret("sync-code", createCode());
  const blob = memoryBlobStore();
  let requests = 0;
  const fetcher: typeof fetch = (url, init) => {
    requests++;
    return handleSync(new Request(new URL(String(url), "https://test"), init), blob);
  };
  await new SyncEngine(p, { fetcher, clock: () => now }).sync();
  await p.restore(empty, "replace", now);
  p.close();
  p = await openProgress({ name });
  const engine = new SyncEngine(p, { fetcher, clock: () => now });
  const before = requests;
  await engine.sync();
  expect(requests).toBe(before);
  expect(engine.status.kind).toBe("paused");
  expect(await p.reviews()).toEqual([]);
  await engine.resumeAndMerge();
  expect(await p.reviews()).toHaveLength(1);
  expect(engine.status.kind).toBe("synced");
  p.close();
});
it("the device choice deletes the cloud then uploads only the fresh device snapshot", async () => {
  const p = await openProgress({ name: crypto.randomUUID() });
  const empty = await p.snapshot();
  await p.record(quizReview);
  const code = createCode();
  await p.saveSecret("sync-code", code);
  const blob = memoryBlobStore();
  const methods: string[] = [];
  const fetcher: typeof fetch = (url, init) => {
    methods.push(String(init?.method));
    return handleSync(new Request(new URL(String(url), "https://test"), init), blob);
  };
  const engine = new SyncEngine(p, { fetcher, clock: () => now });
  await engine.sync();
  await p.restore(empty, "replace", now);
  methods.length = 0;
  await engine.replaceCloudWithDevice();
  expect(methods).toEqual(["DELETE", "PUT"]);
  expect(await p.reviews()).toEqual([]);
  expect(engine.status.kind).toBe("synced");
  const other = await openProgress({ name: crypto.randomUUID() });
  await other.saveSecret("sync-code", code);
  await new SyncEngine(other, { fetcher, clock: () => now }).sync();
  expect(await other.reviews()).toEqual([]);
  other.close();
  p.close();
});
it("a stale pull is rejected even if its transport ignores cancellation", async () => {
  const name = crypto.randomUUID();
  const p = await openProgress({ name }), other = await openProgress({ name });
  await p.restore(await p.snapshot(), "merge", now);
  const incoming = await p.snapshot(); incoming.reviewLog.push(quizReview);
  const code = createCode(); await p.saveSecret("sync-code", code);
  const blob = memoryBlobStore(), keys = await deriveKeys(code);
  await blob.write(`sync/${keys.hash}/snapshot.bin`, await encrypt(serializeBackup(incoming), keys), null);
  const entered = deferred(), release = deferred();
  const engine = new SyncEngine(p, { clock: () => now, fetcher: async (url, init) => {
    // Return the already-started response even after AbortSignal fires.
    const response = await handleSync(new Request(new URL(String(url), "https://test"), { ...init, signal: undefined }), blob);
    entered.resolve(); await release.promise; return response;
  } });
  const run = engine.sync(); await entered.promise;
  await other.undo(); release.resolve(); await run;
  expect(await p.reviews()).toEqual([]);
  expect(engine.status.kind).toBe("paused");
  p.close(); other.close();
});
it("failed cloud replacement stays paused across reload without falling back to a merge", async () => {
  const name = crypto.randomUUID();
  const p = await openProgress({ name });
  await p.saveSecret("sync-code", createCode());
  await p.restore(await p.snapshot(), "replace", now);
  const methods: string[] = [];
  const fetcher: typeof fetch = async (_url, init) => {
    methods.push(String(init?.method));
    return new Response(null, { status: init?.method === "DELETE" ? 204 : 412 });
  };
  const engine = new SyncEngine(p, { fetcher, clock: () => now });
  await expect(engine.replaceCloudWithDevice()).rejects.toThrow(/Another device/);
  expect(methods).toEqual(["DELETE", "PUT"]);
  expect(engine.status.kind).toBe("paused");
  p.close();
  const reopened = await openProgress({ name });
  await new SyncEngine(reopened, { fetcher, clock: () => now }).sync();
  expect(methods).toEqual(["DELETE", "PUT"]);
  reopened.close();
});
it("game import also invalidates a pending sync snapshot without pausing normal learning", async () => {
  const p = await openProgress({ name: crypto.randomUUID() });
  const before = await p.syncDataState();
  const imported = await importPgn('[White "fbnkch"]\n[Black "other"]\n[Result "1-0"]\n\n1. e4 e5 1-0', "fbnkch");
  await p.importGames(imported.games);
  expect(await p.syncDataState()).toEqual({ epoch: before.epoch + 1, paused: false });
  p.close();
});
