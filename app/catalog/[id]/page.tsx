import { notFound } from "next/navigation";
import {
  getAllTags,
  getOptionById,
  getOptionChoices,
  getOptionLog,
  getOptionRejections,
  getTonightData,
} from "../../../db/queries";
import { formatDinnerDate, splitDinners } from "../../../lib/dinner-grouping";
import { epochDayFromSqlDate, todaySqlDate } from "../../../lib/local-day";
import { placesEnabled } from "../../../lib/places";
import { rankOption, type RankOption } from "../../../lib/ranking";
import { DinnerGroup } from "../../log/log-entry-row";
import { kindBarClass, RowChips } from "../../tonight-row";
import { BringBackButton } from "./bring-back-button";
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
 * and its ranking data (Score, per-Option recency line, Tag heatmap chips).
 *
 * The ranking is computed by `rankOption` over the same inputs the Tonight
 * page assembles, so the two screens never disagree. An id matching no Option
 * — a stale link, a Deleted Option, or junk — renders Next's `notFound()`.
 */
export default async function OptionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const option = await getOptionById(id);
  if (!option) notFound();

  // "Today" is the Household's calendar day in APP_TZ, exactly as the Tonight
  // page reads it — so this page's recency matches the Tonight ranking.
  const today = todaySqlDate(new Date(), process.env.APP_TZ ?? "UTC");
  const todayEpochDay = epochDayFromSqlDate(today);
  const [
    { options, logEntries },
    optionLog,
    optionChoices,
    optionRejections,
    allTags,
  ] = await Promise.all([
    getTonightData(today),
    getOptionLog(option.id),
    getOptionChoices(),
    getOptionRejections(option.id),
    getAllTags(),
  ]);
  const entries = logEntries.map((entry) => ({
    optionId: entry.optionId,
    eatenOn: epochDayFromSqlDate(entry.eatenOn),
  }));
  // `getTonightData` feeds the ranking only active Options' Log entries, so an
  // Archived Option's own history is absent above. Add it back here — the
  // detail page's per-Option recency line is factual recency data, computed
  // from the Option's own Log regardless of Active/Archived state (see
  // `rankOption`). It still takes no part in the Score: an Archived Option is
  // not an active per-Tag carrier, so this never moves another Option's rank.
  if (!option.active) {
    for (const entry of optionLog) {
      entries.push({
        optionId: entry.optionId,
        eatenOn: epochDayFromSqlDate(entry.eatenOn),
      });
    }
  }

  const target: RankOption = {
    id: option.id,
    name: option.name,
    kind: option.kind,
    tags: option.tags,
    url: option.url,
    phone: option.phone,
  };
  const ranking = rankOption(target, options, entries, todayEpochDay);

  // The History section: this Option's own Log, split into its realized
  // history (newest first) and its Planned dinners (the group shown above it).
  const { planned, realized } = splitDinners(optionLog, today);

  const isRestaurant = option.kind === "restaurant";
  const hasDetails =
    Boolean(option.notes) ||
    Boolean(option.url) ||
    (isRestaurant &&
      (Boolean(option.address) ||
        Boolean(option.phone) ||
        Boolean(option.mapsUrl)));

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

      <section className="flex flex-col gap-2">
        <h2 className={sectionHeading}>Ranking</h2>
        {ranking.score !== null ? (
          <div className="flex flex-col gap-0.5">
            <p className="font-mono text-h1 tabular-nums text-ink">
              {Math.round(ranking.score)}
            </p>
            <p className="text-meta text-muted">
              Score — a point-in-time, comparative figure: how strongly the
              ranking favors this Option against the rest right now, not a
              fixed property of it.
            </p>
          </div>
        ) : (
          // An Archived Option is excluded from the ranking, so it has no
          // Score; its per-Option recency and Tag chips below are still
          // factual recency data, not a Score.
          <p className="text-body text-muted">Archived — not ranked</p>
        )}
        <RowChips
          recencyDays={ranking.recencyDays}
          neverEaten={ranking.neverEaten}
          tags={ranking.tags}
        />
      </section>

      {hasDetails && (
        <section className="flex flex-col gap-2">
          <h2 className={sectionHeading}>Details</h2>
          <dl className="flex flex-col">
            {option.notes && <Field label="Notes">{option.notes}</Field>}
            {option.url && (
              <Field label="Link">
                <a
                  href={option.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={linkClass}
                >
                  {option.url}
                </a>
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
                <a
                  href={option.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={linkClass}
                >
                  Google Maps
                </a>
              </Field>
            )}
          </dl>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className={sectionHeading}>Actions</h2>
        <OptionControls
          option={option}
          allTags={allTags}
          placesEnabled={placesEnabled()}
        />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className={sectionHeading}>History</h2>
        {optionLog.length === 0 ? (
          <p className="text-body text-muted">
            No dinners logged yet for this Option.
          </p>
        ) : (
          <>
            {planned.length > 0 && (
              <div className="flex flex-col gap-2">
                <h3 className={sectionHeading}>Planned</h3>
                {planned.map((dinner) => (
                  <DinnerGroup
                    key={dinner.date}
                    dinner={dinner}
                    optionChoices={optionChoices}
                    today={today}
                  />
                ))}
              </div>
            )}
            {realized.map((dinner) => (
              <DinnerGroup
                key={dinner.date}
                dinner={dinner}
                optionChoices={optionChoices}
                today={today}
              />
            ))}
          </>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className={sectionHeading}>Rejections</h2>
        {optionRejections.length === 0 ? (
          <p className="text-body text-muted">
            This Option has never been rejected.
          </p>
        ) : (
          <ul className="flex flex-col">
            {optionRejections.map((rejection) => {
              // Today vs settled history — the same `rejected_on === today`
              // split `lib/rejections.ts` partitions on. A Rejection made
              // today is still undoable and carries Bring back; an earlier
              // one is settled history and renders plain.
              const undoable = rejection.rejectedOn === today;
              return (
                <li
                  key={rejection.id}
                  className="flex items-start justify-between gap-3
                    border-b border-line py-3"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-body text-ink">
                      {formatDinnerDate(rejection.rejectedOn, today)}
                    </span>
                    {rejection.reason && (
                      <p className="text-meta text-muted">
                        {rejection.reason}
                      </p>
                    )}
                  </div>
                  {undoable && <BringBackButton rejectionId={rejection.id} />}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
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
    <div className="flex flex-col gap-0.5 border-b border-line py-3">
      <dt className={sectionHeading}>{label}</dt>
      <dd className="text-body text-ink">{children}</dd>
    </div>
  );
}
