import { notFound } from "next/navigation";
import {
  getAllTags,
  getOptionById,
  getOptionChoices,
  getOptionLog,
  getOptionRejections,
  getTonightData,
} from "../../../db/queries";
import { formatDinnerDate, groupByDay } from "../../../lib/dinner-grouping";
import {
  epochDayFromSqlDate,
  today,
  WEEKDAY_NAMES,
} from "../../../lib/local-day";
import { placesEnabled } from "../../../lib/places";
import { rankOption, type RankOption } from "../../../lib/ranking";
import { safeHttpUrl } from "../../../lib/safe-http-url";
import { EntryRow } from "../../log/log-entry-row";
import { RejectionRow } from "../../log/rejection-row";
import { kindBarClass } from "../../kind-bar";
import { RowChips } from "../../tonight-row";
import { EditPanel } from "./edit-panel";
import { OptionControls } from "./option-controls";

/**
 * The Option detail page reads the DB on every visit and its recency depends
 * on the Household's current calendar day — it must never be prerendered.
 */
export const dynamic = "force-dynamic";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 " +
  "focus-visible:outline-offset-2 focus-visible:outline-action";

/** External / phone links — underlined so they read as links, with a focus ring. */
const linkClass = `text-action underline underline-offset-2 ${focusRing}`;

const sectionHeading =
  "text-meta font-emphasis uppercase tracking-wide text-muted";

/**
 * The Option detail page (PRD: Option detail page) at `/catalog/[id]` — the
 * per-Option screen a member of the Household lands on by tapping an Option's
 * name on the Catalog. This slice shows one Option's identity (name, kind,
 * notes, link, and — for a Restaurant — address / phone / Google Maps link)
 * and its recency data (per-Option recency chip, Tag heatmap chips).
 *
 * The recency is computed by `rankOption` over the same inputs the Tonight
 * page assembles, so the two screens never disagree. An id matching no Option
 * — a stale link, a Deleted Option, or junk — renders Next's `notFound()`.
 *
 * `?edit=1` swaps the Recency/Actions/Details block for `EditPanel` (the
 * reused `OptionForm`), History unchanged below it — edit is a real URL
 * state, not a client toggle, so it's back-button-able and the read-only
 * fields below it are never rendered stale under an open form.
 */
