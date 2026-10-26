import { unlockDrill } from "./drill-setup";
import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { schemaVersion } from "../src/progress/Progress";

test.beforeEach(async ({ page }) => {
  // Exercise the browser-download fallback; the file-picker writer is covered separately.
  await page.addInitScript(() => {
    Object.defineProperty(window, "showSaveFilePicker", {
      value: undefined,
      configurable: true,
    });
  });
});

async function move(page: Page, uci: string) {
  const board = page.locator("cg-board");
  await expect(page.getByRole("status")).toHaveText(/Your move.*White/);
  await expect(async () => {
    await board.scrollIntoViewIfNeeded();
  }).toPass();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  const box = await board.boundingBox();
  if (!box) throw new Error("Missing chess board");
  for (const square of [uci.slice(0, 2), uci.slice(2, 4)]) {
    await page.mouse.click(
      box.x + ((square.charCodeAt(0) - 96.5) * box.width) / 8,
      box.y + ((8.5 - Number(square[1])) * box.height) / 8,
    );
  }
}

test("drill, export, clear browser storage, import snapshot and rebuild due cards", async ({
  page,
}, info) => {
  const seeded = await unlockDrill(page);
  await page.goto("/#openings");
  await page.getByRole("button", { name: "Drill due cards" }).click();
  await move(page, "e2e4");
  await page.getByRole("button", { name: "Next card", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Your move - White");
  await move(page, "g1f3");
  await page.getByRole("button", { name: "Next card", exact: true }).click();
  if (
    !(await page
      .getByLabel("About opening progress")
      .locator("..")
      .evaluate((el) => (el as HTMLDetailsElement).open))
  )
    await page.getByLabel("About opening progress").click();
  await expect(
    page.getByText(`${seeded + 2} attempts saved in this browser.`, {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText("22 cards due", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByText("Backup and storage", { exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByText("Board and practice", { exact: true })
    .click();
  await page.getByLabel("Sound", { exact: false }).uncheck();
  const exported = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON" }).click();
  const download = await exported;
  const path = info.outputPath("progress.json");
  await download.saveAs(path);
  const json = JSON.parse(await readFile(path, "utf8"));
  expect(json.data.reviewLog).toHaveLength(seeded + 2);
  expect(json.data).not.toHaveProperty("secrets");
  await expect(page.getByText(/Last export:/)).not.toHaveText(
    "Last export: Never",
  );
  await page.goto("/e2e/fixtures/board.html");
  await page.evaluate(async () => {
    localStorage.clear();
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase("chess-learning-space");
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("Storage is blocked"));
    });
  });
  await page.goto("/#openings");
  await expect(page.getByText("0 cards due", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByText("Backup and storage", { exact: true })
    .click();
  await page.getByLabel("Import JSON", { exact: true }).setInputFiles(path);
  await expect(
    page.getByRole("heading", { name: `Import ${seeded + 2} review attempts` }),
  ).toBeVisible();
  const snapshot = page.waitForEvent("download");
  await expect(page.getByLabel("Import choices")).toBeFocused();
  await page.getByRole("button", { name: "Replace", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Replace current progress?" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Undo last import" }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Confirm replace", exact: true })
    .click();
  const before = await snapshot;
  expect(before.suggestedFilename()).toBe(
    "chess-learning-space-before-import.json",
  );
  await before.saveAs(info.outputPath("before-import.json"));
  await expect(
    page.getByText(/Import complete. Undo last import is available/),
  ).toBeVisible();
  if (
    !(await page
      .getByRole("dialog")
      .getByText("Board and practice", { exact: true })
      .locator("..")
      .evaluate((el) => (el as HTMLDetailsElement).open))
  )
    await page
      .getByRole("dialog")
      .getByText("Board and practice", { exact: true })
      .click();
  await expect(page.getByLabel("Sound", { exact: false })).not.toBeChecked();
  await page.screenshot({
    path: info.outputPath("backup-settings.png"),
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  if (
    !(await page
      .getByLabel("About opening progress")
      .locator("..")
      .evaluate((el) => (el as HTMLDetailsElement).open))
  )
    await page.getByLabel("About opening progress").click();
  await expect(
    page.getByText(`${seeded + 2} attempts saved in this browser.`, {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText("22 cards due", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("22 cards due", { exact: true })).toBeVisible();
});

test("invalid import has no choice buttons and preserves progress", async ({
  page,
}) => {
  await page.goto("/#free-play");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByText("Backup and storage", { exact: true })
    .click();
  await page.getByLabel("Import JSON", { exact: true }).setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from("{"),
  });
  await expect(page.getByRole("alert")).toHaveText(
    "This file is not valid JSON. Nothing was changed.",
  );
  await expect(
    page.getByRole("button", { name: "Replace", exact: true }),
  ).toHaveCount(0);
});

test("database versionchange closes the old connection and asks the learner to reload", async ({
  page,
  context,
}) => {
  await page.goto("/#free-play");
  await expect(
    page.getByText("Openings: 0 cards due", { exact: true }),
  ).toBeVisible();
  const other = await context.newPage();
  await other.goto("/e2e/fixtures/board.html");
  await other.evaluate(async (version) => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("chess-learning-space", version);
      request.onsuccess = () => {
        request.result.close();
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }, schemaVersion + 1);
  await expect(page.getByRole("alert")).toHaveText(
    "Progress was upgraded in another tab. Reload this page to continue.",
  );
});

test("Replace requires confirmation and Undo survives a reload", async ({
  page,
}) => {
  await unlockDrill(page);
  await page.goto("/#openings");
  await page.getByRole("button", { name: "Drill due cards" }).click();
  await move(page, "e2e4");
  await page.getByRole("button", { name: "Next card", exact: true }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByText("Backup and storage", { exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByText("Board and practice", { exact: true })
    .click();
  await page.getByLabel("Sound", { exact: false }).uncheck();
  const before = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open("chess-learning-space");
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    const tx = db.transaction(["reviewLog", "metadata", "settings"]);
    const data = await Promise.all(
      ["reviewLog", "metadata", "settings"].map(
        (name) =>
          new Promise<unknown[]>((resolve, reject) => {
            const r = tx.objectStore(name).getAll();
            r.onsuccess = () => resolve(r.result);
            r.onerror = () => reject(r.error);
          }),
      ),
    );
    db.close();
    return data;
  });
  await page.getByLabel("Import JSON", { exact: true }).setInputFiles({
    name: "empty.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        format: "chess-learning-space",
        schemaVersion: 4,
        appVersion: "1",
        contentVersions: {},
        exportedAt: new Date().toISOString(),
        data: { reviewLog: [], metadata: [], settings: [] },
      }),
    ),
  });
  await page.getByRole("button", { name: "Replace", exact: true }).click();
  await page.getByRole("button", { name: "Keep current data" }).click();
  await expect(
    page.getByRole("button", { name: "Undo last import" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Replace", exact: true }).click();
  await page
    .getByRole("button", { name: "Confirm replace", exact: true })
    .click();
  await expect(
    page.getByText(/Import complete. Undo last import/),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByText("Backup and storage", { exact: true })
    .click();
  page.once("dialog", (dialog) => {
    expect(dialog.message()).toMatch(/^Undo the import from /);
    void dialog.accept();
  });
  await page.getByRole("button", { name: "Undo last import" }).click();
  await expect(page.getByText(/Import undone/)).toBeVisible();
  const after = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open("chess-learning-space");
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    const tx = db.transaction(["reviewLog", "metadata", "settings"]);
    const data = await Promise.all(
      ["reviewLog", "metadata", "settings"].map(
        (name) =>
          new Promise<unknown[]>((resolve, reject) => {
            const r = tx.objectStore(name).getAll();
            r.onsuccess = () => resolve(r.result);
            r.onerror = () => reject(r.error);
          }),
      ),
    );
    db.close();
    return data;
  });
  expect(after).toEqual([
    before[0],
    [
      ...before[1],
      { key: "sync:dataEpoch", value: 2 },
      { key: "sync:paused", value: 0 },
    ],
    before[2],
  ]);
  if (
    !(await page
      .getByRole("dialog")
      .getByText("Board and practice", { exact: true })
      .locator("..")
      .evaluate((el) => (el as HTMLDetailsElement).open))
  )
    await page
      .getByRole("dialog")
      .getByText("Board and practice", { exact: true })
      .click();
  await expect(page.getByLabel("Sound", { exact: false })).not.toBeChecked();
});
