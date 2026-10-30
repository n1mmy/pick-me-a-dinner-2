import { expect, test } from "@playwright/test";
import { LOG } from "./fixture";
import { visit } from "./visit";

const NAME = "Lemon Chicken Traybake";

test("An eaten Option's detail page shows its name in Fraunces and lists its Log entries", async ({
  page,
}, testInfo) => {
  // The fixture's ids are generated, so the page is found by its Catalog link.
  await page.goto("/catalog");
  const href = await page.getByRole("link", { name: NAME, exact: true }).getAttribute("href");
  const history = page.locator("section", { has: page.getByRole("heading", { name: "History" }) });
  await visit(page, testInfo, { path: href!, screen: "option-detail", ready: history });

  const title = page.getByRole("heading", { level: 1 });
  await expect(title).toHaveText(NAME);
  expect(await title.evaluate((h1) => getComputedStyle(h1).fontFamily)).toMatch(/^["']?Fraunces/);

  const entries = LOG.filter((entry) => entry.name === NAME);
  await expect(history.getByRole("listitem")).toHaveCount(entries.length);
  for (const { note } of entries.filter((entry) => entry.note)) {
    await expect(history.getByText(note!)).toBeVisible();
  }
});