export default async function OptionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string | string[] }>;
}) {
  const { id } = await params;
  const { edit: rawEdit } = await searchParams;
  const editing = rawEdit === "1";
  const option = await getOptionById(id);
  if (!option) notFound();

  // "Today" is the Household's calendar day in APP_TZ, exactly as the Tonight
  // page reads it — so this page's recency matches the Tonight ranking.
  const todaySql = today();
  const todayEpochDay = epochDayFromSqlDate(todaySql);
  const [
    { options, logEntries },
    optionLog,
    optionChoices,
    optionRejections,
    allTags,
  ] = await Promise.all([
    getTonightData(todaySql),
    getOptionLog(option.id),
    getOptionChoices(),
    getOptionRejections(option.id),
    getAllTags(),
  ]);
  // The active Catalog's non-future Log entries feed per-Tag recency; the
  // target Option's own Log feeds its per-Option recency. `rankOption` handles
  // the Active/Archived distinction internally, so the page passes both
  // straight through without splicing an Archived Option's history in itself.
  const activeLog = logEntries.map((entry) => ({
    optionId: entry.optionId,
    eatenOn: epochDayFromSqlDate(entry.eatenOn),
  }));
  const targetLog = optionLog.map((entry) => ({
    optionId: entry.optionId,
    eatenOn: epochDayFromSqlDate(entry.eatenOn),
  }));

  const target: RankOption = {
    id: option.id,
    name: option.name,
    kind: option.kind,
    tags: option.tags,
    url: option.url,
    phone: option.phone,
  };
  const ranking = rankOption({
    target,
    activeOptions: options,
    activeLog,
    targetLog,
    asOf: todayEpochDay,
  });

  // History interleaves this Option's logged dinners and its Rejections into
  // one date-sorted list — future-dated groups (Planned dinners and Planned
  // rejections) first, then realized history newest-first.
  const { upcoming, history } = groupByDay(optionLog, optionRejections, todaySql);
  const activity = [...upcoming].reverse().concat(history);

  const isRestaurant = option.kind === "restaurant";
  const closedDays = isRestaurant
    ? closedDaysSummary(option.closedDays)
    : null;
  // A Catalog `url` / `mapsUrl` is free text, never scheme-checked on save —
  // only an http(s) value may render as a live link; anything else stays
  // visible as plain text (see `safeHttpUrl`).
  const linkHref = option.url ? safeHttpUrl(option.url) : null;
  const mapsHref = option.mapsUrl ? safeHttpUrl(option.mapsUrl) : null;
  const hasDetails =
    Boolean(option.notes) ||
    Boolean(option.url) ||
    (isRestaurant &&
      (Boolean(option.address) ||
        Boolean(option.phone) ||
        Boolean(option.mapsUrl) ||
        closedDays !== null));

  return (
    <main className="column flex min-h-screen flex-col gap-5.5 pb-24 pt-5.5 desktop:pb-12">
      <header className={`flex flex-col gap-1 ${kindBarClass(option.kind)}`}>
        <p className={sectionHeading}>
          {isRestaurant ? "Restaurant" : "Home meal"}
        </p>
        <h1 className="font-display text-h1 font-h1 text-ink">
          {option.name}
        </h1>
      </header>

      {editing ? (
        <section className="flex flex-col gap-2">
          <h2 className={sectionHeading}>Edit</h2>
          <EditPanel
            option={option}
            allTags={allTags}
            placesEnabled={placesEnabled()}
          />
        </section>
      ) : (
        <>
          <section className="flex flex-col gap-2">
            <h2 className={sectionHeading}>Recency</h2>
            <RowChips
              recencyDays={ranking.recencyDays}
              neverEaten={ranking.neverEaten}
              tags={ranking.tags}
            />
          </section>

          <section className="flex flex-col gap-2">
            <h2 className={sectionHeading}>Actions</h2>
            <OptionControls
              option={option}
              canDelete={optionLog.length === 0}
            />
          </section>

          {hasDetails && (
            <section className="flex flex-col gap-2">
              <dl className="flex flex-col">
                {option.notes && <Field label="Notes">{option.notes}</Field>}
                {option.url && (
                  <Field label="Link">
                    {linkHref ? (
                      <a
                        href={linkHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={linkClass}
                      >
                        {option.url}
                      </a>
                    ) : (
                      option.url
                    )}
                  </Field>
                )}
                {isRestaurant && option.address && (
                  <Field label="Address">{option.address}</Field>
                )}
                {isRestaurant && option.phone && (
                  <Field label="Phone">
                    <a href={`tel:${option.phone}`} className={linkClass}>
                      {option.phone}
                    </a>
                  </Field>
                )}
                {isRestaurant && option.mapsUrl && (
                  <Field label="Map">
                    {mapsHref ? (
                      <a
                        href={mapsHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={linkClass}
                      >
                        Google Maps
                      </a>
                    ) : (
                      option.mapsUrl
                    )}
                  </Field>
                )}
                {isRestaurant && closedDays && (
                  <Field label="Closed days">{closedDays}</Field>
                )}
              </dl>
            </section>
          )}
        </>
      )}

      <section className="flex flex-col gap-2">
        <h2 className={sectionHeading}>History</h2>
        {activity.length === 0 ? (
          <p className="text-body text-muted">
            Nothing logged or rejected yet for this Option.
          </p>
        ) : (
          // Each date-group interleaves that day's logged dinners and
          // Rejections, reusing the Log screen's `EntryRow` / `RejectionRow`
          // so the two screens manage a Dinner and a Rejection identically
          // (PRD: Option detail page parity). Their actions revalidate
          // `/catalog/[id]`, so an edit or delete refreshes this page in place.
          activity.map((record) => (
            <div key={record.date} className="flex flex-col gap-1">
              <h3 className="text-chip font-emphasis text-muted">
                {formatDinnerDate(record.date, todaySql)}
              </h3>
              <ul className="flex flex-col">
                {record.entries.map((entry) => (
                  <EntryRow
                    key={entry.id}
                    entry={entry}
                    optionChoices={optionChoices}
                  />
                ))}
                {record.rejections.map((rejection) => (
                  <RejectionRow
                    key={rejection.id}
                    rejection={rejection}
                    optionChoices={optionChoices}
                  />
                ))}
              </ul>
            </div>
          ))
        )}
      </section>
    </main>
  );
}

/**
 * "Closed Sundays and Mondays" — the Closed days line on the Option detail
 * page (PRD: Closed days). `null` for an empty set, so the caller omits the
 * `Field` exactly like every other blank Restaurant field.
 */
function closedDaysSummary(closedDays: number[]): string | null {
  if (closedDays.length === 0) return null;
  const names = closedDays.map((day) => `${WEEKDAY_NAMES[day]}s`);
  if (names.length === 1) return `Closed ${names[0]}`;
  const last = names[names.length - 1];
  return `Closed ${names.slice(0, -1).join(", ")} and ${last}`;
}

/**
 * One labelled field in the Details list — a hairline-separated ledger row
 * (the meta label above its value), matching the app's flat-list density.
 */
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-divider py-3">
      <dt className={sectionHeading}>{label}</dt>
      <dd className="text-body text-ink">{children}</dd>
    </div>
  );
}
