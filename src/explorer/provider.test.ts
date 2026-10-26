import { expect, it, vi } from "vitest";
import { Game } from "../game/Game";
import { requestWeights } from "./provider";
const game = new Game();
game.play("e2e4");
const fen = game.fen;
const body = {
  white: 50,
  draws: 10,
  black: 40,
  moves: [{ uci: "e7e5", white: 20, draws: 5, black: 15 }],
};
it("sends fixed query and Bearer auth and converts counts to percentages", async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(body));
  expect(
    await requestWeights(fen, "fake-test-token", new AbortController().signal, {
      fetch: fetcher,
    }),
  ).toEqual({ e7e5: 40 });
  const [url, init] = fetcher.mock.calls[0];
  expect(String(url)).toContain("ratings=1000%2C1200%2C1400");
  expect(String(url)).toContain("speeds=blitz%2Crapid");
  expect(init).toMatchObject({
    credentials: "omit",
    redirect: "error",
    headers: { Authorization: "Bearer fake-test-token" },
  });
});
it("backs off sequentially on 429, respecting Retry-After", async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      new Response("", { status: 429, headers: { "Retry-After": "90" } }),
    )
    .mockResolvedValueOnce(Response.json(body));
  const delay = vi.fn().mockResolvedValue(undefined);
  await requestWeights(fen, "fake", new AbortController().signal, {
    fetch: fetcher,
    delay,
  });
  expect(delay.mock.calls[0][0]).toBe(90000);
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it.each([401, 429, "offline", "json", "shape", "illegal"])(
  "reports %s without leaking response or token",
  async (failure) => {
    const fetcher = vi.fn<typeof fetch>();
    if (typeof failure === "number")
      fetcher.mockResolvedValue(
        new Response("fake-sensitive-token", { status: failure }),
      );
    else if (failure === "offline")
      fetcher.mockRejectedValue(new Error("fake-sensitive-token"));
    else if (failure === "json")
      fetcher.mockResolvedValue(new Response("fake-sensitive-token"));
    else
      fetcher.mockResolvedValue(
        Response.json(
          failure === "shape"
            ? {}
            : { ...body, moves: [{ ...body.moves[0], uci: "a1a8" }] },
        ),
      );
    try {
      await requestWeights(
        fen,
        "fake-sensitive-token",
        new AbortController().signal,
        { fetch: fetcher, delay: async () => {} },
      );
      expect.fail("Expected failure");
    } catch (error) {
      expect(String(error)).not.toContain("fake-sensitive-token");
      expect(String(error)).toContain("Previous weights kept");
    }
  },
);
it("aborts during backoff without another request", async () => {
  const control = new AbortController();
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response("", { status: 429 }));
  await expect(
    requestWeights(fen, "fake", control.signal, {
      fetch: fetcher,
      delay: async () => {
        control.abort();
      },
    }),
  ).rejects.toThrow();
  expect(fetcher).toHaveBeenCalledTimes(1);
});
