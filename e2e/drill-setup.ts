import type { Page } from "@playwright/test";
/** Existing drill scenarios start with already mastered lines; stage progression has its own tests. */
export async function unlockDrill(page: Page): Promise<number> {
  await page.goto("/e2e/fixtures/board.html");
  return page.evaluate(async () => {
    const repPath = "/src/repertoire/bundled.ts";
    const progressPath = "/src/progress/Progress.ts";
    const { repertoire } = await import(/* @vite-ignore */ repPath);
    const { openProgress } = await import(/* @vite-ignore */ progressPath);
    const progress = await openProgress();
    let count = 0;
    for (const side of ["white", "black"] as const) {
      for (const line of repertoire.lineMeta(side)) {
        const card = repertoire.selectLines(side, [line.id]).cards(side)[0];
        await progress.record({
          attemptId: `00000000000000000000${String(++count).padStart(6, "0")}`,
          sessionId: `mastered-${count}`,
          cardId: card.id,
          lineId: line.id,
          context: "practice",
          lineCompleted: true,
          grade: "good",
          hintsUsed: 0,
          at: Date.now(),
          durationMs: 0,
          schedulingEligible: false,
        });
      }
    }
    progress.close();
    return count;
  });
}
