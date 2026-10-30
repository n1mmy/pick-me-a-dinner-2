import { join } from "node:path";
import { expect, type Page, type TestInfo } from "@playwright/test";

/** The width at which the bottom tab bar gives way to the left rail (DESIGN.md). */
const DESKTOP_MIN_WIDTH = 720;

/** The faces the built CSS registers: Geist's are `GeistSans` and `GeistMono`, not `Geist`. */
const FACES = ["Fraunces", "GeistSans", "GeistMono"];

/**
 * Visit `path` and run the checks every screen shares: a 2xx response and a
 * visible `h1`; the web fonts loaded and in use; nothing past the right edge;
 * the nav that fits the width (none on Login); a viewport screenshot to
 * `e2e/screenshots/<screen>-<project>.png`; and, last, no console error or
 * uncaught exception since the visit began. Screen-specific assertions follow
 * in the spec.
 */
export async function visit(
  page: Page,
  testInfo: TestInfo,
  { path, screen, nav = true }: { path: string; screen: string; nav?: boolean },
): Promise<void> {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`exception: ${error.message}`));

  const response = await page.goto(path);
  expect(response?.ok(), `${path} responded ${response?.status()}`).toBe(true);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  await expectFontsLoaded(page);
  await expectNoOverflow(page);
  await expectNav(page, nav);

  await page.screenshot({
    path: join(testInfo.project.testDir, "screenshots", `${screen}-${testInfo.project.name}.png`),
  });
  expect(errors, "console errors and page exceptions").toEqual([]);
}

/**
 * Each face has a FontFace whose status is `loaded`, and the `h1` and body
 * compute to the display and body faces. Not `document.fonts.check`: it
 * returns true when no face matches the name at all, so a typo would pass.
 * Each face is asked for first, since a screen with no numerals (Login) never
 * fetches Geist Mono; a misnamed face still has no FontFace, and a missing
 * file reads `error`.
 */
async function expectFontsLoaded(page: Page): Promise<void> {
  const faces = await page.evaluate(async (families) => {
    await Promise.allSettled(families.map((family) => document.fonts.load(`1em "${family}"`)));
    await document.fonts.ready;
    return [...document.fonts].map((face) => ({
      family: face.family.replace(/^["']|["']$/g, ""),
      status: face.status,
    }));
  }, FACES);
  for (const family of FACES) {
    expect(
      faces.filter((face) => face.family === family).map((face) => face.status),
      `${family} FontFace statuses`,
    ).toContain("loaded");
  }

  const families = await page.evaluate(() => ({
    h1: getComputedStyle(document.querySelector("h1")!).fontFamily,
    body: getComputedStyle(document.body).fontFamily,
  }));
  expect(families.h1, "h1 font-family").toMatch(/^["']?Fraunces/);
  expect(families.body, "body font-family").toMatch(/^["']?GeistSans/);
}

/**
 * No horizontal scroll on the document, and no visible element whose box
 * reaches past the viewport's right edge.
 */
async function expectNoOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    const edge = root.clientWidth;
    const offenders = [...document.body.querySelectorAll("*")]
      .filter((element) => {
        const box = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return (
          box.width > 0 &&
          box.height > 0 &&
          style.visibility !== "hidden" &&
          box.right > edge + 0.5
        );
      })
      .map((element) => {
        const id = element.id ? `#${element.id}` : "";
        const text = (element.textContent ?? "").trim().slice(0, 40);
        return `${element.tagName.toLowerCase()}${id} right=${Math.round(element.getBoundingClientRect().right)} "${text}"`;
      });
    return { scrollWidth: root.scrollWidth, clientWidth: edge, offenders };
  });
  expect(overflow.scrollWidth, "document scroll width").toBeLessThanOrEqual(
    overflow.clientWidth,
  );
  expect(overflow.offenders, `elements past the right edge (${overflow.clientWidth}px)`).toEqual([]);
}

/**
 * The bottom tab bar under 720px — full width, flush with the bottom — and the
 * left rail at or above it — flush left, full height. Login has no nav.
 */
async function expectNav(page: Page, nav: boolean): Promise<void> {
  const primary = page.getByRole("navigation", { name: "Primary" });
  if (!nav) {
    await expect(primary).toHaveCount(0);
    return;
  }
  const viewport = page.viewportSize()!;
  const box = (await primary.boundingBox())!;
  expect(box, "the Primary nav's box").not.toBeNull();
  if (viewport.width < DESKTOP_MIN_WIDTH) {
    expect(box.width, "tab bar width").toBeCloseTo(viewport.width, 0);
    expect(box.y + box.height, "tab bar bottom").toBeCloseTo(viewport.height, 0);
  } else {
    expect(box.x, "rail left").toBe(0);
    expect(box.height, "rail height").toBeCloseTo(viewport.height, 0);
    expect(box.width, "rail width").toBeLessThan(viewport.width / 3);
  }
}
