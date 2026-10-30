import { expect, test } from "@playwright/test";
import { LOG, PLANNED } from "./fixture";
import { visit } from "./visit";

test("The Log lists the fixture's entries newest first", async ({ page }, testInfo) => {
  await visit(page, testInfo, { path: "/log", screen: "log" });

  // Tomorrow's Planned dinner heads the list, then the past, most recent first.
  const newestFirst = [
    PLANNED.name,
    ...[...LOG].sort((a, b) => a.daysAgo - b.daysAgo).map((entry) => entry.name),
  ];
  const rows = page.getByRole("main").getByRole("listitem");
  await expect(rows).toHaveCount(newestFirst.length);
  const names = await rows.evaluateAll((items) =>
    items.map((item) => item.querySelector("a")?.textContent),
  );
  expect(names).toEqual(newestFirst);
});
