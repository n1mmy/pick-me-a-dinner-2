import { expect, test } from "@playwright/test";
import { visit } from "./visit";

test.use({ storageState: { cookies: [], origins: [] } });

test("Login shows the password field and its button", async ({ page }, testInfo) => {
  await visit(page, testInfo, { path: "/login", screen: "login", nav: false });

  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Enter" })).toBeVisible();
});
