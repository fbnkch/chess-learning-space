import { expect, it, vi } from "vitest";
import { importChessCom, importPgn } from "./Import";

const pgn =
  '[White "FBNKCH"]\n[Black "Other"]\n[Result "1-0"]\n[Date "2026.10.01"]\n[TimeControl "1/259200"]\n\n1. e4 e5 2. Nf3 Nc6 1-0';
it("imports independent pasted games, reports the broken game, and hashes normalized notation", async () => {
  const result = await importPgn(
    `${pgn}\n\n[Event "Broken"]\n1. e4 e9\n\n${pgn}`,
    "fbnkch",
  );
  expect(result.games).toHaveLength(1);
  expect(result.errors).toEqual([expect.objectContaining({ game: 2 })]);
  expect(result.duplicates).toBe(1);
  expect(result.games[0]).toMatchObject({
    colour: "white",
    timeControl: "1/259200",
    result: "1-0",
    date: "2026.10.01",
  });
  const reformatted = await importPgn(
    pgn.replace("e4 e5", "e4 {comment} e5"),
    "fbnkch",
  );
  expect(reformatted.games[0].id).toBe(result.games[0].id);
});
it("retries sequential monthly requests, skips variants/ongoing games and duplicate URLs", async () => {
  const base = "https://api.chess.com/pub/player/fbnkch/games/";
  const daily = {
    url: "https://www.chess.com/game/daily/1",
    rules: "chess",
    pgn,
    end_time: 100,
  };
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      Response.json({
        archives: [base + "2026/08", base + "2026/09", base + "2026/10"],
      }),
    )
    .mockResolvedValueOnce(new Response(null, { status: 429 }))
    .mockResolvedValueOnce(
      Response.json({
        games: [
          daily,
          daily,
          { ...daily, rules: "chess960" },
          { ...daily, pgn: pgn.replaceAll("1-0", "*") },
        ],
      }),
    )
    .mockResolvedValueOnce(new Response(null, { status: 404 }))
    .mockResolvedValueOnce(Response.json({ games: [] }));
  const sleep = vi.fn<(ms: number) => Promise<void>>().mockResolvedValue();
  const result = await importChessCom(
    "fbnkch",
    { last: 3 },
    { fetch: fetcher, sleep },
  );
  expect(result.games).toHaveLength(1);
  expect(result.skipped).toBe(2);
  expect(result.duplicates).toBe(1);
  expect(sleep).toHaveBeenCalledWith(500);
  expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
    base + "archives",
    base + "2026/10",
    base + "2026/10",
    base + "2026/09",
    base + "2026/08",
  ]);
});

import archives from "../../e2e/fixtures/import/archives.json" with { type: "json" };
import month from "../../e2e/fixtures/import/month.json" with { type: "json" };
import emptyMonth from "../../e2e/fixtures/import/empty-month.json" with { type: "json" };
import missing from "../../e2e/fixtures/import/404.json" with { type: "json" };
import limited from "../../e2e/fixtures/import/429.json" with { type: "json" };
import { readFileSync } from "node:fs";

it("reads recorded response fixtures including daily, variant, ongoing, duplicate, 429 and 404", async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json(archives))
    .mockResolvedValueOnce(Response.json(limited, { status: 429 }))
    .mockResolvedValueOnce(Response.json(month))
    .mockResolvedValueOnce(Response.json(missing, { status: 404 }))
    .mockResolvedValueOnce(Response.json(emptyMonth));
  const result = await importChessCom(
    "FBNKCH",
    { last: 10 },
    { fetch: fetcher, sleep: async () => {} },
  );
  expect(result.games.map((g) => [g.colour, g.timeControl, g.result])).toEqual([
    ["white", "600", "1-0"],
    ["black", "1/259200", "0-1"],
  ]);
  expect(result).toMatchObject({ duplicates: 1, skipped: 2, errors: [] });
  const paste = await importPgn(
    readFileSync(
      new URL("../../e2e/fixtures/import/paste.pgn", import.meta.url),
      "utf8",
    ),
    "fbnkch",
  );
  expect(paste.games).toHaveLength(2);
  expect(paste.errors).toHaveLength(1);
});
it("bounds exponential retries for network failures and rate limits", async () => {
  for (const fetcher of [
    vi.fn<typeof fetch>().mockRejectedValue(new TypeError("offline")),
    vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(limited, { status: 429 })),
  ]) {
    const sleep = vi.fn<(ms: number) => Promise<void>>().mockResolvedValue();
    await expect(
      importChessCom("fbnkch", { last: 10 }, { fetch: fetcher, sleep }),
    ).rejects.toThrow(/Chess.com/);
    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(sleep.mock.calls).toEqual([[500], [1000], [2000]]);
  }
});
it("chooses only the requested month, with no network for unavailable months", async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json(archives))
    .mockResolvedValueOnce(Response.json(month));
  expect(
    (await importChessCom("fbnkch", { month: "2026-10" }, { fetch: fetcher }))
      .games,
  ).toHaveLength(2);
  expect(fetcher).toHaveBeenCalledTimes(2);
  const unavailable = vi
    .fn<typeof fetch>()
    .mockResolvedValue(Response.json(archives));
  expect(
    (
      await importChessCom(
        "fbnkch",
        { month: "2025-01" },
        { fetch: unavailable },
      )
    ).games,
  ).toEqual([]);
  expect(unavailable).toHaveBeenCalledTimes(1);
});

