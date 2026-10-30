import { expect, type Locator } from "@playwright/test";

/** The page background's relative luminance must sit under this to read as dark. */
const DARK_LUMINANCE = 0.05;

/**
 * The dark theme is on and legible: the page background is dark by
 * luminance, body text and the `h1` clear WCAG's 4.5:1 against what they sit
 * on, and `row`'s kind bar clears 3:1 against the row's own background.
 */
export async function expectDarkAndLegible(row: Locator): Promise<void> {
  const measured = await row.evaluate((rowElement) => {
    type Rgb = [number, number, number];
    const parse = (css: string): [...Rgb, number] => {
      const match = css.match(/^rgba?\(([^)]+)\)$/);
      if (!match) throw new Error(`Unparsed colour: ${css}`);
      const [r, g, b, a = 1] = match[1].split(/[\s,/]+/).filter(Boolean).map(Number);
      return [r, g, b, a];
    };
    // `top` laid over the opaque `bottom`.
    const over = (top: string, bottom: Rgb): Rgb => {
      const [r, g, b, a] = parse(top);
      return [r * a + bottom[0] * (1 - a), g * a + bottom[1] * (1 - a), b * a + bottom[2] * (1 - a)];
    };
    // What an element's content sits on: its own background, laid over its
    // ancestors' until one is opaque; white past the root.
    const backgroundOf = (element: Element | null): Rgb =>
      element === null
        ? [255, 255, 255]
        : over(getComputedStyle(element).backgroundColor, backgroundOf(element.parentElement));
    const luminance = ([r, g, b]: Rgb): number => {
      const channel = (c: number) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    };
    const contrast = (a: Rgb, b: Rgb): number => {
      const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (light + 0.05) / (dark + 0.05);
    };
    const against = (foreground: string, element: Element): number => {
      const background = backgroundOf(element);
      return contrast(over(foreground, background), background);
    };

    const h1 = document.querySelector("h1")!;
    return {
      pageLuminance: luminance(backgroundOf(document.body)),
      body: against(getComputedStyle(document.body).color, document.body),
      h1: against(getComputedStyle(h1).color, h1),
      kindBar: against(getComputedStyle(rowElement).borderLeftColor, rowElement),
    };
  });

  expect(measured.pageLuminance, "page background luminance").toBeLessThan(DARK_LUMINANCE);
  expect(measured.body, "body text contrast").toBeGreaterThanOrEqual(4.5);
  expect(measured.h1, "h1 contrast").toBeGreaterThanOrEqual(4.5);
  expect(measured.kindBar, "kind bar contrast").toBeGreaterThanOrEqual(3);
}
