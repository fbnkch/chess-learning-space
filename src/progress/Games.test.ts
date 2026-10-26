import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { openDB } from "idb";
import { openProgress, migrateProgress, schemaVersion } from "./Progress";
import { Backup } from "./Backup";
import { importPgn } from "../import/Import";

it("migrates v7 to v8 games, roundtrips, merges, and Undo keeps games added after backup import", async () => {
  const name = crypto.randomUUID();
  const old = await openDB(name, 7, {
    upgrade(db) {
      db.createObjectStore("reviewLog", { keyPath: "attemptId" }).createIndex(
        "sessionCard",
        ["sessionId", "cardId"],
      );
      for (const [store, key] of [
        ["metadata", "key"],
        ["ruleState", "ruleId"],
        ["scanLog", "attemptId"],
      ])
        db.createObjectStore(store, { keyPath: key });
      db.createObjectStore("puzzleRating");
      db.createObjectStore("woodpeckerSets", { keyPath: "id" });
      for (const store of ["settings", "secrets", "preImport"])
        db.createObjectStore(store);
    },
  });
  await old.put(
    "settings",
    {
      sound: false,
      coordinates: true,
      reducedMotion: false,
      animationMs: 0,
      chessComUsername: "another",
    },
    "current",
  );
  const rating = { rating: 1200, rd: 100, volatility: 0.06, ratedAttempts: 12 };
  const set = {
    id: "fixture-set",
    puzzleIds: ["abc"],
    motif: "fork" as const,
    createdAt: 42,
  };
  await old.put("puzzleRating", rating, "current");
  await old.put("woodpeckerSets", set);
  await old.put("preImport", { old: true }, "last");
  old.close();
  const store = await openProgress({ name });
  const other = await openProgress({ name: crypto.randomUUID() });
  try {
    expect(schemaVersion).toBe(11);
    expect(
      migrateProgress({
        schemaVersion: 7,
        data: { reviewLog: [], metadata: [] },
      }).data.games,
    ).toEqual([]);
    expect(await store.games()).toEqual([]);
    expect(await store.puzzleRating()).toEqual(rating);
    expect(await store.woodpeckerSets()).toEqual([set]);
    expect(await store.hasUndo()).toBe(false);
    expect(await store.settings()).toMatchObject({
      chessComUsername: "another",
    });
    const make = async (event: string) =>
      (
        await importPgn(
          `[Event "${event}"]\n[White "${event}"]\n[Result "1-0"]\n\n1. e4 e5 1-0`,
          "fbnkch",
        )
      ).games[0];
    const before = await make("before"),
      incoming = await make("incoming"),
      later = await make("later");
    await store.importGames([before, before]);
    let json = "";
    const backup = new Backup(other, {
      download: async (value) => {
        json = value;
      },
      appVersion: "test",
      contentVersions: {},
    });
    await other.importGames([incoming]);
    await backup.export();
    const target = new Backup(store, {
      download: async () => {},
      appVersion: "test",
      contentVersions: {},
    });
    await target.import(json, "merge");
    expect((await store.games()).map((g) => g.id).sort()).toEqual(
      [before.id, incoming.id].sort(),
    );
    await target.undo();
    expect(await store.games()).toEqual([before]);
    await target.import(json, "replace");
    expect(await store.games()).toEqual([incoming]);
    await store.importGames([later]);
    expect(await store.undoInfo()).toMatchObject({ laterGames: 1 });
    await target.undo();
    expect((await store.games()).map((g) => g.id).sort()).toEqual(
      [before.id, later.id].sort(),
    );
  } finally {
    store.close();
    other.close();
  }
});

