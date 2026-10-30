# Pick Me a Dinner

The shared language of a small personal web app that helps one household
decide what's for dinner each night. This glossary is the canonical
vocabulary: code, issues, tests, and docs use these terms and avoid the listed
aliases. An entry says what a term is and what separates it from its
neighbours; the reasoning behind a rule lives in the ADR it cites.

## Language

### The catalog

**Option**:
A single thing the household could choose for dinner — a home-cooked meal or a
restaurant. The unit of the Catalog and the unit ranked on Tonight.
_Avoid_: Item, dish, "meal" as the unified term (a Restaurant is not a meal).

**Home meal**:
An Option cooked at home (`kind = 'home'`).
_Avoid_: Recipe.

**Restaurant**:
An Option for eating out or ordering in (`kind = 'restaurant'`).
_Avoid_: Place, venue.

**Catalog**:
The full set of Options the household maintains.

**No Shared Dinner**:
The Option Picked for a night nobody ate together — out at an event, or an
otherwise abnormal schedule. Logged like any Option, so the night is
decided, but never recommended: Tonight lists it last whatever its Score,
and it is never an AI snapshot candidate, so no model ranks it. Its nights
stay in the snapshot's Log. Known by name.

**Option detail page**:
The screen showing everything about one Option — its fields, Score and
recency, Log history, and Rejections — reached by tapping the Option's name
anywhere it appears, and carrying every control that makes sense for it
(ADR-0007).
_Avoid_: Restaurant page (it serves both kinds of Option).

**Tag**:
A free-form, case-insensitive label on an Option (`pasta`, `fish`,
`helen: burger`). Drives the variety side of the ranking.

**Closed day**:
A weekday a Restaurant is shut — a fact about its trading week, stored on the
Restaurant (ADR-0010). Weekdays only: no opening times and no dates. On that
weekday the Restaurant leaves Tonight's ranked list for the **Closed
disclosure** and leaves AI search's candidates, with no change to any Score.
Only a Restaurant has Closed days.
_Avoid_: Opening hours (a Closed day has no times); "closed" as a Rejection
reason (a Rejection is one night's judgement — a weekly closure is a Closed
day, a one-off closure is a **Planned rejection**).

### The log

**Log entry**:
One record that one Option was — or will be — eaten on one date (one
`dinner_log` row).
_Avoid_: "Dinner" for a single row.

**Dinner**:
A whole evening's eating: one calendar date with one or more Log entries
(takeout plus some home cooking). Never stored as a row. The Log screen groups
by date and shows each date's Dinner with that date's Rejections.

**Note**:
The optional free-text line on a Log entry — what the Household recorded about
that night's eating of that Option ("got the katsu curry", "too much rice").
Dated, so an Option's newest one is its **Last note**. Shown and edited
wherever its entry appears.
_Avoid_: "note" unqualified when **Option notes** or a **Day note** is meant.

