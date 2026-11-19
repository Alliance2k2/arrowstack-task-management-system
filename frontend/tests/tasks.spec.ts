import { test, expect, type Page } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
const url = process.env.TEST_DATABASE_URL;
if (
  !url ||
  !["localhost", "127.0.0.1"].includes(new URL(url).hostname) ||
  !new URL(url).pathname.endsWith("_test")
)
  throw new Error("Isolated test DB required");
async function account(page: Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Create an account", exact: true })
    .click();
  await page.getByLabel("Name", { exact: true }).fill("Task Learner");
  await page
    .getByLabel("Email", { exact: true })
    .fill(`task-${randomBytes(8).toString("hex")}@example.test`);
  await page
    .getByLabel("Password", { exact: true })
    .fill(randomBytes(24).toString("hex"));
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Hello, Task Learner" }),
  ).toBeVisible();
}
test("register, persist, filter, edit and delete a task then sign out", async ({
  page,
}) => {
  await account(page);
  await page.getByLabel("Title", { exact: true }).fill("Submit internship");
  await page
    .getByLabel("Description", { exact: true })
    .fill("Check the evidence");
  await page
    .getByRole("combobox", { name: "Priority", exact: true })
    .selectOption("HIGH");
  await page.getByLabel("Deadline (UTC)", { exact: true }).fill("2026-01-01");
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Submit internship", exact: true }),
  ).toBeVisible();
  mkdirSync(fileURLToPath(new URL("../../docs/evidence/", import.meta.url)), {
    recursive: true,
  });
  await page.screenshot({
    path: fileURLToPath(
      new URL("../../docs/evidence/task-workflow-desktop.png", import.meta.url),
    ),
    fullPage: true,
  });
  await page.setViewportSize({ width: 375, height: 900 });
  await page.screenshot({
    path: fileURLToPath(
      new URL("../../docs/evidence/task-workflow-mobile.png", import.meta.url),
    ),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Submit internship", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.length + sessionStorage.length),
  ).toBe(0);
  await page
    .getByRole("combobox", { name: "Filter status", exact: true })
    .selectOption("DONE");
  await expect(
    page.getByText("No tasks match.", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Filter status", exact: true })
    .selectOption("");
  await page.getByLabel("Search", { exact: true }).fill("internship");
  await page
    .getByRole("button", { name: "Edit Submit internship", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Status", exact: true })
    .selectOption("DONE");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.locator(".tags").getByText("DONE", { exact: true }),
  ).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Delete Submit internship", exact: true })
    .click();
  await expect(
    page.getByText("No tasks match.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
});
test("responsive task interface and keyboard focus", async ({ page }) => {
  await account(page);
  for (const width of [375, 768, 1280, 1536]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(
      page.getByRole("button", { name: "Add task", exact: true }),
    ).toBeVisible();
  }
  await page.getByLabel("Title", { exact: true }).focus();
  await expect(page.getByLabel("Title", { exact: true })).toBeFocused();
});
test("server outage is explained and retry works", async ({ page }) => {
  await account(page);
  await page.route("**/api/v1/tasks", (route) => route.abort());
  await page.getByLabel("Title", { exact: true }).fill("Retry this");
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Unable to reach");
  await page.unroute("**/api/v1/tasks");
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Retry this", exact: true }),
  ).toBeVisible();
});

test("initial offline state is explained", async ({ page }) => {
  await page.route("**/api/v1/users/me", (route) => route.abort());
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("Unable to reach");
});
test("expired session clears task UI and returns to sign in", async ({
  page,
}) => {
  await account(page);
  await page.route("**/api/v1/auth/refresh", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ error: { message: "Expired" } }),
    }),
  );
  await page.route("**/api/v1/tasks?*", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ error: { message: "Expired" } }),
    }),
  );
  await page.getByLabel("Search", { exact: true }).fill("trigger");
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Your tasks", exact: false }),
  ).toHaveCount(0);
});
