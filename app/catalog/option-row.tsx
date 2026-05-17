"use client";

import { useState, useTransition } from "react";
import type { OptionWithTags } from "../../db/queries";
import { archiveOption, deleteOption } from "./actions";
import { OptionForm } from "./option-form";

const actionButton =
  "min-h-11 rounded-control px-2 text-chip focus-visible:outline " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action";

/**
 * One Catalog row. Shows the Option name with Edit / Archive / Delete actions;
 * Edit expands the row in place into the form, and the destructive actions use
 * the §17 inline-confirm pattern ("Archive · Cancel" / "Delete · Cancel").
 */
export function OptionRow({
  option,
  allTags,
  placesEnabled,
}: {
  option: OptionWithTags;
  allTags: string[];
  placesEnabled: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState<"archive" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function runArchive() {
    startTransition(async () => {
      await archiveOption(option.id);
    });
  }

  function runDelete() {
    startTransition(async () => {
      const result = await deleteOption(option.id);
      if (!result.ok) {
        setError(result.error);
        setConfirm(null);
      }
    });
  }

  if (editing) {
    return (
      <li className="border-b border-line py-3">
        <OptionForm
          kind={option.kind}
          initial={option}
          allTags={allTags}
          placesEnabled={placesEnabled}
          onCancel={() => setEditing(false)}
          onSaved={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-1 border-b border-line py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="font-display text-name font-name text-ink">
          {option.name}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          {confirm === null ? (
            <>
              <button
                type="button"
                className={`${actionButton} text-muted`}
                onClick={() => {
                  setError(null);
                  setEditing(true);
                }}
              >
                Edit
              </button>
              <button
                type="button"
                className={`${actionButton} text-muted`}
                onClick={() => {
                  setError(null);
                  setConfirm("archive");
                }}
              >
                Archive
              </button>
              <button
                type="button"
                className={`${actionButton} text-danger`}
                onClick={() => {
                  setError(null);
                  setConfirm("delete");
                }}
              >
                Delete
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={pending}
                className={`${actionButton} font-emphasis ${
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
                className={`${actionButton} text-muted`}
                onClick={() => setConfirm(null)}
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
      {error && <p className="text-chip text-danger">{error}</p>}
    </li>
  );
}
