# Pick Me a Dinner

The shared language of a small personal web app that helps one household
decide what's for dinner each night. This glossary is the canonical
vocabulary: code, issues, tests, and docs should use these terms and avoid the
listed aliases.

## Language

### The catalog

**Option**:
A single thing the household could choose for dinner — either a home-cooked
meal or a restaurant. The unit of the Catalog and the unit ranked on Tonight.
_Avoid_: Item, dish, "meal" used as the unified term (a Restaurant is not a
meal).

**Home meal**:
An Option cooked at home (`kind = 'home'`).
_Avoid_: Recipe.

**Restaurant**:
An Option for eating out or ordering in (`kind = 'restaurant'`).
_Avoid_: Place, venue.

**Catalog**:
The full set of Options the household maintains.

**Option detail page**:
A screen showing everything about a single Option — its fields, its ranking
data (Score and recency), its Log history, and its Rejections — reached by
tapping the Option's name anywhere it appears, and carrying every control that
makes sense for that Option.
_Avoid_: Restaurant page (the page serves both kinds of Option, not only
Restaurants).

**Tag**:
A free-form, case-insensitive label attached to an Option (e.g. `pasta`,
`fish`, `helen: burger`). Drives the variety side of the ranking.

### The log

**Log entry**:
A single record that one Option was — or will be — eaten on one date (one
`dinner_log` row).
_Avoid_: "Dinner" for a single row (the prior app's `Dinner` table meant this;
v1 does not).

**Dinner**:
A whole evening's eating: one calendar date, composed of one or more Log
entries (e.g. takeout plus some home cooking). The app never stores a Dinner
as a row — it is the eating on a date. The Log screen groups by date and shows
each date's Dinner together with that date's Rejections.

**Note**:
The optional free-text line a Log entry carries — what the Household recorded
about that night's eating ("got the katsu curry", "too much rice", "the kids
didn't touch it"). It belongs to one entry on one date, so Notes form a series
over time and the newest one can be singled out as an Option's **Last note**.
Most Log entries have none. A Note is shown and edited wherever its entry
appears.
_Avoid_: "note" unqualified when **Option notes** is meant — they are different
things, and only a Note has a date.