it("rejects invalid game backups atomically and includes the username in settings roundtrips", async () => {
  const store = await openProgress({ name: crypto.randomUUID() });
  let json = "";
  const backup = new Backup(store, {
    download: async (value) => {
      json = value;
    },
    appVersion: "test",
    contentVersions: {},
  });
  try {
    const game = (await importPgn('[Result "1-0"]\n1. e4 e5 1-0', "fbnkch"))
      .games[0];
    await store.importGames([game]);
    await store.saveSettings({
      sound: false,
      coordinates: true,
      reducedMotion: false,
      animationMs: 0,
      chessComUsername: "custom-player",
    });
    await backup.export();
    const before = await store.snapshot();
    const file = JSON.parse(json);
    expect(file.data.settings[0].chessComUsername).toBe("custom-player");
    file.data.games[0].pgn = "1. e9";
    await expect(
      backup.import(JSON.stringify(file), "replace"),
    ).rejects.toThrow(/Nothing was changed/);
    expect(await store.snapshot()).toEqual(before);
    expect(await store.hasUndo()).toBe(false);
    await backup.import(json, "replace");
    expect(await store.settings()).toMatchObject({
      chessComUsername: "custom-player",
    });
    expect(await store.games()).toEqual([game]);
  } finally {
    store.close();
  }
});

it("deduplicates the same game from API and paste, including without a game URL header", async () => {
  const { importChessCom } = await import("../import/Import");
  const { vi } = await import("vitest");
  const store = await openProgress({ name: crypto.randomUUID() });
  try {
    const pgn =
      '[White "Alice"]\n[Black "Bob"]\n[Date "2026.10.01"]\n[Result "1-0"]\n1. e4 e5 1-0';
    const url = "https://www.chess.com/game/live/123";
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          archives: ["https://api.chess.com/pub/player/alice/games/2026/10"],
        }),
      )
      .mockResolvedValueOnce(
        Response.json({ games: [{ rules: "chess", pgn, url, end_time: 42 }] }),
      );
    const api = await importChessCom("alice", { last: 1 }, { fetch: fetcher });
    expect(await store.importGames(api.games)).toBe(1);
    for (const header of ["", `[Site "${url}/"]\n`, `[Link "${url}"]\n`]) {
      const paste = await importPgn(
        header + pgn.replace("e4 e5", "e4 {comment} e5"),
        "alice",
      );
      if (header) expect(paste.games[0].id).toBe(url);
      expect(await store.importGames(paste.games)).toBe(0);
    }
    expect(await store.games()).toHaveLength(1);
  } finally {
    store.close();
  }
});

it.each([
  [
    "changed legal moves under an unchanged PGN hash",
    (g: Record<string, unknown>) => ({
      ...g,
      pgn: '[Result "1-0"]\n1. d4 d5 1-0',
    }),
  ],
  [
    "changed fingerprint",
    (g: Record<string, unknown>) => ({ ...g, fingerprint: "0".repeat(64) }),
  ],
  [
    "unfinished PGN with a completed stored result",
    (g: Record<string, unknown>) => ({ ...g, pgn: '[Result "*"]\n1. e4 e5 *' }),
  ],
])("rejects %s without changing data or Undo", async (_, change) => {
  const store = await openProgress({ name: crypto.randomUUID() });
  let json = "";
  const backup = new Backup(store, {
    download: async (s) => {
      json = s;
    },
    appVersion: "test",
    contentVersions: {},
  });
  try {
    await store.importGames(
      (await importPgn('[Result "1-0"]\n1. e4 e5 1-0', "fbnkch")).games,
    );
    await backup.export();
    const file = JSON.parse(json);
    file.data.games[0] = change(file.data.games[0]);
    const before = await store.snapshot();
    await expect(
      backup.import(JSON.stringify(file), "replace"),
    ).rejects.toThrow(/Nothing was changed/);
    expect(await store.snapshot()).toEqual(before);
    expect(await store.hasUndo()).toBe(false);
  } finally {
    store.close();
  }
});

