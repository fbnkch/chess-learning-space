import { expect, test } from "@playwright/test";
import archives from "./fixtures/import/archives.json" with { type: "json" };
import month from "./fixtures/import/month.json" with { type: "json" };
import { readFile } from "node:fs/promises";

test("imports last N games sequentially, persists across reload and replays moves", async ({
  page,
}, info) => {
  const requests: string[] = [];
  await page.route("https://api.chess.com/pub/**", async (route) => {
    const url = route.request().url();
    requests.push(url);
    await route.fulfill({ json: url.endsWith("archives") ? archives : month });
  });
  await page.goto("/#games");
  await page.getByLabel("Number of games").fill("2");
  await page.getByRole("button", { name: "Import games", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText(/2 games imported/);
  expect(requests.map((url) => url.split("/").slice(-2).join("/"))).toEqual([
    "games/archives",
    "2026/10",
  ]);
  const rows = page
    .getByRole("region", { name: "Saved games" })
    .getByRole("row");
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(1)).toContainText("white");
  await expect(rows.nth(2)).toContainText("black");
  await expect(rows.nth(2)).toContainText("1/259200");
  await page.reload();
  await expect(rows).toHaveCount(3);
  await expect(page.getByText("Not reviewed", { exact: true })).toHaveCount(2);
  await page.screenshot({ path: info.outputPath("games.png"), fullPage: true });
  await page
    .getByRole("button", { name: /Open game/ })
    .first()
    .click();
  const viewer = page.getByRole("region", { name: "Game viewer" });
  await expect(viewer.locator("cg-board")).toBeVisible();
  await viewer.getByRole("button", { name: "Next move", exact: true }).click();
  await expect(
    viewer.getByRole("button", { name: "e4", exact: true }),
  ).toHaveAttribute("aria-current", "step");
  await viewer.press("ArrowRight");
  await expect(
    viewer.getByRole("button", { name: "e5", exact: true }),
  ).toHaveAttribute("aria-current", "step");
  await page.screenshot({
    path: info.outputPath("viewer.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(viewer.locator("cg-board")).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.screenshot({
    path: info.outputPath("games-mobile.png"),
    fullPage: true,
  });
});

test("pasted games report a broken game independently and skip duplicates", async ({
  page,
}) => {
  await page.goto("/#games");
  await page
    .getByLabel("One or more games")
    .fill(
      await readFile(
        new URL("./fixtures/import/paste.pgn", import.meta.url),
        "utf8",
      ),
    );
  await page.getByRole("button", { name: "Import PGN", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText(/2 games imported/);
  await expect(page.getByRole("alert")).toContainText("Game 2: Invalid PGN");
  await page.getByRole("button", { name: "Import PGN", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText(
    /0 games imported. 2 duplicates skipped/,
  );
  await expect(
    page.getByRole("region", { name: "Saved games" }).getByRole("row"),
  ).toHaveCount(3);
});

test("month imports use the username in settings and handle a missing month", async ({
  page,
}) => {
  const requests: string[] = [];
  await page.route("https://api.chess.com/pub/**", async (route) => {
    const url = route.request().url();
    requests.push(url);
    if (url.endsWith("archives"))
      await route.fulfill({
        json: {
          archives: ["https://api.chess.com/pub/player/another/games/2026/09"],
        },
      });
    else await route.fulfill({ status: 404, json: { message: "Not Found" } });
  });
  await page.goto("/#games");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByText("Board and practice", { exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Chess.com username", exact: true })
    .fill("another");
  await page
    .getByRole("button", { name: "Close settings", exact: true })
    .click();
  await page.reload();
  await page.getByLabel("Import range").selectOption("month");
  await page.getByLabel("Month", { exact: true }).fill("2026-09");
  await page.getByRole("button", { name: "Import games", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText(/0 games imported/);
  expect(requests).toEqual([
    "https://api.chess.com/pub/player/another/games/archives",
    "https://api.chess.com/pub/player/another/games/2026/09",
  ]);
});

test("retries a rate limit and saves partial imports when the next month fails", async ({
  page,
}) => {
  let newestRequests = 0;
  await page.route("https://api.chess.com/pub/**", async (route) => {
    const url = route.request().url();
    if (url.endsWith("archives")) await route.fulfill({ json: archives });
    else if (url.endsWith("2026/10")) {
      newestRequests++;
      if (newestRequests === 1)
        await route.fulfill({
          status: 429,
          json: { message: "Too Many Requests" },
        });
      else await route.fulfill({ json: month });
    } else await route.abort("failed");
  });
  await page.goto("/#games");
  await page.getByRole("button", { name: "Import games", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText(/2 games imported/, {
    timeout: 15000,
  });
  await expect(page.getByRole("alert")).toContainText("Archive 2026/09");
  await expect(page.getByRole("alert")).toContainText(
    "completed games have been kept",
  );
  expect(newestRequests).toBe(2);
  await page.reload();
  await expect(
    page.getByRole("region", { name: "Saved games" }).getByRole("row"),
  ).toHaveCount(3);
});

test("navigation aborts the old import and a new visit starts only one request chain", async ({
  page,
}) => {
  let release!: () => void;
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  let oldStarted!: () => void;
  const started = new Promise<void>((resolve) => {
    oldStarted = resolve;
  });
  const requests: string[] = [];
  let first = true;
  await page.route("https://api.chess.com/pub/**", async (route) => {
    const url = route.request().url();
    requests.push(url);
    if (url.endsWith("archives")) await route.fulfill({ json: archives });
    else if (first) {
      first = false;
      oldStarted();
      await blocked;
      await route.fulfill({ json: month }).catch(() => {});
    } else await route.fulfill({ json: month });
  });
  await page.goto("/#games");
  await page.getByRole("button", { name: "Import games", exact: true }).click();
  await started;
  await page.getByRole("link", { name: /Free play/ }).click();
  release();
  await page.getByRole("link", { name: /Games/ }).click();
  await expect(page.getByText("0 SAVED", { exact: true })).toBeVisible();
  await page.getByLabel("Number of games").fill("2");
  await page.getByRole("button", { name: "Import games", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText(/2 games imported/);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.reload();
  await expect(page.getByText("2 SAVED", { exact: true })).toBeVisible();
  expect(requests.map((url) => url.split("/").slice(-2).join("/"))).toEqual([
    "games/archives",
    "2026/10",
    "games/archives",
    "2026/10",
  ]);
});
