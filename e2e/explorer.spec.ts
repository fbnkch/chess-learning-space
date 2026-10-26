import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/#home");
  await page
    .getByRole("button", { name: "Settings", exact: true })
    .first()
    .click();
  await page
    .getByRole("dialog")
    .getByText("Opening explorer", { exact: true })
    .click();
  await expect(page.getByLabel("Lichess personal API token")).toBeEnabled();
});

test("explicit refresh uses a masked private token, persists weights and retains them after a 401", async ({
  page,
}) => {
  test.setTimeout(180_000);
  let unauthorized = false;
  let requests = 0;
  await page.route("https://explorer.lichess.ovh/**", async (route) => {
    requests++;
    expect(route.request().headers().authorization).toBe(
      "Bearer fake-explorer-token",
    );
    const fen = new URL(route.request().url()).searchParams.get("fen")!;
    const e4 = fen.startsWith(
      "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b",
    );
    await route.fulfill(
      unauthorized
        ? { status: 401, body: "private server detail fake-explorer-token" }
        : {
            json: {
              white: 50,
              draws: 10,
              black: 40,
              moves: e4 ? [{ uci: "e7e5", white: 5, draws: 0, black: 5 }] : [],
            },
          },
    );
  });
  const panel = page.getByRole("region", { name: "Lichess opening explorer" });
  const token = page.getByLabel("Lichess personal API token");
  await expect(token).toHaveAttribute("type", "password");
  await token.fill("fake-explorer-token");
  await page
    .getByRole("button", { name: "Save Lichess token", exact: true })
    .click();
  await expect(panel.getByRole("status")).toHaveText("Lichess token saved.");
  expect(requests).toBe(0);
  await page.clock.install();
  await page
    .getByRole("button", {
      name: "Refresh reply weights from Lichess",
      exact: true,
    })
    .click();
  await expect(panel.getByRole("status")).toContainText("Refreshing 1/");
  const total = Number(
    (await panel.getByRole("status").innerText()).match(
      /Refreshing 1\/(\d+)/,
    )![1],
  );
  for (let done = 2; done <= total; done++) {
    await page.clock.runFor(1000);
    await expect(panel.getByRole("status")).toContainText(
      done === total ? "Reply weights refreshed" : `Refreshing ${done}/`,
    );
  }
  expect(requests).toBe(total);
  const readWeights = () =>
    page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve) => {
        const open = indexedDB.open("chess-learning-space");
        open.onsuccess = () => resolve(open.result);
      });
      try {
        return await new Promise<unknown[]>((resolve) => {
          const request = db
            .transaction("replyWeights")
            .objectStore("replyWeights")
            .getAll();
          request.onsuccess = () => resolve(request.result);
        });
      } finally {
        db.close();
      }
    });
  const saved = await readWeights();
  expect(saved).toHaveLength(total);
  expect(JSON.stringify(saved)).toContain('"e7e5":10');
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(
    "fake-explorer-token",
  );
  unauthorized = true;
  await page
    .getByRole("button", {
      name: "Refresh reply weights from Lichess",
      exact: true,
    })
    .click();
  await expect(panel.getByRole("status")).toContainText("401");
  await expect(panel.getByRole("status")).not.toContainText(
    "fake-explorer-token",
  );
  expect(await readWeights()).toEqual(saved);
  await page.reload();
  await page
    .getByRole("button", { name: "Settings", exact: true })
    .first()
    .click();
  await page
    .getByRole("dialog")
    .getByText("Opening explorer", { exact: true })
    .click();
  await expect(token).toHaveValue("fake-explorer-token");
  await expect(panel).toContainText("Last refresh:");
  expect(requests).toBe(total + 1);
});

test("closing Settings aborts a pending refresh without committing", async ({
  page,
}) => {
  let requests = 0;
  await page.route("https://explorer.lichess.ovh/**", async (route) => {
    requests++;
    await route.fulfill({ json: { white: 1, draws: 0, black: 0, moves: [] } });
  });
  await page.getByLabel("Lichess personal API token").fill("fake-cancel-token");
  await page
    .getByRole("button", { name: "Save Lichess token", exact: true })
    .click();
  await expect(
    page
      .getByRole("region", { name: "Lichess opening explorer" })
      .getByRole("status"),
  ).toHaveText("Lichess token saved.");
  await page.clock.install();
  await page
    .getByRole("button", {
      name: "Refresh reply weights from Lichess",
      exact: true,
    })
    .click();
  await expect(
    page
      .getByRole("region", { name: "Lichess opening explorer" })
      .getByRole("status"),
  ).toContainText("Refreshing 1/");
  await page
    .getByRole("button", { name: "Close settings", exact: true })
    .click();
  await page.clock.runFor(5000);
  expect(requests).toBe(1);
  await page
    .getByRole("button", { name: "Settings", exact: true })
    .first()
    .click();
  await page
    .getByRole("dialog")
    .getByText("Opening explorer", { exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Lichess opening explorer" }),
  ).toContainText("Using bundled reply estimates.");
});
