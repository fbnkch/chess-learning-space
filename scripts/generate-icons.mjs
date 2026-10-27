import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

// One source for browser, iOS and installed-app artwork. No runtime dependency.
const source = new URL("../public/assets/icon-v2.svg", import.meta.url);
const tokens = await readFile(
  new URL("../src/appearance.css", import.meta.url),
  "utf8",
);
const accent = tokens.match(/--accent:\s*(#[a-f\d]{6})/i)?.[1];
if (!accent) throw new Error("Missing semantic accent token");
const svg = (await readFile(source, "utf8"))
  .replace(/^\uFEFF/, "")
  .trim()
  .replace(/(<path\b[^>]*\bfill=")[^"]+/g, `$1${accent}`)
  .replace(/(<path\b[^>]*\bstroke=")[^"]+/g, `$1${accent}`);
await writeFile(source, svg + "\n");
await mkdir(new URL("../public/assets/", import.meta.url), { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const size of [180, 192, 512]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<style>html,body{margin:0;width:100%;height:100%}svg{display:block;width:100%;height:100%}</style>${svg}`,
    );
    await page.screenshot({
      path: fileURLToPath(
        new URL(`../public/assets/icon-v2-${size}.png`, import.meta.url),
      ),
    });
  }
} finally {
  await browser.close();
}
