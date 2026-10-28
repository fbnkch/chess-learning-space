import { expect, test } from "@playwright/test";
import { unlockDrill } from "./drill-setup";
import { openingMove as move, returnToOpeningOverview } from "./opening-move";

test("learn all fifteen plies with ideas, then step back and restart", async ({
  page,
}) => {
  await page.goto("/#openings");
  await returnToOpeningOverview(page);
  await page.getByRole("button", { name: "Learn", exact: true }).click();
  await expect(
    page.getByText("White move 0 / 8 | Ply 0 / 15", { exact: true }),
  ).toBeVisible();
  for (let ply = 1; ply <= 15; ply++) {
    await page.getByRole("button", { name: "Next opening move" }).click();
    await expect(
      page.getByText(`White move ${Math.ceil(ply / 2)} / 8 | Ply ${ply} / 15`, {
        exact: true,
      }),
    ).toBeVisible();
  }
  await expect(
    page.getByText(
      "Retreat before ...b5 or ...Na5, keeping pressure on the a2-g8 diagonal.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Next opening move" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Previous opening move" }).click();
  await expect(
    page.getByText(
      "Black prepares ...b5 and an a7 retreat for Bc5; automatic h3 gives ...h6/...g5 a pawn-attack hook.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Restart lesson" }).click();
  await expect(
    page.getByText("White move 0 / 8 | Ply 0 / 15", { exact: true }),
  ).toBeVisible();
});

test("drill with wrong move and retry, locked preludes, and durable progress after reload", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const seeded = await unlockDrill(page);
  await page.goto("/#free-play");
  await expect(
    page.getByText("Openings: 264 cards due", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: /Openings 264/ }).click();
  await returnToOpeningOverview(page);
  await page
    .getByRole("button", { name: "Drill this line", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Your move - White");
  await move(page, "d2d4");
  await expect(
    page.getByRole("heading", { name: "Play e4", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Recorded: again", { exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.locator("cg-board").evaluate((board) => {
        const box = board.getBoundingClientRect();
        return [...board.querySelectorAll("piece.white.pawn:not(.ghost)")].some(
          (piece) => {
            const rect = piece.getBoundingClientRect();
            return (
              Math.abs(
                rect.x + rect.width / 2 - (box.x + (3.5 * box.width) / 8),
              ) < 2 &&
              Math.abs(
                rect.y + rect.height / 2 - (box.y + (6.5 * box.height) / 8),
              ) < 2
            );
          },
        );
      }),
    )
    .toBe(true);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  // Retry directly on the board while the solution stays visible.
  const moves = [
    "e2e4",
    "g1f3",
    "f1c4",
    "c2c3",
    "d2d3",
    "e1g1",
    "f1e1",
    "c4b3",
  ];
  moves.push("e2e4"); // Failed card is requeued at the end of this session.
  for (let index = 0; index < moves.length; index++) {
    await expect(page.getByRole("status")).toHaveText(
      index === 0 ? "Try again" : "Your move - White",
    );
    await move(page, moves[index]);
    await expect(page.getByRole("status")).toHaveText("Correct");
    await expect(
      page.getByText("Clean move - choose Good or Easy.", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Next card", exact: true }).click();
    if (index < moves.length - 2) {
      await expect(page.getByRole("status")).toHaveText(
        "Playing the prelude… Input is locked.",
      );
      // A pawn move during the prelude must not turn into a learner attempt.
      await move(page, "d2d4");
    }
  }
  await expect(page.getByRole("status")).toHaveText("Session complete");
  await expect(page.getByText("16 cards due", { exact: true })).toBeVisible();
  await returnToOpeningOverview(page);
  await expect(
    page.getByRole("button", { name: "Drill this line", exact: true }),
  ).toBeDisabled();
  if (
    !(await page
      .getByLabel("About opening progress")
      .locator("..")
      .evaluate((el) => (el as HTMLDetailsElement).open))
  )
    await page.getByLabel("About opening progress").click();
  await expect(
    page.getByText(`${seeded + 10} attempts saved in this browser.`, {
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByText("16 cards due", { exact: true })).toBeVisible();
  if (
    !(await page
      .getByLabel("About opening progress")
      .locator("..")
      .evaluate((el) => (el as HTMLDetailsElement).open))
  )
    await page.getByLabel("About opening progress").click();
  await expect(
    page.getByText(`${seeded + 10} attempts saved in this browser.`, {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByText("Board and practice", { exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByText("Backup and storage", { exact: true })
    .click();
  await expect(
    page.getByText(/Progress storage: (persistent|best-effort)/),
  ).toBeVisible();
});

test("learn shows idea arrows, numbered moves, current side and keyboard navigation", async ({
  page,
}, testInfo) => {
  await page.goto("/#openings");
  await returnToOpeningOverview(page);
  await page.getByRole("button", { name: "Learn", exact: true }).click();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("heading", { name: "1. e4", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("BLACK TO MOVE", { exact: true })).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("heading", { name: "1... e5", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("WHITE TO MOVE", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "3. Bc4", exact: true }).click();
  await expect(page.locator("svg.cg-shapes line")).toHaveCount(1);
  await page.screenshot({
    path: testInfo.outputPath("italian-learn.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "4. c3", exact: true }).click();
  await expect(page.locator("svg.cg-shapes line")).toHaveCount(2);
  await page.keyboard.press("ArrowDown");
  await expect(
    page.getByRole("heading", { name: "8. Bb3", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("ArrowUp");
  await expect(
    page.getByText("White move 0 / 8 | Ply 0 / 15", { exact: true }),
  ).toBeVisible();
});
test("whole-line practice preserve due scheduling across reload and settings rerenders", async ({
  page,
}) => {
  const seeded = await unlockDrill(page);
  await page.goto("/#openings");
  await returnToOpeningOverview(page);
  await page.getByRole("button", { name: "Practice whole line" }).click();
  const sound = page.waitForResponse("**/sounds/move.wav");
  await move(page, "e2e4");
  expect((await sound).ok()).toBe(true);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByText("Board and practice", { exact: true })
    .click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Next card", exact: true }).click();
  if (
    !(await page
      .getByLabel("About opening progress")
      .locator("..")
      .evaluate((el) => (el as HTMLDetailsElement).open))
  )
    await page.getByLabel("About opening progress").click();
  await expect(
    page.getByText(`${seeded + 1} attempts saved in this browser.`, {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText("24 cards due", { exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("Your move - White");
  await move(page, "g1f3");
  await page.getByRole("button", { name: "Next card", exact: true }).click();
  await page.reload();
  await expect(page.getByText("24 cards due", { exact: true })).toBeVisible();
  const log = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("chess-learning-space");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const records = await new Promise<
      {
        context: string;
        sessionId: string;
        grade: string;
        schedulingEligible: boolean;
      }[]
    >((resolve) => {
      const request = db
        .transaction("reviewLog")
        .objectStore("reviewLog")
        .getAll();
      request.onsuccess = () => resolve(request.result);
    });
    db.close();
    return records;
  });
  expect(log).toHaveLength(seeded + 2);
  log.splice(0, seeded);
  expect(new Set(log.map((r) => r.sessionId)).size).toBe(1);
  expect(log[0]).toMatchObject({
    context: "practice",
    grade: "good",
    schedulingEligible: false,
  });
});

test("White opening choice scopes London learn, drill and shared due counts", async ({
  page,
}) => {
  await unlockDrill(page);
  await page.goto("/#openings");
  await expect(page.getByLabel("Training colour")).toHaveValue("white");
  await expect(
    page
      .getByLabel("Opening", { exact: true })
      .locator("option[value=italian]"),
  ).toHaveText("Italian (24 due)");
  await page.getByLabel("Opening", { exact: true }).selectOption("london");
  await expect(page.getByLabel("Opening line")).toHaveValue("london-d5");
  await expect(page.locator(".page-header p")).toHaveText(
    "London \u00b7 White",
  );
  await expect(page.getByText("41 cards due", { exact: true })).toBeVisible();
  await returnToOpeningOverview(page);
  await page.getByRole("button", { name: "Learn", exact: true }).click();
  await page.getByRole("button", { name: "Next opening move" }).click();
  await expect(
    page.getByRole("heading", { name: "1. d4", exact: true }),
  ).toBeVisible();
  await returnToOpeningOverview(page);
  await page
    .getByRole("button", { name: "Drill due cards", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText(/Your move.*White/);
  await move(page, "e2e4");
  await expect(
    page.getByRole("heading", { name: "Play d4", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await move(page, "d2d4");
  await page.getByRole("button", { name: "Next card", exact: true }).click();
  await expect(page.getByText("40 cards due", { exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText(/Your move.*White/);
  // The shared root was reviewed through London, so it is also no longer due in Italian.
  await page.getByLabel("Opening", { exact: true }).selectOption("italian");
  await expect(page.getByText("23 cards due", { exact: true })).toBeVisible();
  await page.getByLabel("Opening", { exact: true }).selectOption("sidelines");
  await page.getByLabel("Opening line").selectOption("petrov-trick");
  await returnToOpeningOverview(page);
  await page.getByRole("button", { name: "Learn", exact: true }).click();
  await page.getByRole("button", { name: "4. Qe2", exact: true }).click();
  await expect(page.locator(".lesson-idea").last()).toContainText(
    "discovered check",
  );
  await returnToOpeningOverview(page);
  await page
    .getByRole("button", { name: "Practice whole line", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText(/Your move.*White/);
  await move(page, "e2e4");
  await expect(page.getByLabel("Opening", { exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Next card", exact: true }).click();
  await expect(page.getByText("87 cards due", { exact: true })).toBeVisible();
});

test("opening choices and lessons fit a phone viewport", async ({
  page,
}, info) => {
  await unlockDrill(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#openings");
  for (const [group, line] of [
    ["italian", "italian-central-break"],
    ["london", "london-gruenfeld"],
    ["sidelines", "scandinavian-qd6"],
  ]) {
    // Compact lessons disclose configuration so the board stays prominent.
    const options = page.locator(".training-options");
    if (!((await options.getAttribute("open")) === ""))
      await options.locator(":scope > summary").click();
    await page.getByLabel("Opening", { exact: true }).selectOption(group);
    await page.getByLabel("Opening line").selectOption(line);
    await returnToOpeningOverview(page);
    await page.getByRole("button", { name: "Learn", exact: true }).click();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
    const board = await page.locator("cg-board").boundingBox();
    expect(board!.width).toBeGreaterThan(300);
    expect(board!.x + board!.width).toBeLessThanOrEqual(390);
  }
  await page.screenshot({
    path: info.outputPath("white-repertoire-phone.png"),
    fullPage: true,
  });
});
