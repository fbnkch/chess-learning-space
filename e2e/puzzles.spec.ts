import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { Game } from "../src/game/Game";
import type { PuzzleRow } from "../src/puzzles/types";
const first: PuzzleRow = JSON.parse(
  readFileSync("public/puzzles/fork.json", "utf8"),
)[0];
test("offers a retry after a chunk download fails", async ({ page }) => {
  await page.route("**/puzzles/fork.json", (route) =>
    route.fulfill({ status: 503, body: "Unavailable" }),
  );
  await page.goto("/#puzzles");
  await expect(page.getByRole("alert")).toContainText("Could not load puzzles");
  await page.unroute("**/puzzles/fork.json");
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByText(/to move. Find the best/)).toBeVisible();
});
async function move(page: Page, uci: string) {
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
    .evaluate((el) => el.classList.contains("orientation-black"));
  for (const sq of [uci.slice(0, 2), uci.slice(2, 4)]) {
    const f = sq.charCodeAt(0) - 97,
      r = +sq[1] - 1;
    await page.mouse.click(
      box.x + (((black ? 7 - f : f) + 0.5) * box.width) / 8,
      box.y + (((black ? r : 7 - r) + 0.5) * box.height) / 8,
    );
  }
}
test("loads only the chosen chunk and solves a real puzzle with forced replies", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/puzzles/")) requests.push(r.url());
  });
  await page.goto("/#puzzles");
  await expect(page.getByText(/to move. Find the best/)).toBeVisible();
  expect(
    [...new Set(requests)]
      .filter((u) => u.endsWith(".json"))
      .map((u) => u.split("/").pop())
      .sort(),
  ).toEqual(["fork.json", "manifest.json"]);
  const moves = first[2].split(" ");
  for (let i = 1; i < moves.length; i += 2) {
    await expect(page.getByText(/to move. Find the best/)).toBeVisible();
    await move(page, moves[i]);
    if (i < moves.length - 1)
      await expect(page.getByText("Opponent’s reply…")).toBeVisible();
  }
  await expect(page.getByText("Puzzle solved.")).toBeVisible();
  await expect(page.getByLabel("Puzzle rating", { exact: true })).toContainText(
    "1 rated attempts",
  );
  await expect(
    page.getByLabel("Puzzle rating", { exact: true }).locator("strong"),
  ).not.toHaveText("1000");
  await page.getByRole("button", { name: "Replay solution" }).click();
  await expect(page.getByText("Solution complete.")).toBeVisible();
});

test("two-step Hint counts as a rated loss, resets after a move, and returns in Due tomorrow", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date(2026, 9, 25, 12));
  await page.goto("/#puzzles");
  await expect(page.getByText(/to move. Find the best/)).toBeVisible();
  await page.getByRole("button", { name: "Hint 1 / 2" }).click();
  await expect(page.getByLabel("Puzzle hint")).toContainText("fork");
  await page.getByRole("button", { name: "Hint 2 / 2" }).click();
  await expect(page.getByLabel("Puzzle hint")).toContainText("d4 → e2");
  await expect(page.getByText("Attempt saved", { exact: true })).toBeVisible();
  await move(page, "d4e2");
  await expect(page.getByText(/to move. Find the best/)).toBeVisible();
  await expect(page.getByLabel("Puzzle hint")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Hint 1 / 2" })).toBeEnabled();
  await expect(page.getByLabel("Puzzle rating", { exact: true })).toContainText(
    "1 rated attempts",
  );
  await page.getByRole("button", { name: "Due puzzles (0)" }).click();
  await expect(page.getByText(/Nothing is due/)).toBeVisible();
  await page.clock.setFixedTime(new Date(2026, 9, 26, 4, 1));
  await page.reload();
  await page.getByRole("button", { name: "Due puzzles (1)" }).click();
  await expect(page.getByText(/to move. Find the best/)).toBeVisible();
  // A hint in Due reschedules, while the active exercise stays available for step 2.
  await page.getByRole("button", { name: "Hint 1 / 2" }).click();
  await page.getByRole("button", { name: "Hint 2 / 2" }).click();
  await expect(page.getByLabel("Puzzle hint")).toContainText("d4 → e2");
  await expect(page.getByLabel("Puzzle rating", { exact: true })).toContainText(
    "1 rated attempts",
  );
});

