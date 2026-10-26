import { expect, test } from "@playwright/test";
import { openingMove } from "./opening-move";
const moves = ["e2e4", "g1f3", "f1c4", "c2c3", "d2d3", "e1g1", "f1e1", "c4b3"];
test("Learn then mistaken Practice then clean Practice unlocks Drill, reload and backup retain it", async ({
  page,
}, info) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    Object.defineProperty(window, "showSaveFilePicker", {
      value: undefined,
      configurable: true,
    });
    localStorage.setItem(
      "chess-learning-space:settings:v1",
      JSON.stringify({
        sound: false,
        animationMs: 0,
        coordinates: true,
        reducedMotion: true,
      }),
    );
  });
  await page.goto("/#openings");
  await expect(page.getByLabel("Line stage")).toContainText("Learn");
  await expect(page.getByText("0 cards due", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Practice whole line" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Continue training" }).click();
  for (let ply = 0; ply < 15; ply++)
    await page.getByRole("button", { name: "Next opening move" }).click();
  await page.getByRole("button", { name: "Complete lesson" }).click();
  await expect(page.getByLabel("Line stage")).toContainText("Practice");
  await page.reload();
  await expect(page.getByLabel("Line stage")).toContainText("Practice");
  await page.getByRole("button", { name: "Continue training" }).click();
  await expect(
    page.getByRole("button", { name: "Hint 1 / 2", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("Plans, structure and patterns")).toHaveCount(0);
  await expect(page.locator("svg.cg-shapes line")).toHaveCount(0);
  await openingMove(page, "d2d4");
  await expect(
    page.getByRole("heading", { name: "Play e4", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".lesson-feedback")).toContainText("center");
  for (const move of moves) {
    await openingMove(page, move);
    await expect(page.getByRole("status")).toHaveText("Correct");
    await expect(page.locator(".lesson-feedback .rule-tags")).toHaveCount(0);
    await page.getByRole("button", { name: "Next card", exact: true }).click();
  }
  await expect(page.getByRole("status")).toHaveText("Session complete");
  await expect(page.getByLabel("Line stage")).toContainText("Practice");
  await expect(page.getByText("0 cards due", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Continue training" }).click();
  for (const move of moves) {
    await expect(page.getByRole("status")).toHaveText("Your move - White");
    await openingMove(page, move);
    await expect(page.getByRole("status")).toHaveText("Correct");
    await page.getByRole("button", { name: "Next card", exact: true }).click();
  }
  await expect(page.getByLabel("Line stage")).toContainText("Drill");
  await expect(page.getByText("8 cards due", { exact: true })).toBeVisible();
  await page.getByLabel("Opening line").selectOption("italian-central-break");
  await expect(page.getByLabel("Line stage")).toContainText("Learn");
  await expect(
    page.getByRole("button", { name: "Drill this line", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Opening line").selectOption("italian-pianissimo-main");
  await page.reload();
  await expect(page.getByLabel("Line stage")).toContainText("Drill");
  await expect(page.getByText("8 cards due", { exact: true })).toBeVisible();
  await page.screenshot({
    path: info.outputPath("practice-unlocked-openings.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByText("Backup and storage", { exact: true })
    .click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON" }).click();
  const path = info.outputPath("practice-progress.json");
  await (await download).saveAs(path);
  await page.goto("/e2e/fixtures/board.html");
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase("chess-learning-space");
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  });
  await page.goto("/#openings");
  await expect(page.getByLabel("Line stage")).toContainText("Learn");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByText("Backup and storage", { exact: true })
    .click();
  await page.getByLabel("Import JSON", { exact: true }).setInputFiles(path);
  await page.getByRole("button", { name: "Replace", exact: true }).click();
  await page
    .getByRole("button", { name: "Confirm replace", exact: true })
    .click();
  await expect(page.getByText(/Import complete/)).toBeVisible();
  await page.getByRole("button", { name: "Close settings" }).click();
  await expect(page.getByLabel("Line stage")).toContainText("Drill");
  await expect(page.getByText("8 cards due", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Continue training" }).click();
  await expect(
    page.getByRole("button", { name: "Hint 1 / 2", exact: true }),
  ).toBeVisible();
});
