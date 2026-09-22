"use client";

import { useRouter } from "next/navigation";
import type { OptionWithTags } from "../../../db/queries";
import { OptionForm } from "../option-form";

/**
 * The Option detail page's edit mode, reached via `?edit=1` (PRD: Option
 * detail page — edit UX pass). Editing used to be a client toggle that
 * replaced only the "Actions" section, leaving the read-only Details list
 * rendered — and stale — underneath the open form; making it a real URL
 * state instead means the page itself swaps the whole Recency/Actions/
 * Details block for the form (see `page.tsx`), Back cancels it for free, and
 * there is nothing left on screen to go stale.
 *
 * Cancelling and saving both return to the plain detail URL. `updateOption`
 * already revalidates `/catalog/[id]`, so the fields and ranking the member
 * lands back on are current.
 */
export function EditPanel({
  option,
  allTags,
  placesEnabled,
}: {
  option: OptionWithTags;
  allTags: string[];
  placesEnabled: boolean;
}) {
  const router = useRouter();

  function leaveEdit() {
    router.push(`/catalog/${option.id}`);
  }

  return (
    <OptionForm
      kind={option.kind}
      initial={option}
      allTags={allTags}
      placesEnabled={placesEnabled}
      onCancel={leaveEdit}
      onSaved={leaveEdit}
    />
  );
}
