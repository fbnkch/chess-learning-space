import { expect, test } from "@playwright/test";
test("two browser contexts sync a quiz review through an encrypted, mocked endpoint", async ({
  browser,
  baseURL,
}, info) => {
  const a = await browser.newContext(),
    b = await browser.newContext();
  let cloud: Buffer | undefined;
  let etag = '"0"';
  let auth = "";
  let uploads = 0;
  const methods: string[] = [];
  for (const context of [a, b]) {
    // Prevent every external request. Only local app assets and the in-memory API can be accessed.
    await context.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin !== new URL(baseURL!).origin) return route.abort();
      if (url.pathname !== "/api/sync") return route.continue();
      methods.push(request.method());
      const token = request.headers().authorization;
      if (
        !/^Bearer [A-Za-z0-9_-]{43}$/.test(token ?? "") ||
        (auth && token !== auth)
      )
        return route.fulfill({ status: 401 });
      auth = token;
      if (request.method() === "GET")
        return route.fulfill(
          cloud
            ? { status: 200, body: cloud, headers: { ETag: etag } }
            : { status: 404 },
        );
      if (request.method() === "DELETE") {
        cloud = undefined;
        return route.fulfill({ status: 204 });
      }
      const body = request.postDataBuffer()!;
      if (body.length > 4_000_000) return route.fulfill({ status: 413 });
      if (
        cloud
          ? request.headers()["if-match"] !== etag
          : request.headers()["x-create-if-absent"] !== "1"
      )
        return route.fulfill({ status: 412 });
      cloud = body;
      etag = `"${++uploads}"`;
      return route.fulfill({ status: 200, headers: { ETag: etag } });
    });
  }
  const pa = await a.newPage(),
    pb = await b.newPage();
  await pa.goto(`${baseURL}/#rules-quiz`);
  await pa.getByLabel("Quiz rules").selectOption("castle-early");
  await pa.getByRole("button", { name: "Castle early", exact: true }).click();
  await expect(pa.getByRole("button", { name: "See results" })).toBeEnabled();
  await pa.getByRole("button", { name: "Settings", exact: true }).click();
  await pa.getByRole("dialog").getByText("Cloud sync", { exact: true }).click();
  const panelA = pa.getByRole("region", { name: "Cross-device sync" });
  await panelA.getByRole("button", { name: "Create sync code" }).click();
  await expect(panelA.getByRole("status")).toContainText("Synced");
  expect(cloud!.subarray(0, 5).toString("hex")).toBe("434c535901");
  expect(cloud!.includes(Buffer.from("reviewLog"))).toBe(false);
  const code = await panelA.getByLabel("Your sync code").inputValue();
  expect(await panelA.getByLabel("Your sync code").getAttribute("type")).toBe(
    "password",
  );
  await pb.goto(`${baseURL}/#rules`);
  await pb.locator(".all-rules > summary").click();
  await pb.getByRole("button", { name: "Settings", exact: true }).click();
  await pb.getByRole("dialog").getByText("Cloud sync", { exact: true }).click();
  const panelB = pb.getByRole("region", { name: "Cross-device sync" });
  await panelB.getByLabel("Sync code from another device").fill(code);
  await panelB.getByRole("button", { name: "Enter sync code" }).click();
  await expect(panelB.getByRole("status")).toContainText("Synced");
  await panelA.getByRole("button", { name: "Sync now" }).click();
  await expect(panelA.getByRole("status")).toContainText("Synced");
  await pb.getByRole("button", { name: "Close settings" }).click();
  await expect(
    pb
      .getByTestId("rule-castle-early")
      .getByRole("button", { name: /^Mark .* as learned$/ }),
  ).toHaveAttribute("aria-pressed", "true");
  await pb.reload();
  await pb.locator(".all-rules > summary").click();
  await expect(
    pb
      .getByTestId("rule-castle-early")
      .getByRole("button", { name: /^Mark .* as learned$/ }),
  ).toHaveAttribute("aria-pressed", "true");
  await pb.getByRole("button", { name: "Settings", exact: true }).click();
  await pb.getByRole("dialog").getByText("Cloud sync", { exact: true }).click();
  await panelB.getByRole("button", { name: "Reveal code" }).click();
  await expect(panelB.getByLabel("Your sync code")).toHaveAttribute(
    "type",
    "text",
  );
  await panelB.getByRole("button", { name: "Hide code" }).click();
  // Replace through the public Progress interface; the live engine observes another connection.
  async function replaceWithEmptyProgress() {
    await pb.evaluate(async () => {
      const progressModule = "/src/progress/Progress.ts";
      const { openProgress } = await import(progressModule);
      const store = await openProgress();
      const data = await store.snapshot();
      data.reviewLog = [];
      data.ruleState = [];
      await store.restore(data, "replace", Date.now());
      store.close();
    });
  }
  await replaceWithEmptyProgress();
  await expect(panelB.getByRole("status")).toContainText("Paused");
  await expect(
    panelB.getByRole("button", { name: "Sync now", exact: true }),
  ).toBeDisabled();
  const beforeReload = methods.length;
  await pb.reload();
  await pb.locator(".all-rules > summary").click();
  await pb.getByRole("button", { name: "Settings", exact: true }).click();
  await pb.getByRole("dialog").getByText("Cloud sync", { exact: true }).click();
  await expect(panelB.getByRole("status")).toContainText("Paused");
  expect(methods.length).toBe(beforeReload);
  await expect(panelB).toContainText("may bring back data you just removed");
  await panelB
    .getByRole("button", { name: "Resume and merge cloud data", exact: true })
    .click();
  await expect(panelB.getByRole("status")).toContainText("Synced");
  await pb.getByRole("button", { name: "Close settings" }).click();
  await expect(
    pb
      .getByTestId("rule-castle-early")
      .getByRole("button", { name: /^Mark .* as learned$/ }),
  ).toHaveAttribute("aria-pressed", "true");
  await pb.getByRole("button", { name: "Settings", exact: true }).click();
  await pb.getByRole("dialog").getByText("Cloud sync", { exact: true }).click();
  await replaceWithEmptyProgress();
  await expect(panelB.getByRole("status")).toContainText("Paused");
  const beforeChoice = methods.length;
  await panelB
    .getByRole("button", {
      name: "Delete cloud copy and upload this device",
      exact: true,
    })
    .click();
  expect(methods.length).toBe(beforeChoice);
  await panelB.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(panelB.getByRole("status")).toContainText("Paused");
  await panelB
    .getByRole("button", {
      name: "Delete cloud copy and upload this device",
      exact: true,
    })
    .click();
  await panelB
    .getByRole("button", {
      name: "Confirm delete and upload this device",
      exact: true,
    })
    .click();
  await expect(panelB.getByRole("status")).toContainText("Synced");
  expect(methods.slice(beforeChoice)).toEqual(["DELETE", "PUT"]);
  await pb.screenshot({
    path: info.outputPath("sync-settings.png"),
    fullPage: true,
  });
  await panelB
    .getByRole("button", { name: "Delete cloud copy", exact: true })
    .click();
  await expect(
    panelB.getByRole("button", { name: "Confirm delete cloud copy" }),
  ).toBeVisible();
  await panelB.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(cloud).toBeDefined();
  await panelB.getByRole("button", { name: "Turn off", exact: true }).click();
  await expect(panelB.getByRole("status")).toHaveText("Off");
  expect(cloud).toBeDefined();
  await a.close();
  await b.close();
});
