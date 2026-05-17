"use client";

import { useState, useTransition } from "react";
import { pickTonight } from "./log/actions";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 " +
  "focus-visible:outline-offset-2 focus-visible:outline-action";

/**
 * The Pick button — the app's single primary action (DESIGN.md): it logs the
 * Option as tonight's dinner (`pick = log`, the same write the Tonight rows
 * carry). A filled charcoal `action` button that briefly flips to "Logged ✓"
 * on success; a write failure — e.g. the Option was deleted out from under the
 * row — shows inline below the button rather than flashing a false "Logged ✓".
 *
 * Used on the Log and Catalog rows so any Option can be picked for tonight
 * without a trip back to the Tonight screen.
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
        aria-live="polite"
        className={`min-h-11 rounded-control px-4 text-body font-emphasis
          transition-colors duration-short disabled:opacity-60 ${focusRing} ${
            justLogged
              ? "bg-raised text-success"
              : "bg-action text-action-ink hover:bg-action-hover"
          }`}
      >
        {justLogged ? "Logged ✓" : "Pick"}
      </button>
      {pickError && (
        <p className="text-chip text-danger" aria-live="polite">
          {pickError}
        </p>
      )}
    </div>
  );
}
