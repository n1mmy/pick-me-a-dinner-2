import { expect, test } from "@playwright/test";
import { visit } from "./visit";

test.use({ storageState: { cookies: [], origins: [] } });

test("Login shows the password field and its button", async ({ page }, testInfo) => {
  const password = page.getByLabel("Password");
  await visit(page, testInfo, { path: "/login", screen: "login", ready: password, nav: false });

  await expect(password).toBeVisible();
  await expect(page.getByRole("button", { name: "Enter" })).toBeVisible();
});