**Option notes**:
The standing free-text description on an Option itself, kept on the Option
detail page ("ask for the corner table", "recipe halves badly"). Undated: it
describes the Option, not a night. Read by AI search, never shown on Tonight.
_Avoid_: Note (singular — the Log entry's).

**Day note**:
The optional one-line note the Household attaches to a calendar date — about
the evening, not any Option ("Jen won't be around", "guests over"). Needs no
Log entry, Rejection, or Pick, so it can be written ahead. Shown and edited
under Tonight's heading for the **Selected day** and under its date on the
Log. Never changes a Score or a suppression, and is never a Last note.
Clearing its text deletes it. UI copy says "Note for Friday"; code and docs
say Day note.
_Avoid_: **Note** (a Log entry's) and **Option notes** (an Option's).

**Log**:
The full history of Log entries — the `dinner_log` table and the screen that
shows it.
_Avoid_: Choices.

**Tonight's dinner**:
Today's Dinner — the Log entries dated today — shown in Tonight's decided
block once the Household has Picked. On a future Selected day the same block
shows that day's Planned dinners with day-aware copy ("Friday's dinner"); the
term itself stays narrow to today.

**Pick** (verb):
To choose the dinner for the **Selected day**. A Pick *is* a Log entry dated
that day — "pick = log", with no separate pick entity: today's is **Tonight's
dinner**, a future one a **Planned dinner**, a past one a backfill. A Pick
removes the Option's Rejection on that date (see **Day decision**).

**Planned dinner**:
A Log entry dated after today. Excluded from the ranking until its date
arrives; listed in the Log screen's "Upcoming" section.
_Avoid_: Plan, Upcoming entry ("Upcoming" is only the section heading).

**Rejection**:
A record that the Household passed an Option over for one night, with an
optional short reason ("too heavy for tonight", "we had it at lunch"). Made
live on a Tonight row, dated the **Selected day**, or by hand on the Log or
Option detail page for any chosen date — a past date backfills, a future date
is a **Planned rejection**. On its date it removes the Option from Tonight's
list and from AI search's candidates; the Option returns on its own the next
day. It is kept as dated history the AI reads, judging for itself which
reasons are standing and which were one-off (ADR-0006). Editable and
deletable from the Log and the Option detail page; **Bring back** is the
Selected-day quick undo on Tonight's "Rejected" disclosure. Not a Log entry,
and never changes a Score. A Pick on the same date removes it (see **Day
decision**).
_Avoid_: Archive (a Rejection covers one night); Closed day (a weekly closure
is a property of the Restaurant); "reject" for declining a whole AI result.

**Planned rejection**:
A Rejection dated after today — the mirror of a Planned dinner, entered by hand
to turn an Option down for a known future night ("shut for a private function
this Friday"). Suppresses the Option when its date arrives, exactly as a
same-day Rejection does; listed in the Log screen's "Upcoming" section. One
date only — a weekly closure is a **Closed day**.
_Avoid_: Recurring rejection.

**Day decision**:
What the Household decided about one Option for one date: a **Pick** of it or
a **Rejection** of it, never both. A Pick wins — Picking removes the Option's
Rejection on that date, however the Pick is made, and Rejecting an Option
already Picked that date is refused until the Pick is removed. A date is
**decided** once it carries any Pick, whatever has happened to the Option
since; Rejections alone leave it undecided.
_Avoid_: "decision" for an **AI search** result or a **Prepared note**'s
ranking (suggestions, not the Household's decisions).

### Ranking

**Selected day**:
The date the **Tonight** screen is ranking for. Defaults to today and steps to
any date, past or future (ADR-0009): forward to plan, back to edit or backfill
a night. The whole screen — the ranked list, AI search, the decided block, the
live Reject control — is anchored on it. The H1 reads "Tonight" when the
Selected day is today and the day's name otherwise; tapping it resets the
Selected day to today.
_Avoid_: target date, picking day, future day (today is a Selected day);
"going back to Tonight" for the reset (that reads as navigating to the screen).

**Tonight**:
The home screen, and its H1 label when the Selected day is today. It ranks
active Options by Score for the **Selected day**, and once a Pick is made
shows that day's Dinner — deciding, and showing what was decided. Its list is
layered: an AI search result over the **Prepared ranking** over the Score
ranking; Clear removes the top layer.

**Closed disclosure**:
The collapsed list at the foot of Tonight, below the Rejected disclosure,
holding the Restaurants dropped for a **Closed day** on the Selected day —
headed "Closed tonight (N)" today and "Closed on Friday (N)" otherwise.
Alphabetical with no rank numbers: a list, not a ranking. Each row keeps the
picker row's controls, so a Restaurant open after all can still be Picked, or
Rejected with what was learned.
_Avoid_: Closed list, Closed section.

**Recency**:
How long since something was last eaten, measured from non-future Log entries
of **active** Options only — an Archived Option's history does not count.
**Per-Option recency** is days since that exact Option; **per-Tag recency** is
days since any active Option carrying that Tag.

**Score**:
The number that ranks an Option on Tonight: **Readiness × Affinity**.
Readiness asks "how overdue is this?", Affinity "how much does the Household
want it?"; multiplying lets low Affinity hold back a stale-but-unloved Option.
Higher is higher on the list.
_Avoid_: Anti-repeat, variety enforcer (Score is no longer recency alone).

**Readiness**:
The overdue half of the Score: a blend of an Option's per-Option recency and
the per-Tag recency of its Tags, on the capped-day scale.

**Affinity**:
The preference half of the Score: a recency-weighted eat-frequency of an Option
and its cuisine, normalized so ~1.0 is catalog-average — the Household's
*revealed* preference, inferred from the Log with no rating field. A
never-eaten Option inherits its cuisine's Affinity; one with no signal sits at
a neutral baseline. Rejections do not feed it.
_Avoid_: Rating, preference score (never entered by hand).

**Recent gaps**:
The days between an Option's last eats — or, for a Tag, the last eats of any
active Option carrying it — newest first, four at most: the pace the Household
keeps now, as they keep it. A snapshot fact for the AI, not a Score factor,
and deliberately with no summary number over it (ADR-0012).
_Avoid_: Interval, usual gap, cadence (the habit itself, not its numbers),
overdue (the Tag chip threshold).

**Usual stretch**:
The gap the Household tends to leave between turns of an Option, or of a Tag,
as a rationale states it ("about every two weeks", "four to six days"): the
habit read from the Recent gaps, in the household's words. It is what a
rhythm claim sets the count against, and it appears on no chip.
_Avoid_: Interval (retired), cadence or rhythm as a term (fine as words in a
line, not as the name of the concept).

**Recency chip**:
The small chip on each Tonight row showing the Option's per-Option recency
("18d", "60d+" at the cap, "new" when never eaten). With the Tag chips it
shows the numbers behind the Score; it does not narrate why the Option ranks
where it does.
_Avoid_: Explanation chip (retired — Tonight carries no deterministic "why"
line).

**Last note**:
The newest non-empty **Note** on a Log entry dated strictly before the
**Selected day**, shown on that Option's Tonight row with its age ("18d · got
the katsu curry") — "what happened last time?" at the moment of choosing.
Strictly before, so the Selected day's own Pick is never its own Last note.
Every Tonight row shows one when it exists; a Rejection reason never is one.
_Avoid_: "last note" for the Selected day's own Note; Last comment, Last
review.

**Overdue**:
A Tag whose per-Tag recency has crossed the overdue threshold; rendered in the
accent color on Tonight.

**Cold start**:
Too little Log history to differentiate Options — every Score ties and Tonight
falls back to alphabetical order.

### AI search

**AI search**:
A triggered, query-driven re-ranking of Tonight by an AI model. The Household
types an intent ("something light", "we have guests") — or leaves the query
empty — and the model returns a ranked set of Options to fit it, reading the
eating history for habits the Score cannot see (day-of-week rhythms, what
follows what) and every **Day note** as dated history, with the Selected
day's own as current context. Always a deliberate action, never what Tonight
loads with; the result sits on top of the list until cleared. The model
decides how many Options to return, so a narrowing query yields a subset.
_Avoid_: AI ranking (it is search — there is a query, even when empty); AI
search for a **Prepared note** (written ahead, not searched).

**Option code**:
The short letter label (`A`, `B`, … `AK`) a snapshot gives each Option so a
model can refer to it. Letters, so a rank position written where a code
belongs resolves to nothing instead of the wrong Option (ADR-0013). A code
belongs to one snapshot and is never shown to the Household.
_Avoid_: number, index (a code is not an integer); name (two Options may
share one).

**AI rationale**:
The model-written line on each AI search result row and Prepared ranking row
saying why the Option sits where it does this evening ("Light and fast — a
soup, and the katsu was the good call last time"). A search row's is
query-aware and short; a Prepared ranking row's has up to three sentences for
a strong pick, tapering for the tail. The deterministic list has none.

A rationale's timing is a **rhythm claim**: how long it has been, set
against the **Usual stretch** ("15 days, inside the two weeks they usually
leave it"; "sushi was Thursday, sooner than they tend to repeat it"),
measured from whichever is nearer, the Option's own last turn or one of its
Tags'. The count also sits on the Recency and Tag chips, and that is fine: a line is
skimmed faster than a chip is read, and the stretch is on no chip at all. A
bare count with no stretch beside it is allowed but adds little. What the
line never carries is the snapshot itself: a list of gaps, a Log date, a
field name, an Option code. The line opens on its reason and is in the
household's words rather than the snapshot's (ADR-0005).
_Avoid_: Recency chip (data, not a rationale); elapsed-time claim (retired as
a fault: the count is welcome when the stretch is beside it).

**Prepared note**:
What a local model the Household runs at home writes ahead for one date, so it
is ready when Tonight opens (ADR-0011). Two parts: the **brief**, two or three
sentences about the evening and the standout suggestions, under Tonight's
heading; and the **Prepared ranking**, every candidate Option ranked with an
**AI rationale**, which is what the list shows on load. Written only for an
undecided date from today through six days ahead, from the snapshot AI search
reads, and rewritten in the background when that input changes. It
**freezes** once its date is **decided** or has passed, keeping the last
version written before the Household decided so it can be read against what
was eaten. Never changes a Score or a suppression. An unfrozen note built from
older inputs is labelled out of date.
_Avoid_: AI notes, AI brief; **Note** or **Day note** (the Household's own
writing); AI search (no query, never triggered).

### Lifecycle & access

**Active**:
An Option that appears on Tonight and in the default Catalog list
(`active = true`).

**Archived**:
An Option set inactive (`active = false`): hidden from Tonight and the default
Catalog list, still shown in Log history. The action is **Archive**.
_Avoid_: Inactive (as the state term).

**Hard-delete**:
Permanently removing an Option from the Catalog. Allowed only for an Option
with zero Log entries; one with history is Archived instead.

**Household**:
The single group of people who share the app and its one password. No user
accounts, no per-person identity (ADR-0002).

## Relationships

- An **Option** is exactly one kind — **Home meal** or **Restaurant** — and
  carries zero or more **Tags**; a Restaurant also carries zero or more
  **Closed days**.
- Within one snapshot every **Option** carries exactly one **Option code**.
- A **Log entry** records one **Option** on one date and carries zero or one
  **Note**; a **Dinner** is the Log entries sharing a date; the **Log** is all
  of them.
- A date carries zero or one **Day note** and zero or one **Prepared note**.
- An **Option** has at most one **Day decision** per date — a **Pick** or a
  **Rejection** — and a Pick wins.
- **Picking** creates a **Log entry** dated the **Selected day**; dated after
  today it is a **Planned dinner**, as a **Rejection** dated after today is a
  **Planned rejection**.
- **Tonight** ranks active **Options** by **Score** — **Readiness** ×
  **Affinity** — for the **Selected day**, shows each row's **Recency chip**
  and **Last note**, and shows the day's **Dinner** once Picked.
- A **Rejection** on the Selected day, or a **Closed day** on its weekday,
  removes the Option from Tonight's list and from **AI search**'s candidates
  without touching its **Score**.
- An **Option** is **Active** or **Archived**; one with any **Log entry** cannot
  be **hard-deleted**.

## Example dialogue

> **Dev:** "If we Pick a Restaurant tonight and also Pick a Home meal, is that
> two Dinners?"
> **Domain expert:** "No — one Dinner, two Log entries. A Dinner is the
> evening; both entries just sit on today's date."
>
> **Dev:** "And if I add a Log entry for next Friday?"
> **Domain expert:** "That's a Planned dinner. It shows in Upcoming, but it
> doesn't touch any Score until Friday arrives."
>
> **Dev:** "Aji Ichi is shut every Monday. Is that Planned rejections, or
> something else?"
> **Domain expert:** "A **Closed day** on Aji Ichi. A Rejection is us deciding
> something about a night; being shut on Mondays is true whether or not we ever
> thought about it. The Planned rejection is for the one-off: closed this
> Friday for a private function."
>
> **Dev:** "We Picked the katsu tonight. Should the Prepared note regenerate now
> that it's out of date?"
> **Domain expert:** "No, it freezes. The point of keeping it is to see what the
> model said before we decided. If we Remove the Pick, the night is open again
> and the note can be rewritten."
