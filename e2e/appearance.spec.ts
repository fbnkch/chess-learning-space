import { expect, test } from "@playwright/test";

test("appearance changes immediately, survives reload, and follows the system only when selected", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const appearance = page.getByRole("group", { name: "Appearance mode" });
  await expect(appearance.getByRole("radio", { name: "System", exact: true })).toBeChecked();
  await expect(page.getByRole("radio", { name: "Graphite", exact: true })).toBeChecked();
  await expect(page.locator("main")).toHaveCSS("background-color", "rgb(250, 250, 250)");
  await appearance.getByRole("radio", { name: "Dark", exact: true }).check();
  await page.getByRole("radio", { name: "Forest", exact: true }).check();
  const background = await page.locator("main").evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(background).toBe("rgb(25, 30, 26)");
  await page.reload();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(appearance.getByRole("radio", { name: "Dark", exact: true })).toBeChecked();
  await expect(page.getByRole("radio", { name: "Forest", exact: true })).toBeChecked();
  await page.emulateMedia({ colorScheme: "dark" });
  await page.emulateMedia({ colorScheme: "light" });
  expect(await page.locator("main").evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(background);
  await appearance.getByRole("radio", { name: "System", exact: true }).check();
  await expect(page.locator("main")).toHaveCSS("background-color", "rgb(246, 248, 243)");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("main")).toHaveCSS("background-color", background);
  await page.getByRole("button", { name: "Close settings", exact: true }).click();
  await page.getByRole("link", { name: "Free play", exact: true }).click();
  await expect(page.locator("cg-board")).toBeVisible();
});

test("Windows contrast mode keeps the selected palette identifiable without focus", async ({ page }) => {
  await page.emulateMedia({ forcedColors: "active" });
  await page.goto("/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("radio", { name: "Sand", exact: true }).check();
  await page.getByRole("button", { name: "Close settings", exact: true }).focus();
  const selected = page.locator(".theme-option").filter({
    has: page.getByRole("radio", { name: "Sand", exact: true }),
  });
  await expect(selected).toHaveCSS("outline-style", "solid");
  await expect(selected).toHaveCSS("outline-width", "3px");
});

for (const theme of [
  { name: "Graphite", light: "rgb(250, 250, 250)", dark: "rgb(27, 27, 31)" },
  { name: "Violet", light: "rgb(250, 248, 253)", dark: "rgb(32, 29, 39)" },
  { name: "Forest", light: "rgb(246, 248, 243)", dark: "rgb(25, 30, 26)" },
  { name: "Sand", light: "rgb(251, 247, 239)", dark: "rgb(36, 32, 28)" },
]) {
  for (const mode of ["Light", "Dark"] as const) {
    test(`${theme.name} ${mode} keeps text readable and controls usable on desktop and mobile`, async ({ page }, info) => {
      await page.goto("/");
      await page.getByRole("button", { name: "Settings", exact: true }).click();
      await page.getByRole("radio", { name: mode, exact: true }).check();
      await page.getByRole("radio", { name: theme.name, exact: true }).check();
      await expect(page.locator("main")).toHaveCSS("background-color", theme[mode === "Light" ? "light" : "dark"]);
      const contrast = await page.evaluate(() => {
        const root = getComputedStyle(document.documentElement);
        const color = (token: string) => {
          const probe = document.createElement("span");
          probe.style.color = root.getPropertyValue(token);
          document.body.append(probe);
          const result = getComputedStyle(probe).color;
          probe.remove();
          return result.match(/[\d.]+/g)!.slice(0, 3).map(Number).map((v) => {
            const c = v / 255;
            return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
          }).reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
        };
        const ratio = (a: string, b: string) => {
          const x = color(a), y = color(b);
          return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
        };
        return [
          ...["--surface", "--surface-raised", "--canvas"].flatMap((bg) =>
            ["--text", "--text-muted", "--text-subtle", "--accent", "--success", "--warning", "--danger"].map((fg) => ({ pair: fg + "/" + bg, ratio: ratio(fg, bg) })),
          ),
          { pair: "primary button", ratio: ratio("--on-accent", "--accent") },
          { pair: "light coordinate", ratio: ratio("--square-light", "--coordinate-backdrop") },
          { pair: "dark coordinate", ratio: ratio("--board-ink", "--square-light") },
        ];
      });
      for (const pair of contrast) expect(pair.ratio, pair.pair).toBeGreaterThanOrEqual(4.5);
      for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: 900 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
        const radios = page.getByRole("radio");
        for (const radio of await radios.all()) {
          const bounds = await radio.boundingBox();
          expect(bounds!.height).toBeGreaterThanOrEqual(44);
          expect(bounds!.width).toBeGreaterThanOrEqual(44);
        }
        await page.screenshot({ path: info.outputPath(`appearance-${width}.png`) });
      }
      // Native radio groups keep standard arrow-key navigation.
      await page.getByRole("radio", { name: "Graphite", exact: true }).focus();
      await page.keyboard.press("ArrowRight");
      await expect(page.getByRole("radio", { name: "Violet", exact: true })).toBeChecked();
      await page.getByRole("button", { name: "Close settings", exact: true }).click();
      await page.getByRole("link", { name: "Free play", exact: true }).click();
      await expect(page.locator("cg-board")).toBeVisible();
    });
  }
}
