import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve, sep, extname } from "node:path";
import config from "../vercel.json" with { type: "json" };
test("hosting CSP permits the real Stockfish worker and blocks external script execution", async ({
  page,
  context,
  baseURL,
}) => {
  const headers = Object.fromEntries(
    config.headers[0].headers.map((header) => [header.key, header.value]),
  );
  // Serve the production artifact with the exact hosting headers. Vite's development
  // refresh preamble intentionally needs inline scripts, unlike the shipped build.
  const root = resolve("dist");
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== new URL(baseURL!).origin) return route.abort();
    const file = resolve(
      root,
      "." + (url.pathname === "/" ? "/index.html" : url.pathname),
    );
    if (!file.startsWith(root + sep)) return route.abort();
    const type: Record<string, string> = {
      ".html": "text/html",
      ".js": "text/javascript",
      ".css": "text/css",
      ".svg": "image/svg+xml",
      ".json": "application/json",
      ".wasm": "application/wasm",
      ".woff2": "font/woff2",
      ".mp3": "audio/mpeg",
    };
    try {
      return await route.fulfill({
        status: 200,
        body: await readFile(file),
        headers: {
          ...headers,
          "Content-Type": type[extname(file)] ?? "application/octet-stream",
        },
      });
    } catch {
      return route.fulfill({ status: 404 });
    }
  });
  const fontRequests: string[] = [];
  const consoleErrors: string[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith(".woff2")) fontRequests.push(request.url());
  });
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.addInitScript(() => {
    (window as Window & { cspViolations?: string[] }).cspViolations = [];
    document.addEventListener("securitypolicyviolation", (event) =>
      (window as Window & { cspViolations?: string[] }).cspViolations!.push(
        event.violatedDirective,
      ),
    );
  });
  await page.goto("/#free-play");
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  expect(fontRequests.length).toBeGreaterThanOrEqual(1);
  expect(
    fontRequests.every(
      (url) => new URL(url).origin === new URL(baseURL!).origin,
    ),
  ).toBe(true);
  expect(
    await page.evaluate(
      () => {
        const notoSansLoaded = Array.from(document.fonts).some(
          (font) => font.family === "Noto Sans" && font.status === "loaded",
        );
        const heading = document.querySelector("h1");
        const family = heading && getComputedStyle(heading).fontFamily;
        return (
          notoSansLoaded &&
          family?.split(",")[0].trim().replace(/^['"]|['"]$/g, "") ===
            "Noto Sans"
        );
      },
    ),
  ).toBe(true);
  expect(consoleErrors).toEqual([]);
  await page.getByRole("button", { name: "Engine", exact: true }).click();
  await expect(page.getByTestId("engine-lines")).toBeVisible({
    timeout: 20000,
  });
  expect(
    await page.evaluate(
      () => (window as Window & { cspViolations?: string[] }).cspViolations,
    ),
  ).toEqual([]);
  const blocked = await page.evaluate(
    () =>
      new Promise<boolean>((resolve) => {
        const element = document.createElement("script");
        element.src = "https://blocked.example/script.js";
        element.onerror = () => resolve(true);
        element.onload = () => resolve(false);
        document.head.append(element);
      }),
  );
  expect(blocked).toBe(true);
  expect(
    await page.evaluate(
      () => (window as Window & { cspViolations?: string[] }).cspViolations,
    ),
  ).toContain("script-src-elem");
});
