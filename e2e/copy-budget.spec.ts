import { writeFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

const budgets = {
  home: 180,
  openings: 90,
  puzzles: 90,
  games: 90,
  threats: 90,
  rules: 150,
};
const taglines =
  /your pace\. your next move|calculate\s*�\s*visuali[sz]e\s*�\s*solve|checks\s*�\s*captures\s*�\s*threats|slow down\. see the whole board|a little recall|bring your games to the board|learn the idea, the reason, and the exception/i;

/** Count rendered text, including below the fold, but not native closed disclosures,
 * select menus, decorative content or screen-reader-only labels. No content selectors
 * are excluded: opening a disclosure makes its words count. */
async function visibleCopy(page: Page, firstScreen = false) {
  return page.locator("main").evaluate((main, firstScreen) => {
    const strings: string[] = [];
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode,
        el = node.parentElement;
      if (
        !el ||
        !node.textContent?.trim() ||
        el.closest('script,style,option,.sr-only,[aria-hidden="true"]')
      )
        continue;
      if (!el.checkVisibility({ checkVisibilityCSS: true })) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const rects = [...range.getClientRects()];
      if (
        !rects.some(
          (r) =>
            r.width > 0 &&
            r.height > 0 &&
            (!firstScreen || (r.top < innerHeight && r.bottom > 0)),
        )
      )
        continue;
      strings.push(node.textContent.trim());
    }
    return strings.join(" ").replace(/\s+/g, " ").trim();
  }, firstScreen);
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1280, height: 800 },
]) {
  test(`empty profile copy budgets at ${viewport.width}`, async ({
    browser,
  }, info) => {
    const context = await browser.newContext({
      viewport,
      hasTouch: viewport.width < 901,
    });
    const page = await context.newPage();
    const counts: Record<string, number> = {};
    for (const [route, budget] of Object.entries(budgets)) {
      await page.goto(`/#${route}`);
      await expect(page.locator("h1")).toBeVisible();
      if (route === "home")
        await expect(
          page.getByRole("region", { name: "Welcome", exact: true }),
        ).toBeVisible();
      if (route === "puzzles" || route === "threats")
        await expect(page.locator("cg-board")).toBeVisible();
      if (route === "puzzles")
        await expect(
          page.getByRole("button", { name: /Hint 1/ }),
        ).toBeEnabled();
      await page.evaluate(() => document.fonts.ready);
      const text = await visibleCopy(page);
      const count = text ? text.split(/\s+/).length : 0;
      counts[route] = count;
      expect.soft(count, `${route}: ${text}`).toBeLessThanOrEqual(budget);
      expect.soft(text).not.toMatch(/[\u2013\u2014]/);
      expect.soft(text).not.toMatch(taglines);
      if (route === "home") {
        const first = await visibleCopy(page, true);
        counts.homeFirstScreen = first.split(/\s+/).length;
        expect.soft(counts.homeFirstScreen, first).toBeLessThanOrEqual(60);
      }
    }
    await writeFile(
      info.outputPath("word-counts.json"),
      JSON.stringify(counts, null, 2),
    );
    await info.attach("word-counts", {
      body: JSON.stringify(counts, null, 2),
      contentType: "application/json",
    });
    await context.close();
  });
}

test("help disclosures work with the keyboard and expose their label", async ({
  page,
}) => {
  await page.goto("/#games");
  const help = page.getByLabel("About Chess.com imports", { exact: true });
  await help.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText(/Import public games for/)).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.getByText(/Import public games for/)).not.toBeVisible();
});
