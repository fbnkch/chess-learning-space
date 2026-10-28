import { returnToOpeningOverview } from "./opening-move";
import { expect, test } from "@playwright/test";
import { unlockDrill } from "./drill-setup";

test("first run builds a persistent plan with the chosen opening and backup guidance", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Home", exact: true }),
  ).toBeVisible();
  const welcome = page.getByRole("region", { name: "Welcome", exact: true });
  await expect(welcome).toBeVisible();
  await welcome.getByText("Where is my data?", { exact: true }).click();
  await expect(welcome).toContainText("export a backup in Settings");
  await page.getByLabel("Starting opening").selectOption("caro");
  await page.getByRole("button", { name: "Choose this opening" }).click();
  await expect(welcome).toHaveCount(0);
  const resume = page.getByRole("region", { name: "Where you left off" });
  await expect(
    resume.getByRole("link", { name: "Classical: Nc3" }).first(),
  ).toHaveAttribute("href", "#openings?line=caro-classical&start=1");
  await page.reload();
  await expect(welcome).toHaveCount(0);
  await resume.getByRole("link", { name: "Classical: Nc3" }).first().click();
  await expect(page.getByLabel("Opening", { exact: true })).toHaveValue("caro");
});

test("weekly external work survives a gap and resets only on request; offline is non-blocking", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Choose this opening" }).click();
  await page
    .getByLabel("Weekly plan", { exact: true })
    .locator("summary")
    .first()
    .click();
  const play = page.getByLabel("Completed this week's play on chess.com");
  await play.check();
  await page.clock.install({ time: new Date() });
  await page.clock.setSystemTime(new Date(Date.now() + 14 * 86400000));
  await page.reload();
  await page
    .getByLabel("Weekly plan", { exact: true })
    .locator("summary")
    .first()
    .click();
  await expect(play).toBeChecked();
  await page.getByRole("button", { name: "Start next flexible week" }).click();
  await expect(play).not.toBeChecked();
  await context.setOffline(true);
  await expect(page.getByRole("status")).toContainText("You are offline");
  await page.getByRole("link", { name: "Free play", exact: true }).click();
  await expect(page.locator("cg-board")).toBeVisible();
});

test("existing progress skips welcome and prioritises due openings with working navigation", async ({
  page,
}) => {
  await unlockDrill(page);
  await page.goto("/");
  await expect(
    page.getByRole("region", { name: "Welcome", exact: true }),
  ).toHaveCount(0);
  const today = page.getByRole("region", { name: "Today", exact: true });
  const recommended = today.getByRole("region", { name: "Recommended next step" });
  await expect(recommended).toContainText("Recall due moves first");
  await expect(recommended.getByRole("link", { name: "Review due moves" })).toHaveAttribute(
    "href", /^#openings\?line=[^&]+&start=1&scope=group$/,
  );
  await today
    .getByRole("link", { name: "Review due moves" })
    .click();
  await expect(page.getByLabel("Opening", { exact: true })).toHaveValue(
    "sidelines",
  );
  await expect(page.getByText("88 cards due", { exact: true })).toBeVisible();
  await returnToOpeningOverview(page);
  await expect(
    page.getByRole("button", { name: "Drill due cards", exact: true }),
  ).toBeEnabled();
});