it("rejects conflicting game IDs inside a backup and on Merge, but deduplicates identical records", async () => {
  const store = await openProgress({ name: crypto.randomUUID() });
  let json = "";
  const backup = new Backup(store, {
    download: async (s) => {
      json = s;
    },
    appVersion: "test",
    contentVersions: {},
  });
  try {
    const game = (
      await importPgn(
        '[Site "https://www.chess.com/game/live/123"]\n[Result "1-0"]\n1. e4 e5 1-0',
        "fbnkch",
      )
    ).games[0];
    await store.importGames([game]);
    await backup.export();
    const file = JSON.parse(json);
    const conflict = { ...game, opening: "Conflicting description" };
    const before = await store.snapshot();
    file.data.games = [game, conflict];
    for (const mode of ["replace", "merge"] as const) {
      await expect(backup.import(JSON.stringify(file), mode)).rejects.toThrow(
        /Nothing was changed/,
      );
      expect(await store.snapshot()).toEqual(before);
      expect(await store.hasUndo()).toBe(false);
    }
    file.data.games = [conflict];
    await expect(backup.import(JSON.stringify(file), "merge")).rejects.toThrow(
      /Nothing was changed/,
    );
    expect(await store.snapshot()).toEqual(before);
    expect(await store.hasUndo()).toBe(false);
    file.data.games = [game, game];
    await backup.import(JSON.stringify(file), "merge");
    expect(await store.games()).toEqual([game]);
    expect(await store.hasUndo()).toBe(true);
  } finally {
    store.close();
  }
});

it("rejects a URL identity not supported by the stored PGN", async () => {
  const { importedGameSchema } = await import("../import/schema");
  const game = (await importPgn('[Result "1-0"]\n1. e4 e5 1-0', "fbnkch"))
    .games[0];
  expect(
    importedGameSchema.safeParse({
      ...game,
      id: "https://www.chess.com/game/live/123",
      url: "https://www.chess.com/game/live/123",
    }).success,
  ).toBe(false);
});

it("rejects an unfinished Result header even when movetext says 1-0 and URL/fingerprint still match", async () => {
  const { importedGameSchema } = await import("../import/schema");
  const game = (
    await importPgn(
      '[Site "https://www.chess.com/game/live/123"]\n[Result "1-0"]\n1. e4 e5 1-0',
      "fbnkch",
    )
  ).games[0];
  expect(
    importedGameSchema.safeParse({
      ...game,
      pgn: game.pgn.replace('[Result "1-0"]', '[Result "*"]'),
    }).success,
  ).toBe(false);
});

it("keeps identical rematches with different game URLs in import, storage and backup merge", async () => {
  const { importChessCom } = await import("../import/Import");
  const { mergeGames } = await import("../import/schema");
  const { vi } = await import("vitest");
  const store = await openProgress({ name: crypto.randomUUID() });
  try {
    const pgn = (time: string) =>
      `[White "Alice"]\n[Black "Bob"]\n[Date "2026.10.01"]\n[UTCTime "${time}"]\n[Result "1-0"]\n1. e4 e5 1-0`;
    const games = [
      { url: "https://www.chess.com/game/live/1", pgn: pgn("10:00:00") },
      { url: "https://www.chess.com/game/live/2", pgn: pgn("10:00:00") },
    ];
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          archives: ["https://api.chess.com/pub/player/alice/games/2026/10"],
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          games: games.map((g, i) => ({
            rules: "chess",
            end_time: 42 + i,
            ...g,
          })),
        }),
      );
    const api = await importChessCom("alice", { last: 5 }, { fetch: fetcher });
    expect(api.games).toHaveLength(2);
    expect(api.games[0].fingerprint).toBe(api.games[1].fingerprint);
    expect(await store.importGames(api.games)).toBe(2);
    expect(mergeGames([api.games[0]], [api.games[1]])).toHaveLength(2);
    // A pasted copy without a URL still matches one of them.
    const paste = await importPgn(pgn("10:00:00"), "alice");
    expect(await store.importGames(paste.games)).toBe(0);
    // Two URL-less pastes of different rematches differ by start time.
    const later = await importPgn(
      pgn("10:00:00") + "\n\n" + pgn("10:20:00"),
      "alice",
    );
    expect(later.games).toHaveLength(2);
    expect(await store.games()).toHaveLength(2);
  } finally {
    store.close();
  }
});
