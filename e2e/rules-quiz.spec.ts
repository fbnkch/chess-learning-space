import { expect, test } from "@playwright/test";

test("answers two-choice questions, logs success and failure, and keeps learned progress after reload", async ({
  page,
}) => {
  await page.goto("/#rules");
  await page.getByRole("link", { name: "Take the Golden Rules quiz" }).click();
  await page.getByLabel("Quiz rules").selectOption("castle-early");
  await expect(page.locator("cg-board")).toBeVisible();
  const question = page.getByRole("region", {
    name: "Rule question",
    exact: true,
  });
  const correct = question.getByRole("button", {
    name: "Castle early",
    exact: true,
  });
  await expect(correct).toBeEnabled();
  await correct.click();
  await expect(question.getByRole("status")).toContainText("Correct");
  await expect(question.getByRole("status")).toContainText("Exception:");
  await expect(question.getByRole("status")).toContainText(
    "O-O moves the king and rook; neither white knight is on the rim.",
  );
  await question.getByRole("button", { name: "See results" }).click();
  await expect(
    page.getByRole("region", { name: "Quiz results" }),
  ).toContainText("1 / 1 correct");
  await page.getByRole("button", { name: "Try again" }).click();
  await question
    .locator(".quiz-choices button")
    .filter({ hasNotText: "Castle early" })
    .click();
  await expect(question.getByRole("status")).toContainText("Not quite");
  await question.getByRole("button", { name: "See results" }).click();
  await expect(
    page.getByRole("region", { name: "Quiz results" }),
  ).toContainText("0 / 1 correct");
  await page.goto("/#rules");
  await page.reload();
  await page.locator(".all-rules > summary").click();
  await expect(
    page
      .getByTestId("rule-castle-early")
      .getByRole("button", { name: /^Mark .* as learned$/ }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.goto("/#home");
  await page
    .getByLabel("Progress dashboard", { exact: true })
    .locator("summary")
    .first()
    .click();
  await expect(
    page.getByRole("link", { name: "Take the Golden Rules quiz" }),
  ).toBeVisible();
  await expect(page.getByText("1 / 42", { exact: true })).toBeVisible();
});

test("failed quiz writes retry the same attempt and fit a mobile viewport", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#rules-quiz");
  await page.getByLabel("Quiz rules").selectOption("castle-early");
  const correct = page.getByRole("button", {
    name: "Castle early",
    exact: true,
  });
  await expect(correct).toBeEnabled();
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.add;
    let fail = true;
    IDBObjectStore.prototype.add = function (
      ...args: Parameters<IDBObjectStore["add"]>
    ) {
      if (this.name === "reviewLog" && fail) {
        fail = false;
        throw new DOMException("Quota", "QuotaExceededError");
      }
      return original.apply(this, args);
    };
  });
  await correct.click();
  await expect(page.getByRole("alert")).toContainText(
    "Could not save your answer",
  );
  await expect(
    page.getByRole("button", { name: "See results" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Retry save" }).click();
  await expect(page.getByRole("button", { name: "See results" })).toBeEnabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("quiz-mobile.png"),
    fullPage: true,
  });
});
