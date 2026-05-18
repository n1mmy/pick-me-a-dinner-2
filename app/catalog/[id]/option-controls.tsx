"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { OptionWithTags } from "../../../db/queries";
import { PickButton } from "../../pick-button";
import { rejectOption } from "../../rejection-actions";
import { archiveOption, deleteOption, unarchiveOption } from "../actions";
import { OptionForm } from "../option-form";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 " +
  "focus-visible:outline-offset-2 focus-visible:outline-action";

const actionButton = `min-h-11 rounded-control px-3 text-body ${focusRing}`;

/**
 * The Option-level controls on the Option detail page (PRD: Option detail
 * page, ADR-0007) — so a member of the Household can act on the Option from
 * its full view, not only from the screen that happens to carry each control.
 *
 * Every control reuses the existing server action: `pickTonight` (via the
 * shared `PickButton`), `rejectOption`, `updateOption` (via the reused
 * `OptionForm`), `archiveOption` / `unarchiveOption`, and `deleteOption`.
 * Pick, Reject, and Edit update the page in place — the reused actions
 * revalidate `/catalog/[id]`. A successful Delete navigates back to the
 * Catalog, since the Option no longer exists; a Delete blocked by the
 * Hard-delete rule (ADR-0001, the Option has Log entries) shows the existing
 * inline error and keeps the page.
 *
 * The Archive control is a toggle: an active Option offers Archive, an Archived
 * one Un-archive — keeping the member on the page and turning it back into a
 * normal ranked detail page. Archive and Delete each take a §17 inline-confirm
 * step, consistent with the Catalog row and `DESIGN.md`; Un-archive is benign
 * (it only restores the Option) and runs in one tap.
 */
export function OptionControls({
  option,
  allTags,
  placesEnabled,
}: {
  option: OptionWithTags;
  allTags: string[];
  placesEnabled: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState<"archive" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const boxId = `reject-box-${option.id}`;

  function submitReject() {
    setError(null);
    startTransition(async () => {
      const result = await rejectOption(option.id, reason);
      if (!result.ok) {
        // A today-dated Rejection for this Option already exists — surface the
        // collision inline rather than letting it 500.
        setError(result.error);
        return;
      }
      // The Rejection revalidates the detail page; the Rejection history
      // section re-renders with the new entry under it.
      setRejecting(false);
      setReason("");
    });
  }

  function runArchive() {
    startTransition(async () => {
      const result = await archiveOption(option.id);
      setConfirm(null);
      if (!result.ok) setError(result.error);
    });
  }

  function runUnarchive() {
    startTransition(async () => {
      // Un-archiving revalidates `/catalog/[id]`; the page re-renders as a
      // normal ranked detail page with this control flipped back to Archive.
      const result = await unarchiveOption(option.id);
      if (!result.ok) setError(result.error);
    });
  }

  function runDelete() {
    startTransition(async () => {
      const result = await deleteOption(option.id);
      if (result.ok) {
        // The Option no longer exists — the page cannot stay (PRD user
        // story 39); return the member to the Catalog screen.
        router.push("/catalog");
        return;
      }
      // Blocked by the Hard-delete rule (the Option has Log entries) — show
      // the existing inline error and keep the page.
      setError(result.error);
      setConfirm(null);
    });
  }

  // Edit reuses the Option form inline; a save revalidates `/catalog/[id]`,
  // so the page's fields and ranking refresh in place under the collapsed form.
  if (editing) {
    return (
      <OptionForm
        kind={option.kind}
        initial={option}
        allTags={allTags}
        placesEnabled={placesEnabled}
        onCancel={() => setEditing(false)}
        onSaved={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1">
        <PickButton optionId={option.id} />
        {confirm === null ? (
          <>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setRejecting((open) => !open);
              }}
              disabled={pending}
              aria-expanded={rejecting}
              aria-controls={boxId}
              className={`${actionButton} text-muted disabled:opacity-60`}
            >
              Reject
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setEditing(true);
              }}
              className={`${actionButton} text-muted`}
            >
              Edit
            </button>
            {option.active ? (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setRejecting(false);
                  setConfirm("archive");
                }}
                className={`${actionButton} text-muted`}
              >
                Archive
              </button>
            ) : (
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setError(null);
                  setRejecting(false);
                  runUnarchive();
                }}
                className={`${actionButton} text-muted disabled:opacity-60`}
              >
                Un-archive
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setError(null);
                setRejecting(false);
                setConfirm("delete");
              }}
              className={`${actionButton} text-danger`}
            >
              Delete
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              disabled={pending}
              className={`${actionButton} font-emphasis disabled:opacity-60 ${
                confirm === "delete" ? "text-danger" : "text-action"
              }`}
              onClick={confirm === "delete" ? runDelete : runArchive}
            >
              {confirm === "delete" ? "Delete" : "Archive"}
            </button>
            <span aria-hidden="true" className="text-chip text-muted">
              ·
            </span>
            <button
              type="button"
              disabled={pending}
              className={`${actionButton} text-muted disabled:opacity-60`}
              onClick={() => setConfirm(null)}
            >
              Cancel
            </button>
          </>
        )}
      </div>

      {rejecting && confirm === null && (
        <form
          id={boxId}
          onSubmit={(event) => {
            event.preventDefault();
            submitReject();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            autoFocus
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            disabled={pending}
            placeholder="Reason (optional)"
            aria-label={`Reason for rejecting ${option.name} (optional)`}
            className={`min-h-11 min-w-0 flex-1 rounded-input border border-line
              bg-surface px-3 text-body text-ink placeholder:text-muted
              disabled:opacity-60 ${focusRing}`}
          />
          <button
            type="submit"
            disabled={pending}
            className={`min-h-11 shrink-0 rounded-control border border-line
              px-4 text-body font-emphasis text-action transition-colors
              duration-short hover:bg-raised disabled:opacity-60 ${focusRing}`}
          >
            Submit
          </button>
          <button
            type="button"
            onClick={() => {
              setRejecting(false);
              setReason("");
            }}
            disabled={pending}
            className={`min-h-11 shrink-0 rounded-control px-3 text-body
              text-muted transition-colors duration-short disabled:opacity-60
              ${focusRing}`}
          >
            Cancel
          </button>
        </form>
      )}

      {error && (
        <p className="text-chip text-danger" aria-live="polite">
          {error}
        </p>
      )}
    </div>
  );
}
