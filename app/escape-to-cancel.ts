import type { KeyboardEvent } from "react";

/**
 * Escape collapses an inline add/edit form the same way its own Cancel
 * button does — attached to the `<form>`, not each field, so it fires from
 * any text box (or anywhere else) inside it. Skipped when something nested
 * already claimed the key (an open Option/Tag dropdown's own Escape handler
 * calls `preventDefault` to just close itself first — the first Escape
 * closes that, the next one cancels the form) or while a submit is in
 * flight, matching the Cancel button's own `disabled={pending}`.
 */
export function escapeToCancel(onCancel: () => void, pending: boolean) {
  return (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key !== "Escape" || event.defaultPrevented || pending) return;
    onCancel();
  };
}
