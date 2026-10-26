import { expect, test, type Page } from "@playwright/test";

async function point(page: Page, square: string) {
  await page.locator("cg-board").scrollIntoViewIfNeeded();
  const box = await page.locator("cg-board").boundingBox();
  if (!box) throw new Error("Board is not visible");
  const flipped = await page
    .getByTestId("board")
    .evaluate((el) => el.classList.contains("orientation-black"));
  const file = square.charCodeAt(0) - 97,
    rank = Number(square[1]) - 1;
  return {
    x: box.x + ((flipped ? 7.5 - file : file + 0.5) * box.width) / 8,
    y: box.y + ((flipped ? rank + 0.5 : 7.5 - rank) * box.height) / 8,
  };
}
async function clickSquare(page: Page, square: string) {
  const { x, y } = await point(page, square);
  await page.mouse.click(x, y);
}
async function drag(
  page: Page,
  from: string,
  to: string,
  button: "left" | "right" = "left",
) {
  const start = await point(page, from),
    end = await point(page, to);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down({ button });
  await page.mouse.move(end.x, end.y, { steps: 12 });
  await page.mouse.up({ button });
}
async function expectPiece(page: Page, square: string, classes: string) {
  const target = await point(page, square);
  await expect
    .poll(() =>
      page.locator("cg-board piece:not(.ghost)").evaluateAll(
        (pieces, target) =>
          pieces
            .filter((piece) => {
              const rect = piece.getBoundingClientRect();
              return (
                Math.abs(rect.x + rect.width / 2 - target.x) < 2 &&
                Math.abs(rect.y + rect.height / 2 - target.y) < 2
              );
            })
            .map((piece) => piece.className)
            .join(" "),
        target,
      ),
    )
    .toContain(classes);
}
async function load(page: Page, fen: string) {
  await page.getByText("Load a position", { exact: true }).click();
  await page.getByLabel("FEN position").fill(fen);
  await page
    .getByRole("button", { name: "Load position", exact: true })
    .click();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/#free-play");
});

test("drag and click-click moves show legal dots, capture rings and last move", async ({
  page,
}) => {
  await expect(
    page.getByRole("heading", { name: "Free play", exact: true }),
  ).toBeVisible();
  await expect(page.locator("coords")).toHaveCount(2);
  await clickSquare(page, "e2");
  await expect(page.locator("square.move-dest")).toHaveCount(2);
  await drag(page, "e2", "e4");
  await expect(
    page.getByRole("button", { name: "Go to move 1: e4", exact: true }),
  ).toBeVisible();
  await expectPiece(page, "e4", "white pawn");
  await expect(page.locator("square.last-move")).toHaveCount(2);
  await expect(page.locator("piece.ghost")).toHaveCount(0);
  await clickSquare(page, "d7");
  await clickSquare(page, "d5");
  await expect(
    page.getByRole("button", { name: "Go to move 2: d5", exact: true }),
  ).toBeVisible();
  await clickSquare(page, "e4");
  await expect(page.locator("square.move-dest.oc")).toHaveCount(1);
  await clickSquare(page, "d5");
  await expect(
    page.getByRole("button", { name: "Go to move 3: exd5", exact: true }),
  ).toBeVisible();
  await expectPiece(page, "d5", "white pawn");
});

