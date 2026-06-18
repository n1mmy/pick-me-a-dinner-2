// One-off: extracts the fork+knife silhouette from the approved O1 design
// mockup and traces it to the vector path baked in `scripts/o1-cutlery-path.json`
// (which `generate-icons.mjs` reads). Only needed if the source mockup changes.
//
// How it works: decode the PNG, keep pixels with r,g,b all > 180 (the white
// cutlery AND the outer margin/corners), flood-fill from the border to drop the
// margin, then potrace the surviving silhouette. The `d` it writes is in
// source-pixel space; generate-icons.mjs affine-transforms it onto the 512 tile.
//
// It is not part of the regular icon build, so its deps are not kept in
// package.json — install them first, then run with the mockup PNG path:
//   pnpm add -D potrace pngjs
//   node scripts/trace-png.mjs /path/to/variant-O1.png
//   pnpm remove potrace pngjs

import { readFileSync, writeFileSync } from "node:fs";
import { PNG } from "pngjs";
import potrace from "potrace";

const SRC = process.argv[2];
if (!SRC) {
  console.error("usage: node scripts/trace-png.mjs <mockup.png>");
  process.exit(1);
}

const png = PNG.sync.read(readFileSync(SRC));
const { width: W, height: H, data } = png;
const idx = (x, y) => (y * W + x) * 4;

// White-ish = the cutlery AND the outer margin/corners.
const white = new Uint8Array(W * H);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = idx(x, y);
    white[y * W + x] =
      data[i] > 180 && data[i + 1] > 180 && data[i + 2] > 180 ? 1 : 0;
  }
}

// Flood-fill every white-ish pixel reachable from the border → that's the
// margin (and the rounded-corner notches). Whatever white survives is cutlery.
const margin = new Uint8Array(W * H);
const stack = [];
for (let x = 0; x < W; x++) {
  stack.push([x, 0], [x, H - 1]);
}
for (let y = 0; y < H; y++) {
  stack.push([0, y], [W - 1, y]);
}
while (stack.length) {
  const [x, y] = stack.pop();
  if (x < 0 || y < 0 || x >= W || y >= H) continue;
  const k = y * W + x;
  if (margin[k] || !white[k]) continue;
  margin[k] = 1;
  stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
}

// Cutlery mask + bbox, write a clean black-on-white bitmap for potrace.
const out = new PNG({ width: W, height: H });
let minX = W, minY = H, maxX = 0, maxY = 0, count = 0;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const k = y * W + x;
    const cut = white[k] && !margin[k];
    const o = idx(x, y);
    const v = cut ? 0 : 255; // cutlery black, rest white
    out.data[o] = out.data[o + 1] = out.data[o + 2] = v;
    out.data[o + 3] = 255;
    if (cut) {
      count++;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
}
const bmp = PNG.sync.write(out);
writeFileSync("/tmp/cutlery-bw.png", bmp);
console.error(`image ${W}x${H}, cutlery px=${count}, bbox x${minX}..${maxX} y${minY}..${maxY}`);

const trace = new potrace.Potrace({
  turdSize: 60,
  optCurve: true,
  alphaMax: 1,
  optTolerance: 0.2,
  threshold: 128,
  blackOnWhite: true,
});
trace.loadImage(bmp, (err) => {
  if (err) throw err;
  const d = trace.getPathTag().match(/ d="([^"]*)"/)[1];
  const result = {
    d,
    bbox: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 },
    source: { w: W, h: H },
  };
  writeFileSync("scripts/o1-cutlery-path.json", JSON.stringify(result, null, 2));
  console.error(`path length ${d.length}; wrote scripts/o1-cutlery-path.json`);
});
