import type { Page } from "@playwright/test";

export async function returnToOpeningOverview(page: Page) {
  const back = page.getByRole("button", { name: "Back to overview", exact: true });
  if (await back.isVisible()) await back.click();
}

export async function openingMove(page: Page, uci: string) {
  const board = page.locator("cg-board");
  await board.scrollIntoViewIfNeeded();
  // Allow Chessground to clear its cached board bounds after scrolling.
  await page.evaluate(
    () => new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    ),
  );
  const box = await board.boundingBox();
  if (!box) throw new Error("Missing chess board");
  const black = await page.locator(".cg-wrap.orientation-black").count() > 0;
  for (const square of [uci.slice(0, 2), uci.slice(2, 4)]) {
    const file = square.charCodeAt(0) - 97;
    const rank = Number(square[1]);
    await page.mouse.click(
      box.x + ((black ? 7.5 - file : file + 0.5) * box.width) / 8,
      box.y + ((black ? rank - 0.5 : 8.5 - rank) * box.height) / 8,
    );
  }
}
