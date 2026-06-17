// Regenerates the home-screen install icons under `public/icons/`.
//
// The mark is a white Fraunces "D" on the violet `accent` field (#6d4ed6) —
// see DESIGN.md "App icon". Rendered with Next's bundled `next/og`
// ImageResponse (Satori + a WASM rasterizer), so it needs no system image
// tools. Satori can't parse a variable font, so we ask the Google Fonts API
// for weight 600 — which it serves as a pre-instantiated static TTF (Satori
// needs TTF/OTF, and the default request returns `format('truetype')`).
//
// Run after changing the mark:  node scripts/generate-icons.mjs
// The PNGs are committed; this script is dev-time only and hits the network.

import { ImageResponse } from "next/og.js";
import { createElement as h } from "react";
import { writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const FIELD = "#6d4ed6"; // DESIGN.md `accent`
const INK = "#ffffff"; // DESIGN.md `accent-ink`
const OUT_DIR = resolve("public/icons");

const FRAUNCES_CSS =
  "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&display=swap";

async function loadFraunces() {
  const css = await fetch(FRAUNCES_CSS).then((r) => r.text());
  const match = css.match(/src:\s*url\((https:\/\/[^)]+\.ttf)\)/);
  if (!match) throw new Error("Could not find a Fraunces TTF url in the Google Fonts CSS");
  const ttf = await fetch(match[1]).then((r) => r.arrayBuffer());
  const sig = Buffer.from(ttf).subarray(0, 4).toString("hex");
  if (sig !== "00010000" && sig !== "4f54544f") {
    throw new Error(`Fraunces download is not a TTF/OTF (signature ${sig})`);
  }
  return ttf;
}

function render(size, glyphRatio, fontData) {
  const glyph = h(
    "div",
    {
      style: {
        fontFamily: "Fraunces",
        fontWeight: 600,
        fontSize: Math.round(size * glyphRatio),
        color: INK,
        lineHeight: 1,
        display: "flex",
      },
    },
    "D",
  );
  const field = h(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: FIELD,
      },
    },
    glyph,
  );
  return new ImageResponse(field, {
    width: size,
    height: size,
    fonts: [{ name: "Fraunces", data: fontData, weight: 600, style: "normal" }],
  });
}

// `any` icons fill the tile; the maskable variant pulls the glyph into the
// inner safe zone (Android crops to a circle/squircle).
const TARGETS = [
  { file: "icon-192.png", size: 192, ratio: 0.62 },
  { file: "icon-512.png", size: 512, ratio: 0.62 },
  { file: "icon-maskable-512.png", size: 512, ratio: 0.46 },
  { file: "apple-touch-icon.png", size: 180, ratio: 0.62 },
];

const fontData = await loadFraunces();
await mkdir(OUT_DIR, { recursive: true });
for (const t of TARGETS) {
  const buf = Buffer.from(await render(t.size, t.ratio, fontData).arrayBuffer());
  await writeFile(resolve(OUT_DIR, t.file), buf);
  console.log(`wrote ${t.file} (${buf.length} bytes)`);
}
