"use client";

import { useTransition } from "react";
import { bringBackRejection } from "../../tonight-actions";

/**
 * The "Bring back" control on a Rejection made *today* in the Option detail
 * page's Rejection history section (PRD: Option detail page). It calls the
 * existing `bringBackRejection` action — the same one Tonight's "Rejected
 * tonight" disclosure uses — which **deletes** the Rejection record outright
 * and revalidates the detail page, so the correction shows in place at once.
 *
 * Only today's Rejections render this; an earlier Rejection is settled history
 * and carries no control, so this component is mounted only where it applies.
 */
export function BringBackButton({ rejectionId }: { rejectionId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() =>
        startTransition(async () => {
          await bringBackRejection(rejectionId);
        })
      }
      disabled={pending}
      className="min-h-11 shrink-0 rounded-control border border-line px-3
        text-body font-emphasis text-action transition-colors duration-short
        hover:bg-raised disabled:opacity-60 focus-visible:outline
        focus-visible:outline-2 focus-visible:outline-offset-2
        focus-visible:outline-action"
    >
      Bring back
    </button>
  );
}