**Option notes**:
The standing free-text description attached to an Option itself, maintained on
the Option detail page ("ask for the corner table", "recipe halves badly").
Unlike a Note it describes the Option, not one night, so it has no date and no
"last". It is read by AI search and never shown on Tonight.
_Avoid_: Note (singular, which is the Log entry's).

**Log**:
The full history of Log entries — both the `dinner_log` table and the screen
that shows it.
_Avoid_: Choices (too close to Option — the Log is realized history, not
candidate options).

**Tonight's dinner**:
Today's Dinner — the Log entries dated today — as surfaced on the Tonight
screen once the Household has Picked. May be one Option or several. When
the **Selected day** is a future date, the same decided block on Tonight
surfaces that day's Planned dinners with day-aware copy ("Friday's
dinner") — the term "Tonight's dinner" itself stays narrow to today.

**Pick** (verb):
To choose the dinner for the **Selected day**. Picking creates a Log entry
dated the Selected day — "pick = log". When the Selected day is today the
entry is **Tonight's dinner**; when it is a future date the entry is a
**Planned dinner**. A Pick *is* a Log entry; there is no separate "pick"
entity.

**Planned dinner**:
A Log entry dated after today. Excluded from the ranking until its date
arrives; shown in the Log screen's "Upcoming" section.
_Avoid_: Plan, Upcoming entry (as the domain term — "Upcoming" is only the
screen section's heading).

**Rejection**:
A record that the Household passed an Option over for one night's dinner,
carrying an optional short reason ("closed on Sundays", "too heavy for
tonight"). It is created two ways: live on a Tonight row in the moment —
dated the **Selected day** — or entered by hand on the Log screen or the
Option detail page for a deliberately chosen date — a past date backfills a
Rejection never recorded live, a future date is a **Planned rejection**. On the date it carries, a Rejection removes
its Option from Tonight's list for that day (the Option returns on its own the
next day); it is also kept as dated history fed into future AI searches, where
the model judges from the reason which Rejections are a standing dislike and
which were one-off. A Rejection can be edited or deleted at any time from the
Log screen or the Option detail page. **Bring back** is the narrower
Selected-day quick-undo on Tonight's "Rejected" disclosure (labelled
"Rejected tonight" when the Selected day is today). A Rejection is not a Log
entry and does not affect any Score.
_Avoid_: Archive (a Rejection covers one night; Archive removes an Option from
the Catalog until un-archived). Avoid "reject" for declining a whole AI result.

**Planned rejection**:
A Rejection dated after today — the mirror of a Planned dinner. Entered by hand
to turn an Option down in advance for a known future night ("Aji Ichi is closed
this coming Sunday"); when that date arrives it suppresses the Option from
Tonight just as a same-day Rejection does. Shown in the Log screen's "Upcoming"
section alongside Planned dinners. One specific date only — a recurring closure
is left for the AI model to infer from Rejection history.
_Avoid_: Recurring rejection (a Planned rejection is a single date).

### Ranking

**Selected day**:
The date the **Tonight** screen is currently ranking for. Defaults to today
and can be stepped in either direction to any date (ADR-0009 amended): forward
to plan ahead, back to edit a past night's Pick (its note, a mis-logged Remove)
or backfill a forgotten dinner. The whole Tonight screen — the deterministic
list, AI search, the decided **Dinner** block, and the live Reject control with
its "Bring back" disclosure — uses the Selected day as its anchor. The H1 reads
"Tonight" when the Selected day is today and shows the day's name otherwise (the
full date stays visible in the stepper); the navigation entry stays "Tonight"
either way. The H1 is also the reset: tapping the day name returns the Selected
day to today, from any distance and at any time — including when it already
reads "Tonight".
_Avoid_: target date, picking day, future day (today is a valid Selected day);
"going back to Tonight" for the reset (that reads as navigating to the Tonight
screen — say "reset the Selected day to today").

**Tonight**:
The home screen. It ranks active Options by Score (descending) for a
**Selected day** (defaulting to today, steppable to any past or future date),
and once a Pick is made it surfaces the Dinner for that day — the screen has
both jobs, deciding and showing what was decided. "Tonight" is the screen's
name and its H1 label when the Selected day is today; on any other day the H1
shows that day's name.

**Recency**:
How long since something was last eaten, measured only from non-future Log
entries of **active** Options — an Archived Option's history does not count
(archiving is rare and must not move the ranking). **Per-Option recency** is
days since that exact Option was last eaten; **per-Tag recency** is days since
any active Option carrying that Tag was last eaten.

**Score**:
The number that ranks an Option on Tonight: **Readiness × Affinity**. Readiness
asks "how overdue is this?"; Affinity asks "how much does the Household actually
want it?". Multiplying lets low Affinity hold back a stale-but-unloved Option,
so the list is "what we'd like *and* haven't had lately" rather than pure
anti-repeat. Higher = higher on the list.
_Avoid_: Anti-repeat, variety enforcer (Score is no longer recency alone —
that model surfaced disliked Options precisely because they were avoided).

**Readiness**:
The overdue half of the Score: a blend of an Option's **per-Option recency** and
the **per-Tag recency** of its Tags, on the capped-day scale. High when the
Household hasn't had this dish or its cuisine in a while. (This is the old
recency-only ranking, now one of the two Score factors.)

**Affinity**:
The preference half of the Score: a recency-weighted eat-**frequency** — how
often, and how recently, the Household has eaten an Option (and its cuisine) —
normalized so ~1.0 is catalog-average. It is the Household's *revealed*
preference, inferred from the Log with no rating field and no new schema. A
never-eaten Option inherits its cuisine's Affinity; one with no signal at all
sits at a neutral baseline. Rejections do **not** feed Affinity — they stay
day-scoped.
_Avoid_: Rating, preference score (it is inferred from eat-frequency, never
entered by hand).

**Recency chip**:
The small chip on each Tonight row showing the Option's own **per-Option
recency** — how long since the Household last had that exact Option ("18d",
"60d+" at the cap, "new" when it has never been eaten). It sits alongside the
Tag chips and surfaces one Score input as raw data; unlike the Explanation
chip it replaced, it does not narrate why the Option ranks where it does — the
Recency chip and the Tag chips together just show the numbers behind the
Score.
_Avoid_: Explanation chip (the retired prose line — Tonight no longer carries
a deterministic "why" sentence).

**Last note**:
The newest non-empty **Note** on a Log entry dated *strictly before* the
**Selected day**, surfaced on that Option's Tonight row with how long ago it was
written ("18d · got the katsu curry"). It answers "what happened last time we
had this?" at the moment of choosing, rather than only in Log history. Strictly
before, so the Selected day's own Pick is never its own Last note. An Option
with no earlier Note has no Last note and its row shows nothing. Every Tonight
row shows one — picker, AI search result, and decided alike — and a Rejection
reason is never a Last note, however useful it might read: the two would be
indistinguishable as one line of text, and "we ate this and it was salty" is not
"we didn't eat this because it was closed".
_Avoid_: "last note" for the Note on the Selected day's own Pick (that is just
that entry's **Note**); Last comment, Last review.

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
empty — and the model returns a ranked set of Options to fit it. The model
also reads the household's eating history for habits and rhythms — how often
something recurs, day-of-week tendencies, what tends to follow what — and lets
those shape the ranking, surfacing patterns — day-of-week rhythms, what follows
what — the deterministic Score's recency-and-frequency cannot; with an empty
query, finding those patterns is the whole job.
Always a deliberate action; it never replaces the deterministic ranking as the
default Tonight view. The model decides how many Options to return, so a
narrowing query yields a subset of the Catalog, not the whole list.
_Avoid_: AI ranking (it is search — there is a query, even when empty).

