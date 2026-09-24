"use client";

import { useState, useTransition } from "react";
import { focusRing } from "./focus-ring";
import { pickTonight } from "./log/actions";

/**
 * The Pick button — logs the Option as tonight's dinner (`pick = log`, the
 * same write the Tonight rows carry). Briefly flips to "Logged ✓" on success;
 * a write failure — e.g. the Option was deleted out from under the row —
 * shows inline below the button rather than flashing a false "Logged ✓".
 *
 * Used on the Log, Catalog, and Option detail rows so any Option can be
 * picked for tonight without a trip back to the Tonight screen. It is the
 * secondary (outlined) style: Tonight's ranked rows are the one place Pick is
 * filled `action`, and they render their own inline button rather than this
 * component — see DESIGN.md's Layout/Color section.
 */
export function PickButton({ optionId }: { optionId: string }) {
  const [justLogged, setJustLogged] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function pick() {
    setPickError(null);
    startTransition(async () => {
      const result = await pickTonight(optionId);
      if (!result.ok) {
        setPickError(result.error);
        return;
      }
      // Hold "Logged ✓" briefly; the revalidation refreshes the screens under it.
      setJustLogged(true);
      window.setTimeout(() => setJustLogged(false), 1600);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={pick}
        disabled={pending}
        // Outlined — color change only, no press scale (P8 is filled buttons
        // only). The border stays on in the "Logged ✓" state, just transparent,
        // so the flip doesn't shrink the button by the border's 2px.
        className={`min-h-11 rounded-control border px-4 text-body font-emphasis
          transition-colors duration-short disabled:opacity-60 ${focusRing} ${
            justLogged
              ? "border-transparent bg-raised text-success"
              : "border-line bg-surface text-ink hover:bg-raised"
          }`}
      >
        {/* P7 fallback (DESIGN.md Motion) — a freshly-mounted `<span>`, not a
            text-content swap in place, so `.expand-in`'s `@starting-style`
            actually fires on it. */}
        {justLogged ? (
          <span className="expand-in inline-block">Logged ✓</span>
        ) : (
          "Pick"
        )}
      </button>
      {/* A sibling live region, not `aria-live` on the button itself — the
          button is usually still focused when its label flips, and making an
          interactive element its own live region risks a double announcement
          or gets skipped by some screen readers. */}
      <p className="sr-only" role="status" aria-live="polite">
        {justLogged ? "Logged" : ""}
      </p>
      {pickError && (
        <p className="text-chip text-danger" aria-live="polite">
          {pickError}
        </p>
      )}
    </div>
  );
}
