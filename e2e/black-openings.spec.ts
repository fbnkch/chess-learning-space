import { expect, test } from "@playwright/test";
import { unlockDrill } from "./drill-setup";
import { openingMove as blackMove, returnToOpeningOverview } from "./opening-move";

for (const group of ["caro", "qgd"])
  test(`Black ${group}: choose, learn, drill and retain progress`, async ({
    page,
  }, info) => {
    // Animated preludes made the 5 s "Your move" wait flaky; the drill logic is what is tested here.
    await page.addInitScript(() => {
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
    const seeded = await unlockDrill(page);
    await page.goto("/#openings");
    await page.getByLabel("Training colour").selectOption("black");
    await page.getByLabel("Opening", { exact: true }).selectOption(group);
    await expect(
      page.getByLabel("Opening", { exact: true }).locator("option:checked"),
    ).toContainText(/\([1-9]\d* due\)/);
    await returnToOpeningOverview(page);
    await page.getByRole("button", { name: "Learn", exact: true }).click();
    await expect(page.locator(".cg-wrap.orientation-black")).toBeVisible();
    await page.getByRole("button", { name: "Next opening move" }).click();
    await page.getByRole("button", { name: "Next opening move" }).click();
    await expect(page.getByText(/Black move 1 \/ 8/)).toBeVisible();
    await returnToOpeningOverview(page);
    await page
      .getByRole("button", { name: "Drill this line", exact: true })
      .click();
    const moves =
      group === "caro"
        ? ["c7c6", "d7d5", "d5e4", "c8f5", "f5g6", "b8d7", "g6d3", "e7e6"]
        : ["d7d5", "e7e6", "g8f6", "f8e7", "e8g8", "b8d7", "c7c6", "d5c4"];
    for (const uci of moves) {
      await expect(page.getByRole("status")).toHaveText("Your move - Black");
      await blackMove(page, uci);
      await expect(page.getByRole("status")).toHaveText("Correct");
      await page
        .getByRole("button", { name: "Next card", exact: true })
        .click();
    }
    await expect(page.getByRole("status")).toHaveText("Session complete");
    await returnToOpeningOverview(page);
    await expect(
      page.getByRole("button", { name: "Drill this line", exact: true }),
    ).toBeDisabled();
    await page.screenshot({
      path: info.outputPath(`black-${group}.png`),
      fullPage: true,
    });
    await page.reload();
    await page.getByLabel("Training colour").selectOption("black");
    await page.getByLabel("Opening", { exact: true }).selectOption(group);
    if (
      !(await page
        .getByLabel("About opening progress")
        .locator("..")
        .evaluate((el) => (el as HTMLDetailsElement).open))
    )
      await page.getByLabel("About opening progress").click();
    await expect(
      page.getByText(`${seeded + 9} attempts saved in this browser.`, {
        exact: true,
      }),
    ).toBeVisible();
    await returnToOpeningOverview(page);
    await expect(
      page.getByRole("button", { name: "Drill this line", exact: true }),
    ).toBeDisabled();
  });
