import { expect, test as setup } from "@playwright/test";
import { APP_PASSWORD, STORAGE_STATE } from "./server-env";

setup("log in through the Login form", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Password").fill(APP_PASSWORD);
  await page.getByRole("button", { name: "Enter" }).click();
  await expect(page).toHaveURL("/");
  await page.context().storageState({ path: STORAGE_STATE });
});
