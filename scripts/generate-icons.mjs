// Regenerates the home-screen install icons under `public/icons/`.
//
// The mark is a solid white fork-and-knife on a two-tone field split by a
// single offset diagonal seam — deep teal `kind-home` (#2c6e6e) meeting muted
// plum `kind-restaurant` (#7a4f6b) — see DESIGN.md "App icon". The split nods
// to the app's home-cooked-vs-restaurant duality; the cutlery reads as
// "dinner" at a glance.
//
// The cutlery silhouette is the one from the approved O1 design-shotgun mockup,
// traced to the vector path in `scripts/o1-cutlery-path.json` by
// `scripts/trace-png.mjs`. Here it is just placed on a clean full-bleed field and
// rasterized with Next's bundled `next/og` ImageResponse (Satori + a WASM
// rasterizer) — no system image tools, no web-font download. The whole icon
// rides in as one data-URI <img> SVG over a gradient-field <div>.
//
// To redo the trace (only if the mark is redesigned), run the approved mockup
// PNG through the one-off helper, which rewrites o1-cutlery-path.json:
//   pnpm add -D potrace pngjs
//   node scripts/trace-png.mjs /path/to/new-mockup.png
//   pnpm remove potrace pngjs
//   node scripts/generate-icons.mjs
//
// Run after changing the mark:  node scripts/generate-icons.mjs
// The PNGs are committed; this script is dev-time only.

import { ImageResponse } from "next/og.js";
import { createElement as h } from "react";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const TEAL = "#2c6e6e"; // DESIGN.md `kind-home`
const PLUM = "#7a4f6b"; // DESIGN.md `kind-restaurant`
const INK = "#ffffff"; // white cutlery
const VB = 512; // SVG view-box; the <img> scales it to each target size

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(HERE, "../public/icons");

// The dividing line is a feathered diagonal gradient rather than a hard
// polygon edge, so the near-vertical seam renders as a clean anti-aliased line
// instead of a faint staircase. The 49.6%→50.4% band is a ~4px blend at 512px;
// the 94deg angle gives the subtle near-vertical lean (top a touch right of
// bottom), and the seam still clears every corner.
const SEAM = `linear-gradient(94deg, ${TEAL} 0%, ${TEAL} 49.6%, ${PLUM} 50.4%, ${PLUM} 100%)`;

// Cutlery silhouette traced from the approved O1 mockup, in source-pixel space.
const { d: RAW_D, bbox } = JSON.parse(
  await readFile(resolve(HERE, "o1-cutlery-path.json"), "utf8"),
);

// A transparent SVG carrying just the cutlery, scaled to `heightFrac` of the
// tile and centred at (cx, cy); it layers over the gradient field. The traced
// path is all absolute M/L/C commands, so its numbers alternate x, y — apply
// the affine to every coordinate in order.
function cutlerySvg(heightFrac, cx, cy) {
  const scale = (VB * heightFrac) / bbox.h;
  const tx = cx - (bbox.x + bbox.w / 2) * scale;
  const ty = cy - (bbox.y + bbox.h / 2) * scale;
  let k = 0;
  const d = RAW_D.replace(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi, (m) => {
    const v = parseFloat(m);
    return (k++ % 2 === 0 ? tx + scale * v : ty + scale * v).toFixed(2);
  });
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${VB}" height="${VB}" ` +
    `viewBox="0 0 ${VB} ${VB}"><path d="${d}" fill="${INK}"/></svg>`
  );
}

function render(size, heightFrac, cx, cy) {
  const src =
    "data:image/svg+xml;base64," +
    Buffer.from(cutlerySvg(heightFrac, cx, cy)).toString("base64");
  const el = h(
    "div",
    {
      style: {
        display: "flex",
        width: "100%",
        height: "100%",
        backgroundImage: SEAM,
      },
    },
    h("img", { src, width: size, height: size }),
  );
  return new ImageResponse(el, { width: size, height: size });
}

// `any` icons fill the tile; the maskable variant pulls the cutlery into the
// inner safe zone (Android crops to a circle/squircle) while the field bleeds.
const CX = 250;
const CY = 256;
const TARGETS = [
  { file: "icon-192.png", size: 192, frac: 0.66 },
  { file: "icon-512.png", size: 512, frac: 0.66 },
  { file: "icon-maskable-512.png", size: 512, frac: 0.5 },
  { file: "apple-touch-icon.png", size: 180, frac: 0.66 },
];

await mkdir(OUT_DIR, { recursive: true });
for (const t of TARGETS) {
  const buf = Buffer.from(await render(t.size, t.frac, CX, CY).arrayBuffer());
  await writeFile(resolve(OUT_DIR, t.file), buf);
  console.log(`wrote ${t.file} (${buf.length} bytes)`);
}
