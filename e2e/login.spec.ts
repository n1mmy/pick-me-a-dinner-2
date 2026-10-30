import { expect, test } from "@playwright/test";
import { visit } from "./visit";

test.use({ storageState: { cookies: [], origins: [] } });

test("Login shows the password field and its button", async ({ page }, testInfo) => {
  const password = page.getByLabel("Password");
  await visit(page, testInfo, { path: "/login", screen: "login", ready: password, nav: false });

  await expect(password).toBeVisible();
  await expect(page.getByRole("button", { name: "Enter" })).toBeVisible();

  // Login has no rail, so nothing offsets it: the h1 centres on the viewport.
  const box = await page.getByRole("heading", { level: 1 }).boundingBox();
  const width = page.viewportSize()?.width ?? 0;
  expect(Math.abs(box!.x + box!.width / 2 - width / 2)).toBeLessThanOrEqual(1);
});
