import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

// Replace the composition root, using the real review pipeline and persistent
// caches with a delayed fake Engine port. No test flag ships in production.
const fakeModule = `
import { Game } from '/src/game/Game.ts';
import { Review } from '/src/review/Review.ts';
import { ReviewCache } from '/src/engine/ReviewCache.ts';
import { AnalysisCache } from '/src/engine/AnalysisCache.ts';
import { repertoire } from '/src/repertoire/bundled.ts';
const cache = new ReviewCache(localStorage);
const key = g => 'e2e-coach-v1:' + JSON.stringify([g.startFen,g.moves]);
export const cachedReview = g => cache.get(key(g));
export const releaseReview = () => {};
export const reviewEngine = { analyse: async (position, budget, signal) => {
  const calls = Number(localStorage.getItem('fake-analysis-calls') ?? 0);
  localStorage.setItem('fake-analysis-calls', String(calls + 1));
  signal?.addEventListener('abort', () => localStorage.setItem('fake-aborts', String(Number(localStorage.getItem('fake-aborts') ?? 0) + 1)), {once:true});
  if (budget.priority === 'hint') localStorage.setItem('fake-hint-budget', JSON.stringify(budget));
  await new Promise(resolve => setTimeout(resolve, budget.priority === 'hint' ? 400 : 80));
  signal?.throwIfAborted();
  const game = new Game(position.startFen);
  position.moves.forEach(m => game.play(m));
  const moves = [...game.destinations()].flatMap(([from,tos]) => tos.map(to => from+to));
  return { complete:true, lines:moves.slice(0,2).map((uci,i) => ({uci:[uci],depth:12,cp:30-position.moves.length*10-i*5})) };
}};
const review = new Review(new AnalysisCache(reviewEngine, localStorage, 'fake-v1'), k => repertoire.isBook('white',k) || repertoire.isBook('black',k));
export async function analyseGame(game,signal,progress) {
  const result = cachedReview(game) ?? await review.analyse(game,signal,progress);
  signal.throwIfAborted(); cache.set(key(game),result); return result;
}`;
const pgn =
  '[White "fbnkch"]\n[Black "Review opponent"]\n[Result "1-0"]\n\n1. a3 a6 2. h3 h6 3. b3 b6 4. g3 g6 5. Bb2 Bb7 1-0';

const tacticalFake = fakeModule
  .replace(
    "uci:[uci]",
    "uci: position.moves.length === 0 && i === 0 ? ['e2e4','e7e5','g1f3'] : [uci]",
  )
  .replace(
    "moves.slice(0,2)",
    "moves.sort((a,b) => (b === 'e2e4') - (a === 'e2e4')).slice(0,2)",
  )
  .replace(
    "30-position.moves.length*10-i*5",
    "(position.moves.length === 0 ? 0 : -500)-i*5",
  );