test("illegal drags snap back silently without adding a move", async ({
  page,
}) => {
  await drag(page, "e2", "e5");
  await expectPiece(page, "e2", "white pawn");
  await expect(page.getByText("A fresh board", { exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("White to move");
  await drag(page, "e7", "e5");
  await expectPiece(page, "e7", "black pawn");
  await clickSquare(page, "e2");
  await clickSquare(page, "e4");
  await expect(
    page.getByRole("button", { name: "Go to move 1: e4", exact: true }),
  ).toBeVisible();
});

test("promotion can be cancelled, retried and completed with an underpromotion", async ({
  page,
}) => {
  await load(page, "7k/P7/8/8/8/8/8/7K w - - 0 1");
  await drag(page, "a7", "a8");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expectPiece(page, "a8", "white pawn");
  await page.getByRole("button", { name: "Cancel promotion" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expectPiece(page, "a7", "white pawn");
  await expect(page.getByText("A fresh board", { exact: true })).toBeVisible();
  await clickSquare(page, "a7");
  await clickSquare(page, "a8");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expectPiece(page, "a7", "white pawn");
  await drag(page, "a7", "a8");
  await page
    .getByRole("button", { name: "Promote to knight", exact: true })
    .click();
  await expectPiece(page, "a8", "white knight");
  await expect(
    page.getByRole("button", { name: "Go to move 1: a8=N", exact: true }),
  ).toBeVisible();
});

test("right-drag arrows, modifier colours, right-click circles and left-click clearing", async ({
  page,
}) => {
  await drag(page, "e2", "e4", "right");
  await expect(page.locator(".cg-shapes line")).toHaveCount(1);
  const color = await page.locator(".cg-shapes line").getAttribute("stroke");
  expect(color).toBe("#f7941d");
  await page.keyboard.down("Shift");
  await drag(page, "d2", "d4", "right");
  await page.keyboard.up("Shift");
  await expect(page.locator(".cg-shapes line")).toHaveCount(2);
  expect(
    await page.locator(".cg-shapes line").nth(1).getAttribute("stroke"),
  ).not.toBe(color);
  const { x, y } = await point(page, "f3");
  // Chessground samples the drawing gesture on an animation frame.
  await page.mouse.click(x, y, { button: "right", delay: 50 });
  await expect(page.locator(".cg-shapes circle")).toHaveCount(1);
  await clickSquare(page, "a3");
  await expect(page.locator(".cg-shapes line, .cg-shapes circle")).toHaveCount(
    0,
  );
});

test("arrow keys, move list and flip navigate the visible position", async ({
  page,
}) => {
  await clickSquare(page, "e2");
  await clickSquare(page, "e4");
  await expect(page.getByRole("status")).toHaveText("Black to move");
  await clickSquare(page, "e7");
  await clickSquare(page, "e5");
  await expect(page.getByRole("status")).toHaveText("White to move");
  await page.keyboard.press("ArrowLeft");
  await expectPiece(page, "e7", "black pawn");
  await page.keyboard.press("ArrowUp");
  await expectPiece(page, "e2", "white pawn");
  await page.keyboard.press("ArrowDown");
  await expectPiece(page, "e5", "black pawn");
  await page
    .getByRole("button", { name: "Go to move 1: e4", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Black to move");
  await page.getByRole("button", { name: "Flip board" }).click();
  await expect(page.getByTestId("board")).toHaveClass(/orientation-black/);
  await expectPiece(page, "e4", "white pawn");
});

test("settings persist in IndexedDB and malformed legacy settings fall back safely", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Board settings", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByText("Board and practice", { exact: true })
    .click();
  await page.getByRole("checkbox", { name: /Sound/ }).uncheck();
  await page
    .getByRole("checkbox", { name: "Coordinates", exact: true })
    .uncheck();
  await page
    .getByRole("checkbox", { name: "Reduced motion", exact: true })
    .check();
  await page.getByLabel("Animation speed").selectOption("400");
  await page.reload();
  await expect(page.locator("coords")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Board settings", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByText("Board and practice", { exact: true })
    .click();
  await expect(page.getByRole("checkbox", { name: /Sound/ })).not.toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: "Reduced motion", exact: true }),
  ).toBeChecked();
  await expect(page.getByLabel("Animation speed")).toHaveValue("400");
  await page.evaluate(() =>
    localStorage.setItem("chess-learning-space:settings:v1", "{bad json"),
  );
  await page.reload();
  // The durable settings survive a corrupt localStorage mirror.
  await expect(page.locator("coords")).toHaveCount(0);
  await expect(
    page.getByText("Openings: 0 cards due", { exact: true }),
  ).toBeVisible();
  // A pre-upgrade browser with no durable settings still uses safe defaults.
  await page.goto("/e2e/fixtures/board.html");
  await page.evaluate(async () => {
    localStorage.setItem("chess-learning-space:settings:v1", "{bad json");
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase("chess-learning-space");
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("Storage is blocked"));
    });
  });
  await page.goto("/#free-play");
  await expect(page.locator("coords")).toHaveCount(2);
});

test("check highlight, invalid FEN feedback and narrow layout", async ({
  page,
}) => {
  await load(page, "4k3/8/8/8/8/8/4R3/4K3 b - - 0 1");
  await expect(page.locator("square.check")).toHaveCount(1);
  await expect(page.getByRole("status")).toHaveText("Check");
  await page.getByLabel("FEN position").fill("invalid");
  await page
    .getByRole("button", { name: "Load position", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Invalid FEN");
  await expect(page.locator("square.check")).toHaveCount(1);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await expect(page.locator("cg-board")).toBeVisible();
});

test("move, capture and check sounds load locally and the sound switch mutes them", async ({
  page,
}) => {
  const requested: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/sounds/")) requested.push(request.url());
  });
  await drag(page, "e2", "e5");
  await expectPiece(page, "e2", "white pawn");
  expect(requested).toEqual([]);
  const moveSound = page.waitForResponse("**/sounds/move.wav");
  await clickSquare(page, "e2");
  await clickSquare(page, "e4");
  expect((await moveSound).ok()).toBe(true);
  await clickSquare(page, "d7");
  await clickSquare(page, "d5");
  await expect(page.getByRole("status")).toHaveText("White to move");
  const captureSound = page.waitForResponse("**/sounds/capture.wav");
  await clickSquare(page, "e4");
  await clickSquare(page, "d5");
  expect((await captureSound).ok()).toBe(true);
  await page
    .getByRole("button", { name: "Board settings", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByText("Board and practice", { exact: true })
    .click();
  await page.getByRole("checkbox", { name: /Sound/ }).uncheck();
  await page.getByRole("button", { name: "Close settings" }).click();
  const fen = "4k3/8/8/8/8/8/R7/6K1 w - - 0 1";
  await load(page, fen);
  await clickSquare(page, "a2");
  await clickSquare(page, "e2");
  await expect(page.getByRole("status")).toHaveText("Check");
  expect(requested.some((url) => url.includes("check.wav"))).toBe(false);
  await page
    .getByRole("button", { name: "Board settings", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByText("Board and practice", { exact: true })
    .click();
  await page.getByRole("checkbox", { name: /Sound/ }).check();
  await page.getByRole("button", { name: "Close settings" }).click();
  await page.getByLabel("FEN position").fill(fen);
  await page
    .getByRole("button", { name: "Load position", exact: true })
    .click();
  const checkSound = page.waitForResponse("**/sounds/check.wav");
  await clickSquare(page, "a2");
  await clickSquare(page, "e2");
  expect((await checkSound).ok()).toBe(true);
});

for (const viewport of [
  { width: 1400, height: 860 },
  { width: 390, height: 844 },
]) {
  test("board fits viewport " + viewport.width, async ({ page }) => {
    await page.setViewportSize(viewport);
    const box = await page.locator("cg-board").boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
    expect(Math.abs(box!.width - box!.height)).toBeLessThan(1);
    if (viewport.width === 1400)
      await page.screenshot({ path: ".scratch/shot-02b.png" });
  });
}
test("settings overlay preserves board position, closes on Escape, and disables CSS motion", async ({
  page,
}) => {
  const before = await page.locator("cg-board").boundingBox();
  await page
    .getByRole("button", { name: "Board settings", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByText("Board and practice", { exact: true })
    .click();
  expect(await page.locator("cg-board").boundingBox()).toEqual(before);
  await page
    .getByRole("checkbox", { name: "Reduced motion", exact: true })
    .check();
  await expect(page.locator("html")).toHaveAttribute(
    "data-reduced-motion",
    "true",
  );
  expect(
    await page
      .getByRole("button", { name: "Close settings" })
      .evaluate((el) => getComputedStyle(el).transitionDuration),
  ).toBe("0s");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("history shortcuts ignore modifiers, composition and editable focus", async ({
  page,
}) => {
  await clickSquare(page, "e2");
  await clickSquare(page, "e4");
  for (const modifier of ["Alt", "Control", "Meta"]) {
    await page.keyboard.press(modifier + "+ArrowLeft");
    await expect(page.getByRole("status")).toHaveText("Black to move");
  }
  await page.evaluate(() =>
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowLeft", isComposing: true }),
    ),
  );
  await expect(page.getByRole("status")).toHaveText("Black to move");
  await page.getByText("Load a position", { exact: true }).click();
  await page.getByLabel("FEN position").focus();
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("status")).toHaveText("Black to move");
  await page.locator("h1").evaluate((el) => {
    el.setAttribute("contenteditable", "true");
    if (el instanceof HTMLElement) el.focus();
  });
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("status")).toHaveText("Black to move");
});
test("castling by king move moves the rook too", async ({ page }) => {
  await load(page, "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
  await clickSquare(page, "e1");
  await clickSquare(page, "g1");
  await expectPiece(page, "g1", "white king");
  await expectPiece(page, "f1", "white rook");
  await expect(
    page.getByRole("button", { name: "Go to move 1: O-O", exact: true }),
  ).toBeVisible();
});
test("en passant removes the captured pawn", async ({ page }) => {
  await load(page, "4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1");
  await drag(page, "e5", "d6");
  await expectPiece(page, "d6", "white pawn");
  await expect(page.locator("cg-board piece.black.pawn")).toHaveCount(0);
});
test("drag works on a flipped board", async ({ page }) => {
  await page.getByRole("button", { name: "Flip board" }).click();
  await drag(page, "e2", "e4");
  await expectPiece(page, "e4", "white pawn");
  await expect(page.getByRole("status")).toHaveText("Black to move");
});
test("Board contract: locked input, movable side, injected shapes and square selection", async ({
  page,
}) => {
  await page.goto("/e2e/fixtures/board.html");
  await page.getByLabel("Locked").check();
  await drag(page, "e2", "e4");
  await clickSquare(page, "e2");
  await clickSquare(page, "e4");
  await expect(page.getByTestId("intent")).toBeEmpty();
  await expectPiece(page, "e2", "white pawn");
  await page.getByLabel("Locked").uncheck();
  await page.getByLabel("Movable side").selectOption("black");
  await drag(page, "e2", "e4");
  await expect(page.getByTestId("intent")).toBeEmpty();
  await page.getByLabel("Movable side").selectOption("white");
  await drag(page, "e2", "e4");
  await expect(page.getByTestId("intent")).toHaveText("e2e4");
  await page.getByRole("button", { name: "Inject shapes" }).click();
  await expect(page.locator(".cg-shapes line")).toHaveCount(1);
  await expect(page.locator(".cg-shapes circle")).toHaveCount(1);
  await clickSquare(page, "a3");
  await expect(page.getByTestId("square")).toHaveText("a3");
  await page.getByRole("button", { name: "Castling destinations" }).click();
  await expect(page.getByTestId("original-dests")).toHaveText("f1,g1,h1");
});
test("settings initialise safely when browser APIs throw", async ({ page }) => {
  await page.addInitScript(() => {
    window.matchMedia = () => {
      throw new Error("unavailable");
    };
    Storage.prototype.setItem = () => {
      throw new Error("blocked");
    };
  });
  await page.reload();
  await page
    .getByRole("button", { name: "Board settings", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByText("Board and practice", { exact: true })
    .click();
  await expect(
    page.getByText("Storage unavailable. Settings apply for this session."),
  ).toBeVisible();
});

test("active moves stay visible when playing and navigating a long game", async ({
  page,
}) => {
  for (let round = 0; round < 8; round++) {
    for (const [from, to] of [
      ["g1", "f3"],
      ["g8", "f6"],
      ["f3", "g1"],
      ["f6", "g8"],
    ]) {
      await clickSquare(page, from);
      await clickSquare(page, to);
      await expect(page.locator(".move-list [aria-current=step]")).toHaveCount(
        1,
      );
    }
  }
  const inside = () =>
    page.locator(".move-list [aria-current=step]").evaluate((el) => {
      const active = el.getBoundingClientRect(),
        list = el.closest(".move-list")!.getBoundingClientRect();
      return {
        top: active.top - list.top,
        bottom: list.bottom - active.bottom,
      };
    });
  await expect
    .poll(async () => {
      const bounds = await inside();
      return bounds.top >= -1 && bounds.bottom >= -1;
    })
    .toBe(true);
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(async () => {
      const bounds = await inside();
      return bounds.top >= -1 && bounds.bottom >= -1;
    })
    .toBe(true);
  await expect(page.locator(".move-list [aria-current=step]")).toHaveText(
    "Nf3",
  );
});
test("coordinate colours alternate correctly in both orientations", async ({
  page,
}) => {
  for (let orientation = 0; orientation < 2; orientation++) {
    for (const axis of ["ranks", "files"]) {
      const colours = await page
        .locator("coords." + axis + " coord")
        .evaluateAll((nodes) => nodes.map((el) => getComputedStyle(el).color));
      // White: labels sit on a1/a-file squares starting dark -> light text first.
      // Black: labels sit on h1/rank-8 squares starting light -> dark text first.
      const lightFirst = orientation === 0;
      expect(colours).toEqual(
        Array.from({ length: 8 }, (_, i) =>
          (i % 2 === 0) === lightFirst
            ? "rgb(222, 229, 233)"
            : "rgb(24, 45, 68)",
        ),
      );
    }
    await page.getByRole("button", { name: "Flip board" }).click();
  }
});

test("click-click input follows a board shifted by a rendered notice", async ({
  page,
}) => {
  await page.goto("/e2e/fixtures/board.html");
  // Populate Chessground's bounds cache before a same-size layout shift.
  await clickSquare(page, "a1");
  await page.getByRole("button", { name: "Show layout notice" }).click();
  await clickSquare(page, "e2");
  await clickSquare(page, "e4");
  await expect(page.getByTestId("intent")).toHaveText("e2e4");
});