test("failed rated puzzle is due tomorrow and a clean SRS review stays unrated", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date(2026, 9, 25, 12));
  await page.goto("/#puzzles");
  await expect(page.getByText(/to move. Find the best/)).toBeVisible();
  const g = new Game(first[1]);
  g.play(first[2].split(" ")[0]);
  const wrong = [...g.destinations()]
    .flatMap(([f, ts]) => ts.map((t) => f + t))
    .find((u) => u !== "d4e2")!;
  await move(page, wrong);
  await expect(page.getByText("Attempt saved", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Puzzle rating", { exact: true })).toContainText(
    "1 rated attempts",
  );
  const rating = await page
    .getByLabel("Puzzle rating", { exact: true })
    .locator("strong")
    .innerText();
  await page.clock.setFixedTime(new Date(2026, 9, 26, 4, 1));
  await page.reload();
  await page.getByRole("button", { name: "Due puzzles (1)" }).click();
  for (const uci of ["d4e2", "e2c3"]) {
    await expect(page.getByText(/to move. Find the best/)).toBeVisible();
    await move(page, uci);
    if (uci === "d4e2")
      await expect(page.getByText("Opponent’s reply…")).toBeVisible();
  }
  await expect(page.getByText("Puzzle solved.")).toBeVisible();
  await expect(page.getByText("Attempt saved", { exact: true })).toBeVisible();
  await expect(
    page.getByLabel("Puzzle rating", { exact: true }).locator("strong"),
  ).toHaveText(rating);
  await page.getByRole("button", { name: "Next puzzle" }).click();
  await expect(page.getByText(/Nothing is due/)).toBeVisible();
});

