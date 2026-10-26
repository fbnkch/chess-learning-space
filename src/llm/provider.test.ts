import { describe, expect, it, vi } from "vitest";
import { requestWording, defaults } from "./provider";
const prompt = "facts only";
describe("browser wording providers", () => {
  for (const provider of ["ollama", "anthropic", "openai"] as const) {
    it(`uses ${provider} browser protocol`, async () => {
      const response =
        provider === "ollama"
          ? { message: { content: '{"text":"Good."}' } }
          : provider === "anthropic"
            ? { content: [{ type: "text", text: '{"text":"Good."}' }] }
            : { choices: [{ message: { content: '{"text":"Good."}' } }] };
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(JSON.stringify(response)));
      expect(
        await requestWording(
          { ...defaults(provider), key: "fake-test-key" },
          prompt,
          new AbortController().signal,
          fetcher,
        ),
      ).toBe('{"text":"Good."}');
      const [url, init] = fetcher.mock.calls[0];
      expect(String(url)).toContain(
        provider === "ollama"
          ? "/api/chat"
          : provider === "anthropic"
            ? "/v1/messages"
            : "/v1/chat/completions",
      );
      expect(init?.body).toContain(prompt);
      expect(init?.credentials).toBe("omit");
      if (provider === "anthropic")
        expect(init?.headers).toHaveProperty(
          "anthropic-dangerous-direct-browser-access",
          "true",
        );
    });
  }
  it("does not fetch when off or already cancelled", async () => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(
      requestWording(
        defaults("off"),
        prompt,
        new AbortController().signal,
        fetcher,
      ),
    ).rejects.toThrow();
    const controller = new AbortController();
    controller.abort();
    await expect(
      requestWording(defaults("ollama"), prompt, controller.signal, fetcher),
    ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("rejects network and HTTP errors", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("private error", { status: 401 }));
    await expect(
      requestWording(
        { ...defaults("anthropic"), key: "fake" },
        prompt,
        new AbortController().signal,
        fetcher,
      ),
    ).rejects.toThrow("Wording unavailable");
  });
});

it("times out and aborts browser requests, and forwards explicit cancellation", async () => {
  vi.useFakeTimers();
  try {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => reject(new DOMException("Aborted", "AbortError")),
            { once: true },
          );
        }),
    );
    const request = requestWording(
      defaults("ollama"),
      "facts",
      new AbortController().signal,
      fetcher,
    );
    const rejection = expect(request).rejects.toThrow("Aborted");
    await vi.advanceTimersByTimeAsync(20000);
    await rejection;
    expect(fetcher.mock.calls[0][1]?.signal?.aborted).toBe(true);
    const controller = new AbortController();
    const cancelled = requestWording(
      defaults("ollama"),
      "facts",
      controller.signal,
      fetcher,
    );
    const cancelledRejection = expect(cancelled).rejects.toThrow("Aborted");
    controller.abort();
    await cancelledRejection;
  } finally {
    vi.useRealTimers();
  }
});

it("never sends keys to insecure remote endpoints or credential-bearing URLs", async () => {
  const fetcher = vi.fn<typeof fetch>();
  for (const endpoint of [
    "http://remote.example",
    "https://user:pass@example.com",
    "https://example.com?key=secret",
    "file:///tmp/model",
  ]) {
    await expect(
      requestWording(
        { ...defaults("anthropic"), key: "fake", endpoint },
        "facts",
        new AbortController().signal,
        fetcher,
      ),
    ).rejects.toThrow();
  }
  expect(fetcher).not.toHaveBeenCalled();
});
