import { expect, test } from "@playwright/test";
import { LOG, PLANNED } from "./fixture";
import { visit } from "./visit";

test("The Log lists the fixture's entries newest first", async ({ page }, testInfo) => {
  const rows = page.getByRole("main").getByRole("listitem");
  await visit(page, testInfo, { path: "/log", screen: "log", ready: rows.first() });

  // Tomorrow's Planned dinner heads the list, then the past, most recent first.
  const newestFirst = [
    PLANNED.name,
    ...[...LOG].sort((a, b) => a.daysAgo - b.daysAgo).map((entry) => entry.name),
  ];
  await expect(rows).toHaveCount(newestFirst.length);
  const names = await rows.evaluateAll((items) =>
    items.map((item) => item.querySelector("a")?.textContent),
  );
  expect(names).toEqual(newestFirst);

  // Every entry row carries the 3px kind bar over its wash (DESIGN.md, "Two
  // color channels").
  const bars = await rows.evaluateAll((items) =>
    items.map((item) => getComputedStyle(item).borderLeftWidth),
  );
  expect(bars).toEqual(newestFirst.map(() => "3px"));
});
