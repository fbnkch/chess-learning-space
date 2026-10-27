import { expect, test } from "@playwright/test";
import { goldenRules } from "../src/rules/catalogue";

for (const viewport of [
  { width: 390, height: 844 },
  { width: 820, height: 1180 },
]) {
  test(`compact navigation reaches every section in two taps at ${viewport.width}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({ viewport, hasTouch: true });
    const page = await context.newPage();
    await page.goto("/");
    const tabs = page.getByRole("navigation", { name: "Compact navigation" });
    await expect(tabs).toBeVisible();
    for (const label of ["Home", "Openings", "Tactics", "Games", "Rules"]) {
      await tabs.getByRole("link", { name: label, exact: true }).click();
      await expect(tabs).toBeInViewport();
      await expect(
        tabs.getByRole("link", { name: label, exact: true }),
      ).toHaveAttribute("aria-current", "page");
    }
    await tabs.getByRole("link", { name: "Tactics", exact: true }).click();
    await page
      .getByRole("navigation", { name: "Tactics modes" })
      .getByRole("link", { name: "Threat Scan", exact: true })
      .click();
    await expect(page).toHaveURL(/#threats$/);
    await expect(
      tabs.getByRole("link", { name: "Tactics", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await tabs.getByRole("link", { name: "Home", exact: true }).click();
    await page
      .getByRole("navigation", { name: "Home actions" })
      .getByRole("link", { name: "Free play", exact: true })
      .click();
    await expect(page.locator("cg-board")).toBeVisible();
    await expect(tabs).toBeInViewport();
    await tabs.getByRole("link", { name: "Home", exact: true }).click();
    await page
      .getByRole("navigation", { name: "Home actions" })
      .getByRole("button", { name: "Settings", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await context.close();
  });
}

const sizes = [
  { width: 390, height: 844 },
  { width: 820, height: 1180 },
  { width: 1280, height: 800 },
];
const routes = [
  "home",
  "openings",
  "puzzles",
  "threats",
  "games",
  "rules",
  "rules-quiz",
  "free-play",
];

async function assertDesign(
  page: import("@playwright/test").Page,
  minimum: number,
) {
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
    )
    .toBeLessThanOrEqual(1);
  const failures = await page.evaluate((minimum) => {
    const visible = (el: Element) =>
      el.getClientRects().length > 0 &&
      getComputedStyle(el).visibility !== "hidden" &&
      !el.closest(".sr-only");
    const small: string[] = [];
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
    );
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const el = node.parentElement;
      if (
        node.textContent?.trim() &&
        el &&
        !el.closest("script,style") &&
        visible(el) &&
        parseFloat(getComputedStyle(el).fontSize) < 12
      )
        small.push(
          `${node.textContent.trim().slice(0, 60)}: ${getComputedStyle(el).fontSize}`,
        );
    }
    const targets = [...document.querySelectorAll("a,button,input,select")]
      .filter((el) => visible(el) && !el.closest("cg-board,.cg-wrap"))
      .filter((el) => el.getBoundingClientRect().height < minimum - 0.1)
      .map(
        (el) =>
          `${el.tagName} ${el.getAttribute("aria-label") ?? el.textContent?.trim().slice(0, 60)}: ${el.getBoundingClientRect().height}`,
      );
    const clipped = [...document.querySelectorAll(".compact-tabs a span")]
      .filter((el) => el.scrollWidth > el.clientWidth + 1)
      .map((el) => el.textContent);
    return { small, targets, clipped };
  }, minimum);
  expect(failures.clipped, "tab labels must wrap without clipping").toEqual([]);
  expect(failures.small, "visible text below 12px").toEqual([]);
  expect(failures.targets, `hit regions below ${minimum}px`).toEqual([]);
}

for (const viewport of sizes) {
  test(`design foundations and screenshots at ${viewport.width}`, async ({
    browser,
  }, info) => {
    test.setTimeout(120_000);
    const context = await browser.newContext({
      viewport,
      hasTouch: viewport.width <= 900,
    });
    const page = await context.newPage();
    const minimum = viewport.width <= 900 ? 44 : 28;
    for (const route of routes) {
      await page.goto(`/#${route}`);
      await expect(page.locator("h1")).toBeVisible();
      if (route === "home")
        await expect(
          page.getByRole("region", { name: "Today", exact: true }),
        ).toBeVisible();
      await expect(
        page.getByRole("navigation", { name: "Compact navigation" }),
      ).toBeVisible({ visible: viewport.width <= 900 });
      await expect(
        page.getByRole("navigation", { name: "Main navigation" }),
      ).toBeVisible({ visible: viewport.width >= 901 });
      if (route === "puzzles" || route === "threats")
        await expect(page.locator("cg-board").first()).toBeVisible();
      await assertDesign(page, minimum);
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({
        path: info.outputPath(`${route}-${viewport.width}.png`),
        fullPage: false,
      });
      const options = page.locator(".training-options");
      if (
        viewport.width <= 900 &&
        (await options.count()) &&
        (await options.getAttribute("open")) === null
      ) {
        await options.locator(":scope > summary").click();
        await assertDesign(page, minimum);
        await options.locator(":scope > summary").click();
      }
      if (route === "home") {
        await page
          .getByRole("button", { name: "Build my plan", exact: true })
          .click();
        await expect(
          page.getByRole("region", { name: "Welcome", exact: true }),
        ).toHaveCount(0);
        await assertDesign(page, minimum);
        await page.evaluate(() => scrollTo(0, 0));
        await page.screenshot({
          path: info.outputPath(`home-plan-${viewport.width}.png`),
        });
        for (const name of ["Weekly plan", "Progress dashboard"]) {
          const details = page.getByLabel(name, { exact: true });
          if (!((await details.getAttribute("open")) === ""))
            await details.locator("summary").click();
        }
        await assertDesign(page, minimum);
      }
      if (route === "openings") {
        await page
          .getByRole("button", { name: "Continue training", exact: true })
          .click();
        await expect(page.locator("cg-board").first()).toBeVisible();
        await assertDesign(page, minimum);
        await page
          .locator("cg-board")
          .first()
          .evaluate((el) => el.scrollIntoView({ block: "start" }));
        await page.screenshot({
          path: info.outputPath(`openings-learn-${viewport.width}.png`),
        });
      }
    }
    await page.goto("/#games");
    await page
      .getByLabel("One or more games")
      .fill(
        '[White "fbnkch"]\n[Black "Design opponent"]\n[Result "1-0"]\n\n1. e4 e5 2. Nf3 Nc6 1-0',
      );
    await page.getByRole("button", { name: "Import PGN", exact: true }).click();
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({
      path: info.outputPath(`games-populated-${viewport.width}.png`),
    });
    await page.getByRole("button", { name: /Review game/ }).click();
    await expect(
      page.getByRole("heading", { name: "Game Review", exact: true }),
    ).toBeVisible();
    await assertDesign(page, minimum);
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({
      path: info.outputPath(`review-${viewport.width}.png`),
    });
    await page
      .locator("cg-board")
      .first()
      .evaluate((el) => el.scrollIntoView({ block: "start" }));
    await page.screenshot({
      path: info.outputPath(`review-board-${viewport.width}.png`),
    });
    await page.goto("/#home");
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await assertDesign(page, minimum);
    await page.screenshot({
      path: info.outputPath(`settings-${viewport.width}.png`),
    });
    await page
      .getByRole("button", { name: "Close settings", exact: true })
      .click();
    const { unlockDrill } = await import("./drill-setup");
    await unlockDrill(page);
    await page.goto("/#home");
    await expect(
      page.getByRole("region", { name: "Today", exact: true }),
    ).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: info.outputPath(`home-populated-${viewport.width}.png`),
    });
    await page.goto("/#openings");
    await page
      .getByRole("button", { name: "Drill this line", exact: true })
      .click();
    await expect(page.getByRole("status")).toHaveText(/Your move/);
    await assertDesign(page, minimum);
    await page
      .locator("cg-board")
      .first()
      .evaluate((el) => el.scrollIntoView({ block: "start" }));
    await page.screenshot({
      path: info.outputPath(`openings-drill-${viewport.width}.png`),
    });
    await context.close();
  });
}

