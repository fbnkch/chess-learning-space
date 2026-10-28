import { returnToOpeningOverview } from "./opening-move";
import { unlockDrill } from "./drill-setup";
import { expect, test, type Page } from "@playwright/test";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { compileSide } from "../src/repertoire/compiler";
import { Repertoire } from "../src/repertoire/Repertoire";
import { repertoirePositions, type Mark } from "../src/threats/scan";

const graph = (side: "white" | "black") => {
  const dir = `content/${side}`;
  return compileSide(
    existsSync(dir)
      ? readdirSync(dir)
          .filter((f) => f.endsWith(".pgn"))
          .sort()
          .map((f) => readFileSync(`${dir}/${f}`, "utf8"))
      : [],
    side,
  );
};
const repertoire = new Repertoire({
  white: graph("white"),
  black: graph("black"),
});
const first = repertoirePositions(repertoire, "scan")[0];
async function point(page: Page, square: string) {
  const board = page.locator("cg-board");
  await board.scrollIntoViewIfNeeded();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  const box = (await board.boundingBox())!;
  const black = await page
    .locator(".cg-wrap")
    .evaluate((element) => element.classList.contains("orientation-black"));
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]) - 1;
  return {
    x: box.x + (((black ? 7 - file : file) + 0.5) * box.width) / 8,
    y: box.y + (((black ? rank : 7 - rank) + 0.5) * box.height) / 8,
  };
}
async function mark(page: Page, item: Mark) {
  if (item.kind === "square") {
    const p = await point(page, item.square);
    await page.mouse.click(p.x, p.y);
  } else {
    const a = await point(page, item.from),
      b = await point(page, item.to);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down({ button: "right" });
    await page.mouse.move(b.x, b.y, { steps: 12 });
    await page.mouse.up({ button: "right" });
  }
}
async function move(page: Page, uci: string) {
  for (const square of [uci.slice(0, 2), uci.slice(2, 4)]) {
    const p = await point(page, square);
    await page.mouse.click(p.x, p.y);
  }
}
async function scanLog(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const req = indexedDB.open("chess-learning-space");
      req.onsuccess = () => resolve(req.result);
    });
    const rows = await new Promise<unknown[]>((resolve) => {
      const req = db.transaction("scanLog").objectStore("scanLog").getAll();
      req.onsuccess = () => resolve(req.result);
    });
    db.close();
    return rows;
  });
}

test("first Threat Scan render starts at its target without piece animation", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const animated: string[] = [];
    Object.assign(window, { initialPieceAnimations: animated });
    new MutationObserver((records) => {
      for (const record of records) {
        const element = record.target;
        if (
          element instanceof Element &&
          element.tagName.toLowerCase() === "piece" &&
          (element.classList.contains("anim") ||
            /(?:^| )anim(?: |$)/.test(record.oldValue ?? ""))
        )
          animated.push(element.className);
      }
      document
        .querySelectorAll("piece.anim")
        .forEach((piece) => animated.push(piece.className));
    }).observe(document, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class"],
      attributeOldValue: true,
    });
  });
  await page.goto("/#threats");
  await expect(
    page.getByRole("button", { name: "Check", exact: true }),
  ).toBeEnabled();
  // Observe the complete default animation window, not just its final frame.
  await page.waitForTimeout(600);
  expect(
    await page.evaluate(() => Reflect.get(window, "initialPieceAnimations")),
  ).toEqual([]);
  await expect(page.locator("piece.anim")).toHaveCount(0);
  await page.screenshot({
    path: "test-results/threat-scan-initial.png",
    fullPage: true,
  });
});

