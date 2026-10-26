import { expect, test } from "@playwright/test";
import { openingMove } from "./opening-move";

test("cohort lock, manual unlock, setting and coverage persist after learning and practising", async ({
  page,
}, info) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    if (!localStorage.getItem("chess-learning-space:settings:v1"))
      localStorage.setItem(
        "chess-learning-space:settings:v1",
        JSON.stringify({
          sound: false,
          animationMs: 0,
          coordinates: true,
          reducedMotion: true,
          activeLines: 3,
        }),
      );
  });
  await page.goto("/#openings");
  await page.locator(".opening-progress > summary").click();
  await expect(page.getByLabel("Active cohort")).toContainText(
    "3 active white lines",
  );
  const italian = page.getByLabel("Italian coverage", { exact: true });
  await expect(italian).toContainText(
    "0/24 positions discovered · 0 practiced · 0 in Drill · 0 mastered",
  );
  // The fourth line is locked and cannot enter Learn until explicitly admitted.
  const next = await page
    .getByLabel("Active cohort")
    .locator("p")
    .nth(1)
    .innerText();
  await page.locator(".line-list summary").click();
  const options = await page
    .getByLabel("Opening line")
    .locator("option")
    .allTextContents();
  expect(options.some((text) => text.includes("Locked"))).toBe(true);
  await page.getByLabel("Opening line").selectOption("italian-central-break");
  await expect(page.getByLabel("Line locked")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Learn", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Unlock next line", exact: true })
    .click();
  await expect(page.getByLabel("Active cohort")).toContainText(
    "4 active white lines",
  );
  expect(
    await page.getByLabel("Active cohort").locator("p").nth(1).innerText(),
  ).not.toBe(next);
  await page.reload();
  await page.locator(".opening-progress > summary").click();
  await expect(page.getByLabel("Active cohort")).toContainText(
    "4 active white lines",
  );
  await expect(italian).toContainText("0/24 positions discovered");
  await page.getByRole("button", { name: "Continue training" }).click();
  await expect(italian).toContainText("1/24 positions discovered");
  for (let ply = 0; ply < 15; ply++)
    await page.getByRole("button", { name: "Next opening move" }).click();
  await page.getByRole("button", { name: "Complete lesson" }).click();
  await expect(italian).toContainText(
    "8/24 positions discovered · 0 practiced · 0 in Drill · 0 mastered",
  );
  await page.getByRole("button", { name: "Continue training" }).click();
  for (const move of [
    "e2e4",
    "g1f3",
    "f1c4",
    "c2c3",
    "d2d3",
    "e1g1",
    "f1e1",
    "c4b3",
  ]) {
    await expect(page.getByRole("status")).toHaveText("Your move - White");
    await openingMove(page, move);
    await page.getByRole("button", { name: "Next card", exact: true }).click();
  }
  await expect(italian).toContainText(
    "8/24 positions discovered · 8 practiced · 8 in Drill · 0 mastered",
  );
  await page.reload();
  await page.locator(".opening-progress > summary").click();
  await expect(italian).toContainText(
    "8/24 positions discovered · 8 practiced · 8 in Drill · 0 mastered",
  );
  await page.locator(".line-list summary").click();
  await expect(
    page
      .locator(".line-list li")
      .filter({ hasText: "Italian: Giuoco Pianissimo main" }),
  ).toContainText(
    "8/8 positions discovered · 8 practiced · 8 in Drill · 0 mastered",
  );
  await page.screenshot({
    path: info.outputPath("openings-cohort-coverage.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByText("Board and practice", { exact: true })
    .click();
  await expect(page.getByLabel("Active lines per side")).toHaveValue("3");
  await page.getByLabel("Active lines per side").selectOption("5");
  await page.getByRole("button", { name: "Close settings" }).click();
  await page.reload();
  await page.locator(".opening-progress > summary").click();
  await expect(page.getByLabel("Active cohort")).toContainText(
    "Starting target 5",
  );
});

test("completing a skipped lesson with a shared start only discovers viewed positions", async ({
  page,
}) => {
  await page.goto("/#openings");
  await page.locator(".opening-progress > summary").click();
  const italian = page.getByLabel("Italian coverage", { exact: true });
  await page.getByRole("button", { name: "Continue training" }).click();
  await expect(italian).toContainText("1/24 positions discovered");
  await page.getByLabel("Opening line").selectOption("italian-be7");
  await page.getByRole("button", { name: "Continue training" }).click();
  await expect(
    page.getByRole("heading", { name: "Learn the line" }),
  ).toBeVisible();
  await page.locator(".opening-moves button").last().click();
  await page.getByRole("button", { name: "Complete lesson" }).click();
  await expect(italian).toContainText("1/24 positions discovered");
  await expect(page.getByLabel("Line stage")).toContainText("Practice");
  await page.reload();
  await page.locator(".opening-progress > summary").click();
  await expect(italian).toContainText("1/24 positions discovered");
});
