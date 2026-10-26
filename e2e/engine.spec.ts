import { expect, test } from "@playwright/test";

test("real single-threaded WASM analyses a FEN without isolation headers", async ({
  page,
}) => {
  const response = await page.goto("/#free-play");
  expect(response?.headers()["cross-origin-opener-policy"]).toBeUndefined();
  expect(response?.headers()["cross-origin-embedder-policy"]).toBeUndefined();
  expect(await page.evaluate(() => crossOriginIsolated)).toBe(false);
  await page.getByText("Load a position", { exact: true }).click();
  await page
    .getByLabel("FEN position")
    .fill("rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2");
  await page
    .getByRole("button", { name: "Load position", exact: true })
    .click();
  await page.getByRole("button", { name: "Engine", exact: true }).click();
  await expect(page.getByTestId("engine-lines")).toBeVisible({
    timeout: 20000,
  });
  await expect(page.getByTestId("engine-lines").locator("li")).toHaveCount(2);
  await expect(page.getByTestId("engine-lines")).toContainText(
    /Nf3|Nc3|Bc4|d4|f4|Be2|Bb5|c3/,
  );
  console.log(await page.getByTestId("analysis-time").textContent());
  await expect(
    page.getByRole("img", { name: /Evaluation from White/ }),
  ).toBeVisible();
  // A new position must never display the previous analysis or trigger live analysis.
  await page.getByRole("button", { name: "New board", exact: true }).click();
  await expect(page.getByTestId("engine-lines")).toHaveCount(0);
  await expect(
    page.getByText("Position changed. Analyze when you are ready."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Analyze position", exact: true })
    .click();
  await expect(page.getByTestId("engine-lines")).toBeVisible();
  await page.getByRole("button", { name: "Engine", exact: true }).click();
  await expect(page.locator(".eval-bar")).toHaveCount(0);
});

test("real WASM returns terminal stalemate and signed mate-zero for either turn", async ({
  page,
}) => {
  await page.goto("/#free-play");
  const results = await page.evaluate(async () => {
    const modulePath = "/src/engine/Engine.ts";
    const { StockfishEngine } = await import(modulePath);
    const uciPath = "/src/engine/uci.ts";
    const { parseInfo } = await import(uciPath);
    const diagnostics: string[] = [];
    const engine = new StockfishEngine(() => {
      const worker = new Worker("/stockfish/stockfish-19-lite-single.js");
      worker.addEventListener("message", (event) => {
        if (String(event.data).startsWith("info string"))
          diagnostics.push(String(event.data));
      });
      return worker;
    });
    try {
      const results = [];
      for (const startFen of [
        "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1",
        "7k/6Q1/6K1/8/8/8/8/8 b - - 0 1",
        "8/8/8/8/8/6k1/6q1/7K w - - 0 1",
      ])
        results.push(
          await engine.analyse(
            { startFen, moves: [] },
            { depth: 4, multipv: 2 },
          ),
        );
      console.log("Real UCI diagnostics:", diagnostics);
      if (
        !diagnostics.length ||
        diagnostics.some((line) => parseInfo(line, "white") !== undefined)
      )
        throw new Error("Real info string diagnostics must be ignored");
      return results;
    } finally {
      engine.dispose();
    }
  });
  expect(results).toEqual([
    { complete: true, lines: [{ depth: 0, cp: 0, uci: [] }] },
    { complete: true, lines: [{ depth: 0, mate: 0, winner: 1, uci: [] }] },
    { complete: true, lines: [{ depth: 0, mate: 0, winner: -1, uci: [] }] },
  ]);
});
test("engine layout preserves board size and keeps bottom player visible at 1400x860", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1400, height: 860 });
  await page.goto("/#free-play");
  const board = page.locator(".engine-board cg-board");
  const before = await board.boundingBox();
  await page.getByRole("button", { name: "Engine", exact: true }).click();
  await expect(page.getByTestId("engine-lines")).toBeVisible({
    timeout: 20000,
  });
  expect(await board.boundingBox()).toEqual(before);
  await expect(page.locator(".game-panel .engine-controls")).toBeVisible();
  const bottom = await page
    .locator(".board-column > .player")
    .last()
    .boundingBox();
  expect(bottom!.y + bottom!.height).toBeLessThanOrEqual(860);
  const panel = await page.locator(".game-panel").boundingBox();
  expect(panel!.y + panel!.height).toBeLessThanOrEqual(860);
  const toolbar = await page.locator(".board-toolbar").boundingBox();
  expect(toolbar!.y + toolbar!.height).toBeLessThanOrEqual(860);
  const label = page.locator(".eval-bar span");
  const initial = await label.getAttribute("class");
  await page.getByRole("button", { name: "Flip board" }).click();
  await expect(label).toHaveClass(
    initial === "leading-top" ? "leading-bottom" : "leading-top",
  );
  expect(await label.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  await page.screenshot({ path: "test-results/engine-1400x860.png" });
  await page.getByRole("button", { name: "Engine", exact: true }).click();
  expect(await board.boundingBox()).toEqual(before);
});

test("Black mate advantage labels the Black end before and after flipping", async ({
  page,
}) => {
  await page.goto("/#free-play");
  await page.getByText("Load a position", { exact: true }).click();
  await page.getByLabel("FEN position").fill("8/8/8/8/8/6k1/6q1/7K w - - 0 1");
  await page
    .getByRole("button", { name: "Load position", exact: true })
    .click();
  await page.getByRole("button", { name: "Engine", exact: true }).click();
  const label = page.locator(".eval-bar span");
  await expect(label).toHaveText("-M0", { timeout: 20000 });
  await expect(label).toHaveClass("leading-top");
  await page.getByRole("button", { name: "Flip board" }).click();
  await expect(label).toHaveClass("leading-bottom");
});