test.beforeEach(async ({ page }) => {
  await page.route("**/src/review/browserReview.ts*", (route) =>
    route.fulfill({ contentType: "application/javascript", body: fakeModule }),
  );
  await page.route("**/stockfish/**", (route) => route.abort());
  await page.goto("/#games");
  await page.getByLabel("One or more games").fill(pgn);
  await page.getByRole("button", { name: "Import PGN", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("1 games imported");
  await page.getByRole("button", { name: /Review game/ }).click();
});

test("review classifies, navigates its graph, explores without live analysis and reopens instantly after reload", async ({
  page,
}, info) => {
  const review = page.getByRole("region", { name: "Game Review", exact: true });
  await expect(
    review.getByText("Lichess formula", { exact: true }),
  ).toBeVisible();
  await expect(
    review.getByText("approximation of Chess.com", { exact: true }),
  ).toBeVisible();
  await review
    .getByRole("button", { name: "Start analysis", exact: true })
    .click();
  await expect(review.getByRole("status")).toContainText("Analysis complete");
  await expect(review.locator(".review-accuracy strong").first()).toHaveText(
    /\d+\.\d%/,
  );
  await expect(
    review.getByRole("button", {
      name: "Position 4, evaluation -0.1",
      exact: true,
    }),
  ).toBeVisible();
  await review
    .getByRole("button", { name: "Position 4, evaluation -0.1", exact: true })
    .click();
  await expect(
    review.getByRole("button", { name: "4: h6, Best", exact: true }),
  ).toHaveAttribute("aria-current", "step");
  await review.press("ArrowRight");
  await expect(review.getByRole("button", { name: /^5: b3,/ })).toHaveAttribute(
    "aria-current",
    "step",
  );
  const calls = await page.evaluate(() =>
    localStorage.getItem("fake-analysis-calls"),
  );
  // Click-click exploration off the reviewed mainline.
  const board = review.locator("cg-board");
  const box = (await board.boundingBox())!;
  await board.click({
    position: { x: (box.width * 4.5) / 8, y: (box.height * 1.5) / 8 },
  });
  await board.click({
    position: { x: (box.width * 4.5) / 8, y: (box.height * 2.5) / 8 },
  });
  await expect(review.getByText(/^Exploring:/)).toBeVisible();
  await expect(review.getByRole("img", { name: /not analysed/ })).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("fake-analysis-calls")),
  ).toBe(calls);
  // Stepping back out of a one-move variation returns to the same game ply.
  await review.getByRole("button", { name: "Previous move" }).click();
  await expect(review.getByText(/^Exploring:/)).toBeHidden();
  await expect(review.getByRole("button", { name: /^5: b3,/ })).toHaveAttribute(
    "aria-current",
    "step",
  );
  await board.click({
    position: { x: (box.width * 4.5) / 8, y: (box.height * 1.5) / 8 },
  });
  await board.click({
    position: { x: (box.width * 4.5) / 8, y: (box.height * 2.5) / 8 },
  });
  await expect(review.getByText(/^Exploring:/)).toBeVisible();
  await review.getByRole("button", { name: "Return to game" }).click();
  await page.screenshot({
    path: info.outputPath("review-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(board).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("review-mobile.png"),
    fullPage: true,
  });
  await review.getByRole("button", { name: "Back to games" }).click();
  await expect(page.getByText("Reviewed", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /Review game/ }).click();
  await expect(review.getByRole("status")).toContainText("Analysis complete");
  expect(
    await page.evaluate(() => localStorage.getItem("fake-analysis-calls")),
  ).toBe(calls);
});

test("cancel resumes cached positions, and leaving the page cancels stale work", async ({
  page,
}) => {
  const review = page.getByRole("region", { name: "Game Review", exact: true });
  await review.getByRole("button", { name: "Start analysis" }).click();
  await expect(review.getByRole("progressbar")).toHaveAttribute(
    "value",
    /[2-9]/,
  );
  await review.getByRole("button", { name: "Cancel analysis" }).click();
  await expect(review.getByRole("status")).toContainText("Analysis paused");
  await expect(
    review.getByRole("button", { name: "Resume analysis" }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /Review game/ }).click();
  await review.getByRole("button", { name: "Start analysis" }).click();
  await expect(review.getByRole("status")).toContainText("Analysis complete");
  expect(
    Number(
      await page.evaluate(() => localStorage.getItem("fake-analysis-calls")),
    ),
  ).toBeLessThanOrEqual(12);
  await review.getByRole("button", { name: "Back to games" }).click();
  await page
    .getByLabel("One or more games")
    .fill(pgn.replace("1. a3 a6", "1. a4 a5"));
  await page.getByRole("button", { name: "Import PGN", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("1 games imported");
  await page
    .getByRole("row")
    .filter({ hasText: "Not reviewed" })
    .getByRole("button", { name: /Review game/ })
    .click();
  const aborted = Number(
    await page.evaluate(() => localStorage.getItem("fake-aborts")),
  );
  await review.getByRole("button", { name: "Start analysis" }).click();
  await review.getByRole("button", { name: "Back to games" }).click();
  await expect(
    page.getByRole("heading", { name: "Games", exact: true }),
  ).toBeVisible();
  await expect
    .poll(async () =>
      Number(await page.evaluate(() => localStorage.getItem("fake-aborts"))),
    )
    .toBeGreaterThan(aborted);
});

test("explains a blunder, replays and retries the better move, and persists a personal training card", async ({
  page,
}, info) => {
  await page.route("**/src/review/browserReview.ts*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: tacticalFake,
    }),
  );
  await page.reload();
  await page.getByRole("button", { name: /Review game/ }).click();
  const review = page.getByRole("region", { name: "Game Review", exact: true });
  await review.getByRole("button", { name: "Start analysis" }).click();
  await expect(review.getByRole("status")).toContainText("Analysis complete");
  await review
    .getByRole("button", { name: "1: a3, Blunder", exact: true })
    .click();
  await expect(review.getByText(/Better was e4/)).toBeVisible();
  await review.getByRole("link", { name: /Golden rule/ }).click();
  await expect(
    review.getByRole("complementary", { name: "Golden rule" }),
  ).toBeVisible();
  await expect(
    review.getByRole("button", { name: /You left your repertoire at move 1/ }),
  ).toBeVisible();
  await review.getByRole("button", { name: "Replay better line" }).click();
  await expect(review.getByText(/Exploring: 1. e4/)).toBeVisible();
  await review.getByRole("button", { name: "Next move", exact: true }).click();
  await expect(review.getByText(/Exploring: 1. e4 e5/)).toBeVisible();
  await review.getByRole("button", { name: "Next move", exact: true }).click();
  await expect(review.getByText(/Exploring: 1. e4 e5 2. Nf3/)).toBeVisible();
  await review.getByRole("button", { name: "Return to game" }).click();
  await review
    .getByRole("button", { name: "Retry position", exact: true })
    .click();
  const retry = page.getByRole("region", { name: "Retry position" });
  await retry.getByRole("button", { name: "Hint 1 / 2", exact: true }).click();
  await expect(retry.getByText("Look at the piece on e2.")).toBeVisible();
  await retry.getByRole("button", { name: "Hint 2 / 2", exact: true }).click();
  await expect(retry.getByText("Play e4 (e2 → e4).")).toBeVisible();
  await expect(
    retry.getByRole("button", { name: "Hint 2 / 2" }),
  ).toBeDisabled();
  await retry.getByRole("button", { name: "Back to review" }).click();
  await review.getByRole("button", { name: "Add to training" }).click();
  await expect(review.getByText("Added to training.")).toBeVisible();
  await page.screenshot({
    path: info.outputPath("explanation-card.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("explanation-mobile.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await review.getByRole("button", { name: "Back to games" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Train personal mistakes" }).click();
  await page.getByRole("button", { name: "Load due cards" }).click();
  await expect(page.getByText("1 personal cards due")).toBeVisible();
  await page.getByRole("button", { name: /Train white position/ }).click();
  const board = page
    .getByRole("region", { name: "Retry position" })
    .locator("cg-board");
  const box = (await board.boundingBox())!;
  await board.click({
    position: { x: (box.width * 4.5) / 8, y: (box.height * 6.5) / 8 },
  });
  await board.click({
    position: { x: (box.width * 4.5) / 8, y: (box.height * 4.5) / 8 },
  });
  await expect(page.getByText("Correct.")).toBeVisible();
  await page.getByRole("button", { name: "Back to training" }).click();
  await expect(page.getByText("0 personal cards due")).toBeVisible();
});

test("Hint is on demand, aborts when leaving a retry, resets and logs one hinted attempt", async ({
  page,
}, info) => {
  await page.route("**/src/review/browserReview.ts*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: tacticalFake,
    }),
  );
  await page.addInitScript(() =>
    Object.defineProperty(window, "showSaveFilePicker", {
      value: undefined,
      configurable: true,
    }),
  );
  await page.reload();
  await page.getByRole("button", { name: /Review game/ }).click();
  const review = page.getByRole("region", { name: "Game Review", exact: true });
  const retry = page.getByRole("region", { name: "Retry position" });
  await review.getByRole("button", { name: "Start analysis" }).click();
  await expect(review.getByRole("status")).toContainText("Analysis complete");
  await review
    .getByRole("button", { name: "1: a3, Blunder", exact: true })
    .click();
  const calls = Number(
    await page.evaluate(() => localStorage.getItem("fake-analysis-calls")),
  );
  await review
    .getByRole("button", { name: "Retry position", exact: true })
    .click();
  expect(
    Number(
      await page.evaluate(() => localStorage.getItem("fake-analysis-calls")),
    ),
  ).toBe(calls);
  await retry.getByRole("button", { name: "Hint 1 / 2" }).click();
  await retry.getByRole("button", { name: "Back to review" }).click();
  await expect
    .poll(() =>
      page.evaluate(() => Number(localStorage.getItem("fake-aborts"))),
    )
    .toBe(1);
  await review
    .getByRole("button", { name: "Retry position", exact: true })
    .click();
  await expect(retry.getByLabel("Position hint")).toHaveCount(0);
  await retry.getByRole("button", { name: "Hint 1 / 2" }).click();
  await expect(retry.getByLabel("Position hint")).toHaveText(
    "Look at the piece on e2.",
  );
  expect(
    JSON.parse(
      (await page.evaluate(() => localStorage.getItem("fake-hint-budget")))!,
    ),
  ).toEqual({
    movetime: 300,
    multipv: 1,
    priority: "hint",
  });
  await retry.getByRole("button", { name: "Hint 2 / 2" }).click();
  await expect(retry.getByLabel("Position hint")).toHaveText(
    "Play e4 (e2 \u2192 e4).",
  );
  await page.screenshot({
    path: info.outputPath("hint-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("hint-mobile.png"),
    fullPage: true,
  });
  const board = retry.locator("cg-board");
  const box = (await board.boundingBox())!;
  for (const rank of [6.5, 4.5])
    await board.click({
      position: { x: (box.width * 4.5) / 8, y: (box.height * rank) / 8 },
    });
  await expect(retry.getByText("Correct.")).toBeVisible();
  await expect(retry.getByLabel("Position hint")).toHaveCount(0);
  await expect(
    retry.getByRole("button", { name: "Hint 1 / 2" }),
  ).toBeDisabled();
  await retry.getByRole("button", { name: "Back to review" }).click();
  await review.getByRole("button", { name: "Back to games" }).click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByText("Coach wording", { exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByText("Backup and storage", { exact: true })
    .click();
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON" }).click();
  const download = await downloading;
  const path = info.outputPath("hint-progress.json");
  await download.saveAs(path);
  const backup = JSON.parse(await readFile(path, "utf8"));
  expect(backup.data.reviewLog).toHaveLength(1);
  expect(backup.data.reviewLog[0]).toMatchObject({
    grade: "hard",
    hintsUsed: 2,
    context: "mistake",
  });
});

test("optional wording sends facts only on click, validates output and keeps secrets out of backups", async ({
  page,
}, info) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, "showSaveFilePicker", {
      value: undefined,
      configurable: true,
    }),
  );
  await page.route("**/src/review/browserReview.ts*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: tacticalFake,
    }),
  );
  await page.reload();
  await page.getByRole("button", { name: /Review game/ }).click();
  const review = page.getByRole("region", { name: "Game Review", exact: true });
  await review.getByRole("button", { name: "Start analysis" }).click();
  await expect(review.getByRole("status")).toContainText("Analysis complete");
  await review
    .getByRole("button", { name: "1: a3, Blunder", exact: true })
    .click();
  let calls = 0;
  let response = '{"text":"Consider e4, followed by e5 and Nf3."}';
  await page.route("http://localhost:11434/api/chat", async (route) => {
    calls++;
    const body = route.request().postDataJSON();
    expect(body.messages[0].content).not.toContain("fbnkch");
    expect(body.messages[0].content).not.toContain("[White");
    await route.fulfill({ json: { message: { content: response } } });
  });
  await review.getByRole("button", { name: "Rephrase", exact: true }).click();
  await expect(review.getByText(/Explanation wording is Off/)).toBeVisible();
  expect(calls).toBe(0);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByText("Coach wording", { exact: true })
    .click();
  await page.getByLabel("Wording provider").selectOption("ollama");
  await page.getByRole("button", { name: "Save wording settings" }).click();
  await expect(page.getByText("Wording settings saved.")).toBeVisible();
  await page.getByRole("button", { name: "Close settings" }).click();
  expect(calls).toBe(0);
  await review.getByRole("button", { name: "Rephrase", exact: true }).click();
  await expect(
    review.getByRole("heading", { name: "AI wording", exact: true }),
  ).toBeVisible();
  await review.getByText("Show rule-based explanation").click();
  await expect(
    review.getByLabel("Optional AI wording").getByText(/Better was e4/),
  ).toBeVisible();
  response = '{"text":"Play Qh4 and mate in 99."}';
  await review.getByRole("button", { name: "Rephrase", exact: true }).click();
  await expect(
    review.getByText(
      "AI wording could not be verified. Rule-based text is shown.",
    ),
  ).toBeVisible();
  await expect(review.getByText(/Play Qh4/)).toHaveCount(0);
  await page.route("http://localhost:11434/api/chat", (route) =>
    route.fulfill({ status: 500, body: "failure" }),
  );
  await review.getByRole("button", { name: "Rephrase", exact: true }).click();
  await expect(
    review.getByText("AI wording unavailable. Rule-based text is shown."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByText("Coach wording", { exact: true })
    .click();
  await page.getByLabel("Wording provider").selectOption("anthropic");
  await expect(page.getByLabel("Wording model")).toHaveValue(
    "claude-haiku-5-5",
  );
  await page
    .getByLabel("Provider API key")
    .fill("fake-e2e-secret-never-export");
  await page.getByRole("button", { name: "Save wording settings" }).click();
  await expect(page.getByText("Wording settings saved.")).toBeVisible();
  await page.screenshot({
    path: info.outputPath("wording-settings.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  const settingsDialog = page.getByRole("dialog", { name: "Board settings" });
  expect(
    await settingsDialog.evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("wording-settings-mobile.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page
    .getByRole("dialog")
    .getByText("Backup and storage", { exact: true })
    .click();
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON" }).click();
  const download = await downloading;
  const path = info.outputPath("wording-backup.json");
  await download.saveAs(path);
  const backup = await readFile(path, "utf8");
  expect(backup).not.toContain("fake-e2e-secret");
  expect(backup).not.toContain("explanation-wording");
  expect(backup).not.toContain("api.anthropic.com");
  await page.getByLabel("Wording provider").selectOption("off");
  await page.getByRole("button", { name: "Save wording settings" }).click();
  await expect(page.getByText("Wording settings saved.")).toBeVisible();
  await page.getByRole("button", { name: "Close settings" }).click();
  await review.getByRole("button", { name: "Rephrase", exact: true }).click();
  await expect(review.getByText(/Explanation wording is Off/)).toBeVisible();
});
