import { expect, type Page, test } from "@playwright/test";
import { expectDarkAndLegible } from "./contrast";
import { OPTIONS } from "./fixture";
import { visit } from "./visit";

/** A kind's section of the Catalog, found by its heading. */
function section(page: Page, title: string) {
  return page.locator("section", { has: page.getByRole("heading", { name: title }) });
}

// Catalog rows are untinted on plain `bg` (DESIGN.md, "Row lists"): kind is
// stated by the section an Option sits in and by the kind-hued add buttons.
test("Catalog lists every fixture Option under its kind", async ({ page }, testInfo) => {
  await visit(page, testInfo, { path: "/catalog", screen: "catalog" });

  for (const [kind, title] of [
    ["home", "Home meals"],
    ["restaurant", "Restaurants"],
  ] as const) {
    const names = OPTIONS.filter((option) => option.kind === kind).map((option) => option.name);
    const rows = section(page, title).getByRole("listitem");
    await expect(rows).toHaveCount(names.length);
    for (const name of names) {
      await expect(rows.getByRole("link", { name, exact: true })).toBeVisible();
    }
  }
});

test("Catalog is legible in the dark theme", { tag: "@dark" }, async ({ page }, testInfo) => {
  await visit(page, testInfo, { path: "/catalog", screen: "catalog" });

  await expectDarkAndLegible(
    page.getByRole("button", { name: /^Add a (meal|restaurant)$/ }),
    "fill",
  );
});
