import { expect, test, type Page } from "@playwright/test";

async function seedReviewedMainLine(page: Page, otherDue = false) {
  await page.goto("/e2e/fixtures/board.html");
  await page.evaluate(async (otherDue) => {
    const repPath = "/src/repertoire/bundled.ts";
    const progressPath = "/src/progress/Progress.ts";
    const { repertoire } = await import(repPath);
    const { openProgress } = await import(progressPath);
    const store = await openProgress();
    try {
      const cards = repertoire.selectLines("white", ["italian-pianissimo-main"]).cards("white");
      let id = 0;
      const attemptId = () => "00000000000000000000" + String(++id).padStart(6, "0");
      await store.record({
        attemptId: attemptId(), sessionId: "completed", cardId: cards[0].id,
        lineId: "italian-pianissimo-main", context: "practice", lineCompleted: true,
        grade: "good", hintsUsed: 0, at: Date.now(), durationMs: 0, schedulingEligible: false,
      });
      for (const card of cards) await store.record({
        attemptId: attemptId(), sessionId: "reviewed", cardId: card.id,
        lineId: "italian-pianissimo-main", context: "repertoire", grade: "good",
        hintsUsed: 0, at: Date.now(), durationMs: 100, schedulingEligible: true,
      });
      if (otherDue) {
        const extra = repertoire.selectLines("white", ["italian-two-knights"]).cards("white")[0];
        await store.record({
          attemptId: attemptId(), sessionId: "completed-other", cardId: extra.id,
          lineId: "italian-two-knights", context: "practice", lineCompleted: true,
          grade: "good", hintsUsed: 0, at: Date.now(), durationMs: 0, schedulingEligible: false,
        });
      }
    } finally {
      store.close();
    }
  }, otherDue);
}

test("a recommended opening starts the lesson directly and exposes the next learning stage", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Choose this opening", exact: true }).click();
  const next = page.getByRole("region", { name: "Recommended next step", exact: true });
  await expect(next).toContainText("Learn");
  await next.getByRole("link", { name: "Start lesson", exact: true }).click();
  await expect(page.getByRole("region", { name: "Opening board", exact: true })).toBeVisible();
  await expect(page.getByRole("list", { name: "Learning stages", exact: true })).toBeVisible();
  for (let ply = 0; ply < 15; ply++)
    await page.getByRole("button", { name: "Next opening move", exact: true }).click();
  await page.getByRole("button", { name: "Complete lesson", exact: true }).click();
  await expect(page.getByRole("region", { name: "Next learning step", exact: true })).toContainText("Practice");
  await page.getByRole("button", { name: "Start practice", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Your move - White");
  await expect(page.getByRole("button", { name: "Hint 1 / 2", exact: true })).toHaveCount(0);
});

test("the lesson's next action is visible above the board on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#openings?line=italian-pianissimo-main&start=1");
  const next = page.getByRole("button", { name: "Next opening move", exact: true });
  await expect(next).toBeInViewport();
  await next.click();
  await expect(page.getByRole("group", { name: "Lesson navigation" })).toContainText("Move 1 / 15");
  const control = await next.boundingBox();
  const tabs = await page.getByRole("navigation", { name: "Compact navigation" }).boundingBox();
  expect(control!.y + control!.height).toBeLessThan(tabs!.y);
});

test("a running lesson has one control path and an explicit way back to the overview", async ({ page }) => {
  await page.goto("/#openings?line=italian-pianissimo-main&start=1");
  await expect(page.getByRole("region", { name: "Opening board" })).toBeVisible();
  for (const name of ["Learn", "Drill due cards", "Drill this line", "Practice whole line"]) {
    await expect(page.getByRole("button", { name, exact: true })).toHaveCount(0);
  }
  await page.getByRole("button", { name: "Back to overview", exact: true }).click();
  await expect(page.getByRole("button", { name: "Start lesson", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Learn", exact: true })).toBeVisible();
});

test("a direct start on a reviewed line opens whole-line Practice instead of an empty drill", async ({ page }) => {
  await seedReviewedMainLine(page);
  await page.goto("/#openings?line=italian-pianissimo-main&start=1");
  await expect(page.getByRole("status")).toHaveText("Your move - White");
  await expect(page.getByRole("button", { name: "Hint 1 / 2", exact: true })).toHaveCount(0);
});

test("the overview offers group reviews when this line is fresh but another line is due", async ({ page }) => {
  await seedReviewedMainLine(page, true);
  await page.goto("/#openings?line=italian-pianissimo-main");
  await page.getByRole("button", { name: "Review group due moves", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Your move - White");
  await expect(page.getByRole("button", { name: "Hint 1 / 2", exact: true })).toBeVisible();
});