test("320px layout survives doubled text size", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 320, height: 844 },
    hasTouch: true,
  });
  const page = await context.newPage();
  for (const route of routes) {
    await page.goto(`/#${route}`);
    await expect(page.locator("h1")).toBeVisible();
    // Doubling the root font exercises browser text scaling while the viewport
    // remains at the requested narrow CSS width (stricter than zooming 640px).
    await page.addStyleTag({ content: ":root { font-size: 200%; }" });
    await assertDesign(page, 44);
    await page.screenshot({
      path: `test-results/design-text-200-${route}-320.png`,
    });
  }
  await context.close();
});

for (const viewport of sizes.slice(0, 2)) {
  test(`board modes remain usable at ${viewport.width}`, async ({
    browser,
  }, info) => {
    test.setTimeout(120_000);
    const context = await browser.newContext({ viewport, hasTouch: true });
    const page = await context.newPage();
    const { unlockDrill } = await import("./drill-setup");
    await unlockDrill(page);
    for (const [mode, button] of [
      ["practice", "Practice whole line"],
      ["drill", "Drill this line"],
    ]) {
      await page.goto("/#home");
      await expect(
        page.getByRole("heading", { name: "Home", exact: true }),
      ).toBeVisible();
      await page.goto("/#openings");
      await page.getByRole("button", { name: button, exact: true }).click();
      await expect(page.locator("cg-board").first()).toBeVisible();
      await assertDesign(page, 44);
      const board = page.locator("cg-board").first();
      await expect
        .poll(() =>
          page
            .locator(".board-frame")
            .first()
            .evaluate((el) => el.getBoundingClientRect().width),
        )
        .toBe(viewport.width - 24);
      // Chessground snaps its inner board down to whole device-pixel squares.
      await expect
        .poll(() => board.evaluate((el) => el.getBoundingClientRect().width))
        .toBeGreaterThan(viewport.width - 32);
      await board.scrollIntoViewIfNeeded();
      await page.screenshot({
        path: info.outputPath(`openings-${mode}-${viewport.width}.png`),
      });
      await expect(
        page.getByRole("navigation", { name: "Compact navigation" }),
      ).toBeInViewport();
    }
    await page.goto("/#free-play");
    for (const orientation of ["white", "black"]) {
      if (orientation === "black")
        await page.getByRole("button", { name: "Flip board" }).click();
      await page.locator("cg-board").scrollIntoViewIfNeeded();
      await page.locator(".board-frame").screenshot({
        path: info.outputPath(
          `coordinates-${orientation}-${viewport.width}.png`,
        ),
      });
      const colors = await page
        .locator("coord")
        .evaluateAll((nodes) => [
          ...new Set(nodes.map((el) => getComputedStyle(el).color)),
        ]);
      expect(colors.sort()).toEqual(
        ["rgb(228, 228, 231)", "rgb(39, 39, 42)"].sort(),
      );
      await assertDesign(page, 44);
    }
    await context.close();
  });
}

