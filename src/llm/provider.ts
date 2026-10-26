import { z } from "zod";
export const configSchema = z.object({
  provider: z.enum(["off", "ollama", "anthropic", "openai"]),
  endpoint: z.url(),
  model: z.string().min(1).max(150),
  key: z.string().max(1000),
});
export type WordingConfig = z.infer<typeof configSchema>;
export function defaults(provider: WordingConfig["provider"]): WordingConfig {
  return {
    provider,
    key: "",
    endpoint:
      provider === "ollama"
        ? "http://localhost:11434"
        : provider === "openai"
          ? "https://api.openai.com"
          : "https://api.anthropic.com",
    model:
      provider === "ollama"
        ? "llama3.2"
        : provider === "openai"
          ? "gpt-4.1-mini"
          : "claude-haiku-5-5",
  };
}
export function checkConfig(config: WordingConfig) {
  configSchema.parse(config);
  const url = new URL(config.endpoint);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !(
      url.protocol === "https:" ||
      (url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
    )
  )
    throw new Error(
      "Use HTTPS, or HTTP on localhost only; no URL credentials or query.",
    );
  if (
    config.provider !== "off" &&
    config.provider !== "ollama" &&
    !config.key.trim()
  )
    throw new Error("Enter your provider key.");
}
export async function requestWording(
  config: WordingConfig,
  prompt: string,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<string> {
  signal.throwIfAborted();
  if (config.provider === "off") throw new Error("Wording is off");
  checkConfig(config);
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, 20000);
  try {
    const anthropic = config.provider === "anthropic",
      ollama = config.provider === "ollama";
    const url =
      config.endpoint.replace(/\/$/, "") +
      (ollama
        ? "/api/chat"
        : anthropic
          ? "/v1/messages"
          : "/v1/chat/completions");
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (anthropic)
      Object.assign(headers, {
        "x-api-key": config.key,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      });
    else if (!ollama) headers.Authorization = `Bearer ${config.key}`;
    const response = await fetcher(url, {
      method: "POST",
      headers,
      credentials: "omit",
      redirect: "error",
      signal: controller.signal,
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: "user", content: prompt }],
        ...(ollama
          ? {
              stream: false,
              format: "json",
              options: { temperature: 0, num_predict: 250 },
            }
          : { temperature: 0, max_tokens: 250 }),
      }),
    });
    if (!response.ok) throw new Error("Wording unavailable");
    const data = await response.json();
    const content: unknown = ollama
      ? data.message?.content
      : anthropic
        ? data.content
            ?.filter((c: { type: string }) => c.type === "text")
            .map((c: { text: string }) => c.text)
            .join("")
        : data.choices?.[0]?.message?.content;
    controller.signal.throwIfAborted();
    if (typeof content !== "string" || content.length > 5000)
      throw new Error("Wording unavailable");
    return content;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", abort);
  }
}
