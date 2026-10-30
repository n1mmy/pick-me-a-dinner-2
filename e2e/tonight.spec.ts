import { expect, test } from "@playwright/test";
import { expectDarkAndLegible } from "./contrast";
import { DAY_NOTE, PLANNED, TODAY_BRIEF, TODAY_RANKING, TOMORROW_BRIEF } from "./fixture";
import { householdDay } from "./server-env";
import { visit } from "./visit";

test("Tonight today shows the brief, the first row's rationale, and the Day note, with no AI search", async ({
  page,
}, testInfo) => {
  await visit(page, testInfo, { path: "/", screen: "tonight-today" });

  const brief = page.getByRole("region", { name: "Prepared note" });
  await expect(brief).toBeVisible();
  await expect(brief).toContainText(TODAY_BRIEF);

  const [firstName, firstReason] = TODAY_RANKING[0];
  const firstRow = page.locator("ol").first().getByRole("listitem").first();
  await expect(firstRow).toContainText(firstName);
  await expect(firstRow.getByText(firstReason)).toBeVisible();

  await expect(page.getByText(DAY_NOTE)).toBeVisible();
  // With every key blank the search box is absent entirely.
  await expect(page.getByLabel("Find a dinner by name, or describe a craving")).toHaveCount(0);
});

test("Tonight tomorrow shows the Planned dinner decided, with the brief beneath it", async ({
  page,
}, testInfo) => {
  await visit(page, testInfo, { path: `/?day=${householdDay(1)}`, screen: "tonight-tomorrow" });

  const decided = page.getByRole("region", { name: /'s dinner$/ });
  await expect(decided).toContainText(PLANNED.name);
  const brief = page.getByRole("region", { name: "Prepared note" });
  await expect(brief).toContainText(TOMORROW_BRIEF);

  const decidedBox = (await decided.boundingBox())!;
  const briefBox = (await brief.boundingBox())!;
  expect(briefBox.y, "the brief's top").toBeGreaterThanOrEqual(decidedBox.y + decidedBox.height);
});

test("Tonight today is legible in the dark theme", { tag: "@dark" }, async ({ page }, testInfo) => {
  await visit(page, testInfo, { path: "/", screen: "tonight-today" });

  await expectDarkAndLegible(page.locator("ol").first().getByRole("listitem").first(), "bar");
});