**AI rationale**:
The model-generated line of prose on each AI search result row explaining why
that Option fits — naming the query intent and/or the habit the model found in
the Log ("Light and fast — a soup, and it's been three weeks"). Generative and
query-aware, and unique to AI search — the deterministic Tonight list has no
prose "why" line; it shows the Recency chip and Tag chips instead.
_Avoid_: Recency chip (the deterministic per-Option recency indicator is data,
not a rationale).

### Lifecycle & access

**Active**:
An Option that appears on Tonight and in the default Catalog list
(`active = true`).

**Archived**:
An Option set inactive (`active = false`): hidden from Tonight and the default
Catalog list, but still shown in Log history. The action of setting it so is
**Archive**.
_Avoid_: Inactive (as the state term).

**Hard-delete**:
Permanently removing an Option from the Catalog. Allowed only for an Option
with zero Log entries; an Option with Log history is Archived instead, never
hard-deleted.

**Household**:
The single group of people who share the app and its one password. The app is
single-household — no user accounts, no per-person identity.

## Relationships

- An **Option** is exactly one **kind**: a **Home meal** or a **Restaurant**.
- An **Option** carries zero or more **Tags**.
- The **Catalog** is the set of all **Options**.
- A **Log entry** records exactly one **Option** on one date.
- A **Dinner** is one or more **Log entries** sharing the same date.
- The **Log** is the set of all **Log entries**.
- **Picking** creates a **Log entry** dated the **Selected day**.
- A **Planned dinner** is a **Log entry** dated after today.
- **Tonight** ranks active **Options** by **Score** for the **Selected day**.
- **Tonight** surfaces **Tonight's dinner** once a **Pick** is made.
- An Option's **Score** is its **Readiness** (per-Option + per-Tag recency)
  times its **Affinity** (recency-weighted eat-frequency).
- Each **Tonight** row carries one **Recency chip**.
- A **Log entry** carries zero or one **Note**; an **Option** carries its own
  standing **Option notes**.
- A **Tonight** row shows the Option's **Last note** — its newest **Note** dated
  before the **Selected day** — when it has one.
- An **Option** is either **Active** or **Archived**.
- A **Household** may **Reject** an Option for one night — live on **Tonight**,
  or entered by hand on the **Log** for any past, present, or future date.
- A **Rejection** is kept as dated history and feeds future **AI searches**; a
  **Rejection** dated after today is a **Planned rejection** and suppresses its
  Option from **Tonight** when that date arrives.
- An **Option** with any **Log entry** cannot be **hard-deleted** — only
  **Archived**.
- The **Household** shares one password; there are no user accounts.

## Example dialogue

> **Dev:** "If we Pick a Restaurant tonight and also Pick a Home meal, is that
> two Dinners?"
> **Domain expert:** "No — one Dinner, two Log entries. A Dinner is the
> evening; both entries just sit on today's date."
>
> **Dev:** "And if I add a Log entry for next Friday?"
> **Domain expert:** "That's a Planned dinner. It shows in Upcoming, but it
> doesn't touch any Score until Friday arrives — planning Friday shouldn't
> make Friday's dish look recently eaten today."
>
> **Dev:** "If the Household stops eating an Option, do we delete it?"
> **Domain expert:** "Only if it has no Log entries. If it's in the Log,
> Archive it — it leaves Tonight but its past Dinners stay intact."

## Flagged ambiguities

- "Meal" was used loosely for both the unified catalog entry and the
  home-cooked kind specifically. Resolved: **Option** is the unified term;
  **Home meal** is reserved for `kind = 'home'`. Friendly UI copy ("Add a meal
  or restaurant") may still say "meal" — the glossary governs code, issues,
  and tests.
- "Dinner" was used for both a single log row and a whole evening. Resolved:
  **Log entry** is the single row; **Dinner** is the evening (one or more Log
  entries on a date).
- "Tonight" was defined as only the ranked picker list. Resolved: the Tonight
  screen has two jobs — ranking Options to choose from, and showing
  **Tonight's dinner** once a Pick is made.
- "Note" meant two different fields: the per-night text on a Log entry and the
  standing description on an Option. Resolved: **Note** is the Log entry's,
  **Option notes** is the Option's. Only a Note is dated, so only a Note can be
  a **Last note**.
- "Going back to Tonight" was used for two different things: navigating to the
  Tonight screen, and returning the **Selected day** to today while already on
  that screen. Resolved: the second is **resetting the Selected day to today**;
  "Tonight" unqualified always means the screen.
