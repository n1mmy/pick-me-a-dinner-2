"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { OptionWithTags } from "../../db/queries";
import { PickButton } from "../pick-button";
import { ConfirmPair } from "../confirm-pair";
import { archiveOption, deleteOption } from "./actions";
import { OptionForm } from "./option-form";

const actionButton =
  "min-h-11 rounded-control px-2 text-chip focus-visible:outline " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action";

/**
 * One Catalog row. Shows the Option name with Edit / Archive / Delete actions;
 * Edit expands the row in place into the form, and the destructive actions use
 * the §17 inline-confirm pattern — the armed `ConfirmPair` ("Cancel · Archive"
 * / "Cancel · Delete"). `PickButton` pins to the row's right edge either way,
 * so the pair's last child lands where rest-state Delete already was.
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
      const result = await archiveOption(option.id);
      if (!result.ok) {
        setError(result.error);
        setConfirm(null);
      }
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
      <li className="border-b border-divider py-3">
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
    <li className="flex flex-col gap-1 border-b border-divider py-3">
      <div className="flex items-center justify-between gap-3">
        <Link
          href={`/catalog/${option.id}`}
          className="font-display text-name font-name text-ink underline-offset-2
            hover:underline focus-visible:outline focus-visible:outline-2
            focus-visible:outline-offset-2 focus-visible:outline-action"
        >
          {option.name}
        </Link>
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
            <div className="expand-in flex items-center gap-1">
              <ConfirmPair
                buttonClass={actionButton}
                label={confirm === "delete" ? "Delete" : "Archive"}
                tone={confirm === "delete" ? "danger" : "action"}
                pending={pending}
                onConfirm={confirm === "delete" ? runDelete : runArchive}
                onCancel={() => setConfirm(null)}
              />
            </div>
          )}
          <PickButton optionId={option.id} />
        </div>
      </div>
      {error && (
        <p className="text-chip text-danger" role="alert">
          {error}
        </p>
      )}
    </li>
  );
}