test("scan passes using real arrows and clicked hanging squares, Undo works, and reload keeps scanLog", async ({
  page,
}) => {
  await page.goto("/#threats");
  await expect(
    page.getByRole("heading", { name: "Threat Scan", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Check", exact: true }),
  ).toBeEnabled();
  await mark(page, { kind: "square", square: "a1" });
  await page.getByRole("button", { name: "Undo mark" }).click();
  await expect(
    page.getByText(`0 marks · ${first.required.length} required`, {
      exact: true,
    }),
  ).toBeVisible();
  for (const item of first.required) await mark(page, item);
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Scan passed" }),
  ).toBeVisible();
  await expect(page.getByText("Attempt saved", { exact: true })).toBeVisible();
  expect(await scanLog(page)).toEqual([
    expect.objectContaining({
      required: first.required.length,
      found: first.required.length,
      wrong: 0,
      mode: "scan",
    }),
  ]);
  await page.reload();
  await expect(page.getByText("1 scan saved", { exact: true })).toBeVisible();
  expect(await scanLog(page)).toHaveLength(1);
});

test("a missed arrow is drawn in mint with exact recall and a legend", async ({
  page,
}) => {
  await page.goto("/#threats");
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Keep scanning" }),
  ).toBeVisible();
  await expect(
    page.getByText(`Recall: 0/${first.required.length} (0%) · 0 wrong`),
  ).toBeVisible();
  await expect(
    page.locator('svg line[stroke="#27efc0"]').first(),
  ).toBeVisible();
  await expect(
    page.getByText("Mint: missed arrows / hanging squares"),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/threat-scan-missed.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Position 2 /", { exact: false })).toBeVisible();
});

test("What changed animates a move, counts down, and automatically records at timeout", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/#threats");
  await page.getByLabel("Scan mode").selectOption("changed");
  await expect(page.getByRole("timer")).toContainText("Watch the opponent");
  await expect(
    page.getByRole("button", { name: "Check", exact: true }),
  ).toBeDisabled();
  await page.clock.fastForward(700);
  await expect(page.getByRole("timer")).toHaveText("30s");
  await expect(page.locator("square.last-move")).toHaveCount(2);
  await page.clock.fastForward(31000);
  await expect(
    page.getByRole("heading", { name: "Keep scanning" }),
  ).toBeVisible();
  await expect(page.getByText("Attempt saved", { exact: true })).toBeVisible();
  expect(await scanLog(page)).toEqual([
    expect.objectContaining({ mode: "changed", found: 0 }),
  ]);
});

test("Safety Check toggle pauses before grading, Take back cancels, and Practice is uninterrupted", async ({
  page,
}) => {
  await unlockDrill(page);
  await page.goto("/#openings");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByText("Board and practice", { exact: true })
    .click();
  await page.getByRole("checkbox", { name: /Safety Check/ }).check();
  await page.getByRole("button", { name: "Close settings" }).click();
  await returnToOpeningOverview(page);
  await page
    .getByRole("button", { name: "Drill this line", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Your move");
  await move(page, "d2d4");
  await expect(
    page.getByRole("heading", { name: "Is my move safe?" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Play e4", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Take back", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Is my move safe?" }),
  ).toHaveCount(0);
  await move(page, "e2e4");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Well played" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next card", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Your move");
  await returnToOpeningOverview(page);
  await page
    .getByRole("button", { name: "Practice whole line", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Your move");
  await move(page, "e2e4");
  await expect(
    page.getByRole("heading", { name: "Well played" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Is my move safe?" }),
  ).toHaveCount(0);
});

test("disabled Safety Check appears once after a failure, and never grades its own response", async ({
  page,
}) => {
  const seeded = await unlockDrill(page);
  await page.goto("/#openings");
  await returnToOpeningOverview(page);
  await page
    .getByRole("button", { name: "Drill this line", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Your move");
  await move(page, "d2d4");
  await expect(
    page.getByRole("heading", { name: "Is my move safe?" }),
  ).toBeVisible();
  await expect(
    page.getByText("Recorded: again", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await move(page, "a2a3");
  await expect(
    page.getByText("Recorded: again", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Is my move safe?" }),
  ).toHaveCount(0);
  await page.getByLabel("About opening progress").click();
  await expect(
    page.getByText(`${seeded + 2} attempts saved in this browser.`, {
      exact: true,
    }),
  ).toBeVisible();
});