test("fixed Woodpecker set completes cycles, persists and leaves rating and Due unchanged", async ({
  page,
}) => {
  await page.goto("/#puzzles");
  await expect(page.getByText(/to move. Find the best/)).toBeVisible();
  await page.getByRole("button", { name: "Woodpecker", exact: true }).click();
  await page.getByLabel("Woodpecker set size").fill("1");
  await page.getByRole("button", { name: "Create fixed set" }).click();
  await expect(page.getByText("Cycle 1 · Puzzle 1 / 1")).toBeVisible();
  for (const uci of ["d4e2", "e2c3"]) {
    await expect(page.getByText(/to move. Find the best/)).toBeVisible();
    await move(page, uci);
    if (uci === "d4e2")
      await expect(page.getByText("Opponent’s reply…")).toBeVisible();
  }
  await expect(page.getByText(/Cycle 1: .*100% accuracy/)).toBeVisible();
  await page.getByRole("button", { name: "Next puzzle" }).click();
  await expect(page.getByText("Cycle 2 · Puzzle 1 / 1")).toBeVisible();
  await expect(page.getByText(/to move. Find the best/)).toBeVisible();
  await page.getByRole("button", { name: "Hint 1 / 2" }).click();
  await expect(page.getByText(/Cycle 2: .*0% accuracy/)).toBeVisible();
  await expect(page.getByLabel("Puzzle rating", { exact: true })).toContainText(
    "0 rated attempts",
  );
  await expect(
    page.getByRole("button", { name: "Due puzzles (0)" }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Woodpecker", exact: true }).click();
  await expect(page.getByText("Cycle 3 · Puzzle 1 / 1")).toBeVisible();
  await page.screenshot({
    path: "test-results/puzzles-woodpecker.png",
    fullPage: true,
  });
});

test("Threat Scan can use filtered puzzle setup positions", async ({
  page,
}) => {
  await page.goto("/#threats");
  await page.getByLabel("Scan source").selectOption("puzzles");
  await expect(page.getByText(/Puzzle [A-Za-z0-9]+ ·/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Check", exact: true }),
  ).toBeEnabled();
});
test("fails a wrong move, reveals and replays the solution, supports filters", async ({
  page,
}) => {
  await page.goto("/#puzzles");
  await expect(page.getByText(/to move. Find the best/)).toBeVisible();
  const g = new Game(first[1]);
  g.play(first[2].split(" ")[0]);
  const wrong = [...g.destinations()]
    .flatMap(([f, ts]) => ts.map((t) => f + t))
    .find((u) => u !== first[2].split(" ")[1])!;
  await move(page, wrong);
  await expect(
    page.getByText("Attempt failed.", { exact: false }),
  ).toBeVisible();
  await expect(page.getByLabel("Puzzle solution")).toBeVisible();
  await page.getByRole("button", { name: "Replay solution" }).click();
  await expect(page.getByText("Solution complete.")).toBeVisible();
  await page.getByLabel("Puzzle motif").selectOption("defensiveMove");
  await expect(page.getByText(/to move. Find the best/)).toBeVisible();
  await page.getByLabel("Puzzle motif").selectOption("quietMove");
  await expect(page.getByText(/to move. Find the best/)).toBeVisible();
  await page.screenshot({
    path: "test-results/puzzles-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/puzzles-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.locator(".training-options > summary").click();
  await page.getByLabel("Minimum puzzle rating").fill("1700");
  await page.getByLabel("Maximum puzzle rating").fill("600");
  await expect(page.getByText(/No puzzles in this rating range/)).toBeVisible();
});

test("retry save after replay preserves the original failed rated attempt", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date(2026, 9, 25, 12));
  await page.goto("/#puzzles");
  await expect(page.getByText(/to move. Find the best/)).toBeVisible();
  await page.evaluate(() => {
    const add = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function (...args) {
      if (this.name === "reviewLog") {
        IDBObjectStore.prototype.add = add;
        this.transaction.abort();
        throw new DOMException("Simulated save failure", "QuotaExceededError");
      }
      return add.apply(this, args);
    };
  });
  const game = new Game(first[1]);
  game.play(first[2].split(" ")[0]);
  const wrong = [...game.destinations()]
    .flatMap(([from, tos]) => tos.map((to) => from + to))
    .find((uci) => uci !== first[2].split(" ")[1])!;
  await move(page, wrong);
  await expect(page.getByRole("alert")).toContainText("Could not save");
  await page.getByRole("button", { name: "Replay solution" }).click();
  await expect(page.getByText("Solution complete.")).toBeVisible();
  await page.getByRole("button", { name: "Retry save" }).click();
  await expect(page.getByText("Attempt saved", { exact: true })).toBeVisible();
  const rating = Number(
    await page
      .getByLabel("Puzzle rating", { exact: true })
      .locator("strong")
      .innerText(),
  );
  expect(rating).toBeLessThan(1000);
  await page.clock.setFixedTime(new Date(2026, 9, 26, 4, 1));
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Due puzzles (1)" }),
  ).toBeVisible();
});

test("Next puzzle skips an unfinished Due puzzle without getting stuck loading", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date(2026, 9, 25, 12));
  await page.goto("/#puzzles");
  await expect(page.getByText(/to move. Find the best/)).toBeVisible();
  await page.getByRole("button", { name: "Hint 1 / 2" }).click();
  await expect(page.getByText("Attempt saved", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Next puzzle" }).click();
  await expect(page.getByText(/to move. Find the best/)).toBeVisible();
  await page.getByRole("button", { name: "Hint 1 / 2" }).click();
  await expect(page.getByText("Attempt saved", { exact: true })).toBeVisible();
  await page.clock.setFixedTime(new Date(2026, 9, 26, 4, 1));
  await page.reload();
  await page.getByRole("button", { name: "Due puzzles (2)" }).click();
  await expect(page.getByText(/to move. Find the best/)).toBeVisible();
  const identity = page.getByText(/Puzzle [A-Za-z0-9]+ .* Lichess/);
  const before = await identity.innerText();
  await page.getByRole("button", { name: "Next puzzle" }).click();
  await expect(page.getByText(/to move. Find the best/)).toBeVisible();
  await expect(identity).not.toHaveText(before);
  await page.getByRole("button", { name: "Next puzzle" }).click();
  await expect(identity).toHaveText(before);
  await expect(
    page.getByRole("button", { name: "Due puzzles (2)" }),
  ).toBeVisible();
});

// Small deterministic opening catalogue. Reuse legal solution data; only the
// test catalogue's opening metadata differs from the original motif fixture.
const openingFixtures: PuzzleRow[] = [
  [
    ...first.slice(0, 9),
    "Italian_Game Italian_Game_Giuoco_Pianissimo",
  ] as PuzzleRow,
  [
    "Lond1",
    ...first.slice(1, 7),
    "quietMove",
    first[8],
    "Queens_Pawn_Game_London_System",
  ] as PuzzleRow,
  [
    "Caro1",
    ...first.slice(1, 9),
    "Caro-Kann_Defense_Advance_Variation",
  ] as PuzzleRow,
  [
    "Qgd01",
    ...first.slice(1, 9),
    "Queens_Gambit_Declined_Exchange_Variation",
  ] as PuzzleRow,
];
async function openingCatalogue(page: Page) {
  await page.route("**/puzzles/opening-puzzles.json", (route) =>
    route.fulfill({ json: { rows: openingFixtures } }),
  );
}

test("Home links opening puzzles, with per-opening, motif, rating and empty filters", async ({
  page,
}) => {
  await openingCatalogue(page);
  await page.goto("/#home");
  await page.locator(".session-details > summary").click();
  await page.getByRole("link", { name: "Opening puzzles" }).click();
  await expect(page.getByLabel("Puzzle opening")).toHaveValue("repertoire");
  await expect(page.getByText(/to move. Find the best/)).toBeVisible();
  await page.getByLabel("Puzzle opening").selectOption("london");
  await expect(page.getByText(/Puzzle Lond1/)).toBeVisible();
  await page.getByLabel("Puzzle motif").selectOption("fork");
  await expect(page.getByText(/No puzzles match these filters/)).toBeVisible();
  await page.getByLabel("Puzzle motif").selectOption("all");
  await expect(page.getByText(/Puzzle Lond1/)).toBeVisible();
  await page.getByLabel("Minimum puzzle rating").fill("1700");
  await expect(page.getByText(/No puzzles match these filters/)).toBeVisible();
  await page.getByLabel("Minimum puzzle rating").fill("600");
  for (const [opening, id] of [
    ["caro", "Caro1"],
    ["qgd", "Qgd01"],
    ["italian", first[0]],
  ]) {
    await page.getByLabel("Puzzle opening").selectOption(opening);
    await expect(page.getByText(new RegExp(`Puzzle ${id}`))).toBeVisible();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/opening-puzzles-mobile.png",
    fullPage: true,
  });
});

test("each repertoire opening links to its puzzle filter", async ({ page }) => {
  await openingCatalogue(page);
  for (const [opening, side] of [
    ["italian", "white"],
    ["london", "white"],
    ["caro", "black"],
    ["qgd", "black"],
  ]) {
    await page.goto("/#openings");
    await page.getByLabel("Training colour").selectOption(side);
    await page.getByLabel("Opening", { exact: true }).selectOption(opening);
    await page.locator(".opening-plan > summary").click();
    await page.getByRole("link", { name: "Practice opening puzzles" }).click();
    await expect(page.getByLabel("Puzzle opening")).toHaveValue(opening);
    await expect(page.getByText(/to move. Find the best/)).toBeVisible();
  }
});

test("opening puzzle failure shares first-encounter rating and Due with the original motif", async ({
  page,
}) => {
  await openingCatalogue(page);
  await page.clock.setFixedTime(new Date(2026, 9, 25, 12));
  await page.goto("/#puzzles?opening=italian");
  await expect(page.getByText(/to move. Find the best/)).toBeVisible();
  await page.getByRole("button", { name: "Hint 1 / 2" }).click();
  await expect(page.getByText("Attempt saved", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Puzzle rating", { exact: true })).toContainText(
    "1 rated attempts",
  );
  const rating = await page
    .getByLabel("Puzzle rating", { exact: true })
    .locator("strong")
    .innerText();
  await page.getByLabel("Puzzle opening").selectOption("all");
  await expect(page.getByText(/to move. Find the best/)).toBeVisible();
  await page.getByRole("button", { name: "Hint 1 / 2" }).click();
  await expect(page.getByText("Attempt saved", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Puzzle rating", { exact: true })).toContainText(
    "1 rated attempts",
  );
  await page.clock.setFixedTime(new Date(2026, 9, 26, 4, 1));
  await page.reload();
  await page.getByRole("button", { name: "Due puzzles (1)" }).click();
  for (let i = 1; i < first[2].split(" ").length; i += 2) {
    await expect(page.getByText(/to move. Find the best/)).toBeVisible();
    await move(page, first[2].split(" ")[i]);
    if (i < first[2].split(" ").length - 1)
      await expect(page.getByText("Opponent\u2019s reply\u2026")).toBeVisible();
  }
  await expect(page.getByText("Puzzle solved.")).toBeVisible();
  await expect(page.getByText("Attempt saved", { exact: true })).toBeVisible();
  await expect(
    page.getByLabel("Puzzle rating", { exact: true }).locator("strong"),
  ).toHaveText(rating);
  await page.getByRole("button", { name: "Next puzzle" }).click();
  await expect(page.getByText(/Nothing is due/)).toBeVisible();
});

test("opening catalogue errors can be retried without loading every motif", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/puzzles/") && r.url().endsWith(".json"))
      requests.push(r.url().split("/").pop()!);
  });
  await page.route("**/puzzles/opening-puzzles.json", (route) =>
    route.fulfill({ status: 503, body: "Unavailable" }),
  );
  await page.goto("/#puzzles?opening=caro");
  await expect(page.getByRole("alert")).toContainText(
    "Could not load opening puzzles",
  );
  await page.unroute("**/puzzles/opening-puzzles.json");
  await openingCatalogue(page);
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByText(/Puzzle Caro1/)).toBeVisible();
  expect([...new Set(requests)].sort()).toEqual([
    "manifest.json",
    "opening-puzzles.json",
  ]);
});
