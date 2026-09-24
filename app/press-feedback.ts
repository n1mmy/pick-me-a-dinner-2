// Shared press-feedback class (P8, 2026-09-24) — filled buttons only (Tonight
// Pick, AI Search, the Catalog add buttons, form submits). A `background-color`
// transition was already on every one of these; this adds a matched-duration
// `transform` so a tap reads as a press, not just a color swap. Outlined and
// text buttons don't get this — see DESIGN.md Motion.
export const pressFeedback =
  "transition-[background-color,transform] duration-micro ease-enter " +
  "active:scale-[0.98] motion-reduce:transition-colors motion-reduce:active:scale-100";
