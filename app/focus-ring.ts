// Shared focus-ring classes (2026-09-24) — previously duplicated as a local
// `const focusRing` in most files that needed one.
//
// `focusRing` is for buttons and other non-field controls: a 2px `action`
// ring offset 2px outside the control's own border.
export const focusRing =
  "focus-visible:outline focus-visible:outline-2 " +
  "focus-visible:outline-offset-2 focus-visible:outline-action";

// `fieldFocusRing` is for text-entry fields only — inputs, textareas, the
// combobox, the date input. The default offset-2 ring draws a second box
// outside the field's own border, and a field is `:focus-visible` on
// ordinary mouse/tap focus too (unlike a button), so that second box was
// always visible, not just on keyboard focus. A negative offset pulls the
// same 2px `action` ring onto the field's border instead — a visibility fix,
// not a removal.
export const fieldFocusRing =
  "focus-visible:outline focus-visible:outline-2 " +
  "focus-visible:outline-offset-[-1px] focus-visible:outline-action";
