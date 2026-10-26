import { expect, test } from "@playwright/test";

test("Top 10 opens a rule in its full phase list; boards mount only when expanded", async ({
  page,
}) => {
  await page.goto("/#rules");
  await page.locator(".all-rules > summary").click();
  const top = page.getByTestId("top-rules");
  await expect(top.getByRole("button")).toHaveCount(10);
  await expect(page.getByRole("article")).toHaveCount(42);
  await expect(page.locator("cg-board")).toHaveCount(0);
  await top.getByRole("button").first().click();
  const card = page.getByTestId("rule-cct-scan");
  await expect(card.locator("cg-board")).toBeVisible();
  await expect(card.locator("svg.cg-shapes line")).toHaveCount(2);
  await expect(card.getByText("White to move", { exact: true })).toBeVisible();
  await card.getByRole("button", { name: "Flip board" }).click();
  await expect(card.locator(".cg-wrap")).toHaveClass(/orientation-black/);
  await card.getByRole("button", { name: /^Mark .* as learned$/ }).click();
  await expect(
    card.getByRole("button", { name: /^Mark .* as learned$/ }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await page.locator(".all-rules > summary").click();
  await expect(
    page
      .getByTestId("rule-cct-scan")
      .getByRole("button", { name: /^Mark .* as learned$/ }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("1 / 42 learned", { exact: true })).toBeVisible();
  await page.getByLabel("Phase", { exact: true }).selectOption("middlegame");
  await expect(page.getByRole("article")).toHaveCount(13);
  await page
    .getByTestId("rule-cct-scan")
    .getByRole("button", { name: /^Show example/ })
    .click();
  await expect(
    page.getByTestId("rule-cct-scan").getByText("TOP 1", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Learned state").selectOption("learned");
  await expect(page.getByRole("article")).toHaveCount(1);
  await page.getByLabel("Learned state").selectOption("unlearned");
  await expect(page.getByRole("article")).toHaveCount(12);
});

test("expanded examples honour coordinates and label plans, rays and the side to move", async ({
  page,
}) => {
  await page.goto("/#rules");
  await page.locator(".all-rules > summary").click();
  const card = page.getByTestId("rule-dont-block-breaks");
  await card.getByRole("button", { name: /^Show example/ }).click();
  await expect(card.locator("coords")).toHaveCount(2);
  await expect(
    card.getByText("Plan: Blocked plan: c2-c4", { exact: true }),
  ).toBeVisible();
  await expect(card.locator("svg.cg-shapes circle")).toHaveCount(1);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByText("Board and practice", { exact: true })
    .click();
  await page.getByLabel("Coordinates", { exact: false }).uncheck();
  await expect(card.locator("coords")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Close settings", exact: true })
    .click();
  const black = page.getByTestId("rule-flank-attack-centre-counter");
  await black.getByRole("button", { name: /^Show example/ }).click();
  await expect(black.getByText("Black to move", { exact: true })).toBeVisible();
});

test("a failed learned-rule save can be retried while other rules remain available", async ({
  page,
}) => {
  await page.goto("/#rules");
  await page.locator(".all-rules > summary").click();
  const card = page.getByTestId("rule-cct-scan");
  await expect(
    card.getByRole("button", { name: /^Mark .* as learned$/ }),
  ).toBeEnabled();
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    let fail = true;
    IDBObjectStore.prototype.put = function (
      ...args: Parameters<IDBObjectStore["put"]>
    ) {
      if (this.name === "ruleState" && fail) {
        fail = false;
        throw new DOMException("Test quota failure", "QuotaExceededError");
      }
      return original.apply(this, args);
    };
  });
  await card.getByRole("button", { name: /^Mark .* as learned$/ }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Could not save your learned rule",
  );
  await expect(
    page
      .getByTestId("rule-castle-early")
      .getByRole("button", { name: /^Mark .* as learned$/ }),
  ).toBeEnabled();
  await card.getByRole("button", { name: "Retry save" }).click();
  await expect(
    card.getByRole("button", { name: /^Mark .* as learned$/ }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("rules overview and expanded examples fit desktop and mobile", async ({
  page,
}, info) => {
  await page.goto("/#rules");
  await page.locator(".all-rules > summary").click();
  await expect(page.getByTestId("top-rules").getByRole("button")).toHaveCount(
    10,
  );
  await page.screenshot({ path: info.outputPath("rules-overview.png") });
  const card = page.getByTestId("rule-dont-block-breaks");
  await card.getByRole("button", { name: /^Show example/ }).click();
  await expect(card.locator("cg-board")).toBeVisible();
  await card.scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath("rules-desktop.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await card.scrollIntoViewIfNeeded();
  await expect(card.locator("cg-board")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: info.outputPath("rules-mobile.png") });
});