test("rules omit empty exceptions and preserve authored exceptions", async ({
  page,
}) => {
  await page.goto("/#rules");
  await page.locator(".all-rules > summary").click();
  for (const rule of goldenRules.filter((entry) => !entry.exception)) {
    const card = page.getByTestId(`rule-${rule.id}`);
    await card.getByRole("button", { name: /Show example/ }).click();
    await expect(card.locator(".rule-reason").first()).toHaveText(rule.reason);
    await expect(card.locator(".rule-exception")).toHaveCount(0);
  }
  const rule = goldenRules.find((entry) => entry.exception)!;
  const card = page.getByTestId(`rule-${rule.id}`);
  await card.getByRole("button", { name: /Show example/ }).click();
  await expect(card.locator(".rule-exception")).toHaveText(
    `Exception: ${rule.exception}`,
  );
  const emptyRule = goldenRules.find((entry) => !entry.exception)!;
  await page.goto("/#rules-quiz");
  await page.getByLabel("Quiz rules").selectOption(emptyRule.id);
  await page
    .getByRole("button", { name: emptyRule.shortForm, exact: true })
    .click();
  const feedback = page.locator(".quiz-feedback");
  await expect(feedback).toContainText(emptyRule.reason);
  await expect(feedback).not.toContainText("Exception:");
});