it("recovers after a broken variation and preserves valid PGN variations and setup positions", async () => {
  const broken = '[Event "Broken variation"]\n1. e4 (1. d4';
  const result = await importPgn(broken + "\n\n" + pgn, "fbnkch");
  expect(result.errors).toHaveLength(1);
  expect(result.games).toHaveLength(1);
  const variation = await importPgn(
    pgn.replace("e4 e5", "e4 (1. d4 d5) e5"),
    "fbnkch",
  );
  expect(variation.games[0].id).toBe(
    (await importPgn(pgn, "fbnkch")).games[0].id,
  );
  const setup = await importPgn(
    '[FEN "8/8/8/8/8/4k3/8/R3K3 w Q - 0 1"]\n[Result "1/2-1/2"]\n\n1. Ra2 1/2-1/2',
    "fbnkch",
  );
  expect(setup.errors).toEqual([]);
  expect(setup.games[0].colour).toBeNull();
});

it("matches a completed repertoire line when opening headers are absent and retains unknown learner colour", async () => {
  const { Game } = await import("../game/Game");
  const result = await importPgn('[Result "1-0"]\n1. e4 e5 1-0', "fbnkch", {
    white: [
      {
        id: "example",
        name: "Open Game",
        group: "Italian",
        summary: "test",
        startFen: new Game().fen,
        moves: ["e2e4", "e7e5"],
        weight: 1,
      },
    ],
  });
  expect(result.games[0]).toMatchObject({ opening: "Open Game", colour: null });
});

it("keeps completed months when a later archive fails and reports the failed month", async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json(archives))
    .mockResolvedValueOnce(Response.json(month))
    .mockRejectedValue(new TypeError("offline"));
  const result = await importChessCom(
    "fbnkch",
    { last: 10 },
    {
      fetch: fetcher,
      sleep: async () => {},
    },
  );
  expect(result.games).toHaveLength(2);
  expect(result.errors).toEqual([
    expect.objectContaining({
      message: expect.stringMatching(/2026\/09.*could not be reached/),
    }),
  ]);
  expect(fetcher).toHaveBeenCalledTimes(6);
});

it("aborts a rate-limit backoff without retrying or returning completed games", async () => {
  const controller = new AbortController();
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json(archives))
    .mockResolvedValueOnce(Response.json(month))
    .mockResolvedValue(new Response(null, { status: 429 }));
  const sleep = vi.fn(async () => {
    controller.abort();
  });
  await expect(
    importChessCom(
      "fbnkch",
      { last: 10 },
      {
        fetch: fetcher,
        sleep,
        signal: controller.signal,
      },
    ),
  ).rejects.toMatchObject({ name: "AbortError" });
  expect(fetcher).toHaveBeenCalledTimes(3);
  expect(
    fetcher.mock.calls.every(([, init]) => init?.signal === controller.signal),
  ).toBe(true);
});

it("does not retry an aborted in-flight fetch", async () => {
  const controller = new AbortController();
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => {
    controller.abort();
    throw new DOMException("Aborted", "AbortError");
  });
  await expect(
    importChessCom(
      "fbnkch",
      { last: 10 },
      {
        fetch: fetcher,
        signal: controller.signal,
      },
    ),
  ).rejects.toMatchObject({ name: "AbortError" });
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it.each([
  "https://www.chess.com.evil/game/live/123",
  "https://evil.test/game/live/123",
  "http://www.chess.com/game/live/123",
  "https://www.chess.com/game/live/123?redirect=evil",
  "https://www.chess.com/game/live/not-digits",
])("does not use an untrusted PGN game link as identity: %s", async (url) => {
  const result = await importPgn(`[Link "${url}"]\n${pgn}`, "fbnkch");
  expect(result.games[0].id).toMatch(/^pgn:[a-f0-9]{64}$/);
  expect(result.games[0].url).toBeNull();
});
