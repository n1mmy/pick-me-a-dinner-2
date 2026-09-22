/**
 * The §17 inline-confirm's **armed pair** — `Cancel · <action>` — shared by
 * every destructive (or destructive-adjacent) row action: Delete on the Log
 * and Catalog rows, Remove on Tonight's decided rows, Archive on Catalog.
 * Each call site owns the arming state (a first tap swaps its rest-state
 * button for this pair) and the write itself; this component is only the
 * pair's markup and order.
 *
 * Cancel renders *first*, the action last. The pair always sits at a row's
 * right edge — pinned there by a following `PickButton` or by the row's own
 * `justify-between` — so the last child lands where the rest-state action
 * button already was. Confirming is then a double-tap in one spot, and
 * Cancel sits a slot away, not under the finger by accident.
 *
 * Renders a fragment, not a wrapper: the three elements join the call site's
 * own flex row so spacing between the pair and its neighbours stays the
 * container's `gap`. `buttonClass` is the call site's row-action button
 * class (the Log/Catalog `actionButton`, the decided row's `removeButton`) —
 * the pair only adds the state colors on top of it.
 */
export function ConfirmPair({
  label,
  tone = "danger",
  pending,
  onConfirm,
  onCancel,
  buttonClass,
}: {
  /** The armed action's label — the same word its rest-state button carried ("Delete", "Remove", "Archive"). */
  label: string;
  /** `danger` for destructive actions (the default); `action` for Archive. */
  tone?: "danger" | "action";
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** The call site's row-action button class; state colors are appended. */
  buttonClass: string;
}) {
  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={onCancel}
        className={`${buttonClass} text-muted disabled:opacity-60`}
      >
        Cancel
      </button>
      <span aria-hidden="true" className="text-chip text-muted">
        ·
      </span>
      <button
        type="button"
        disabled={pending}
        onClick={onConfirm}
        className={`${buttonClass} font-emphasis disabled:opacity-60 ${
          tone === "danger" ? "text-danger" : "text-action"
        }`}
      >
        {label}
      </button>
    </>
  );
}
