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

**Closed day**:
A weekday a Restaurant is shut. It is a property of the Restaurant — a fact
about its trading week, not the Household's judgement about one night, which is
what separates it from a **Rejection**. The set stored is the days the
Restaurant is *closed*, so a Restaurant with none recorded is open all week and
an unfilled field suppresses nothing. Weekdays only: a Closed day carries no
opening or closing times (the app decides one meal a day), and no specific dates
— a one-off holiday closure is a **Planned rejection**. Only a Restaurant has
Closed days; a Home meal never does. On a day it is closed, a Restaurant leaves
Tonight's ranked list for the **Closed disclosure** and leaves AI search's
candidate set, exactly as a same-day Rejection does — a presentation filter that
never touches any Score (ADR-0010).
_Avoid_: Opening hours (a Closed day has no times); "closed" as a Rejection
reason (record the Closed day instead — a Rejection is about one night).

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

**Day note**:
The optional single-line free-text note the Household attaches to a calendar
date — a fact about that evening, not about any Option ("Jen won't be around",
"guests over", "late back from the airport"). It needs no Log entry, Rejection,
or Pick, so it can be written ahead for a future night. It is shown and edited
under Tonight's heading for the **Selected day**, and under its date on the
**Log** — a date with only a Day note still gets its own date group. It never changes a **Score** or
a suppression, never decides Tonight, and is never a **Last note**. Clearing its
text deletes it. UI copy says "Note for Friday"; code and docs say Day note.
_Avoid_: **Note** (a Log entry's, about that night's eating of one Option) and
**Option notes** (an Option's standing description) — a Day note belongs to
the date alone.

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
entity. Picking an Option on a date it carries a **Rejection** removes that
Rejection — the Household changed its mind, and a reason for passing the
Option over no longer describes a night it was eaten. This holds wherever the
Pick is made (Tonight, the Log, the Option detail page), and for any date —
including when a Log entry is edited onto that Option and date. The reverse is
refused: an Option already Picked on a date cannot be Rejected for it (see
**Day decision**).

**Planned dinner**:
A Log entry dated after today. Excluded from the ranking until its date
arrives; shown in the Log screen's "Upcoming" section.
_Avoid_: Plan, Upcoming entry (as the domain term — "Upcoming" is only the
screen section's heading).

**Rejection**:
A record that the Household passed an Option over for one night's dinner,
carrying an optional short reason ("too heavy for tonight", "we had it at
lunch"). It is created two ways: live on a Tonight row in the moment —
dated the **Selected day** — or entered by hand on the Log screen or the
Option detail page for a deliberately chosen date — a past date backfills a
Rejection never recorded live, a future date is a **Planned rejection**. On the date it carries, a Rejection removes
its Option from Tonight's list for that day (the Option returns on its own the
next day); it is also kept as dated history fed into future AI searches, where
the model weighs each reason as dated evidence: a reason may be a standing
dislike, a standing fact about how the Option works ("Jen cooks these only
when she has ingredients set", "comes in two-packs, suggest the second one
soon"), a passing state ("none left", "no box this week") that fades rather
than holding until the Household says otherwise, or a one-off. A reason that
the Option was too soon speaks for its **Tags** as well as for it: it is the
Household saying that kind of food is recent, so every Option sharing the Tag
is as recent as the one turned down. Nothing obliges
the Household to keep such state current. A Rejection can be edited or deleted at any time from the
Log screen or the Option detail page. **Bring back** is the narrower
Selected-day quick-undo on Tonight's "Rejected" disclosure (labelled
"Rejected tonight" when the Selected day is today). A **Pick** of the Option
on the Rejection's date removes the Rejection — changing one's mind and eating
it after all supersedes having passed it over. The reverse is refused: an
Option already Picked on a date cannot be Rejected for it, however the date is
reached (a new Rejection, or an existing one edited onto that date); the Pick
must be removed first. A Rejection is not a Log
entry and does not affect any Score. A Restaurant's recurring closure is no
longer expressed this way — that is a **Closed day** on the Restaurant itself
(ADR-0010) — though a Rejection remains the way to record what was learned on
one particular night, including on a night the Restaurant was already closed.
_Avoid_: Archive (a Rejection covers one night; Archive removes an Option from
the Catalog until un-archived). Closed day (a weekly closure is a property of
the Restaurant, not a nightly decision). Avoid "reject" for declining a whole AI
result.

**Planned rejection**:
A Rejection dated after today — the mirror of a Planned dinner. Entered by hand
to turn an Option down in advance for a known future night ("Aji Ichi is shut
for a private function this Friday"); when that date arrives it suppresses the
Option from Tonight just as a same-day Rejection does. Shown in the Log screen's
"Upcoming" section alongside Planned dinners. One specific date only. A closure
that repeats every week is a **Closed day** on the Restaurant, not a Planned
rejection (ADR-0010); the Planned rejection covers the one-off — a holiday, a
private function, a night the Household already knows is out.
_Avoid_: Recurring rejection (a Planned rejection is a single date); a Planned
rejection for a weekly closure (that is a **Closed day**).

**Day decision**:
What the Household decided about one Option for one date: a **Pick** of it or
a **Rejection** of it, never both. A Pick wins — Picking an Option removes its
Rejection on that date, and Rejecting an Option already Picked on that date is
refused until the Pick is removed. A date is **decided** once it carries any
Pick, whatever has happened to the Option since (an Archived Option's Pick
still decides its night); Rejections alone leave a date undecided.
_Avoid_: "decision" for an **AI search** result or a **Prepared note**'s
ranking (those are suggestions, not the Household's decisions).

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
shows that day's name. When the Selected day has a **Prepared note**, its brief
sits under the heading and its Prepared ranking is what the list shows on load.
The Score ranking is one Clear away.

**Closed disclosure**:
The collapsed list at the foot of **Tonight** holding the Restaurants dropped
from the ranked list because the **Selected day** falls on one of their **Closed
days** — headed "Closed tonight (N)" when the Selected day is today and "Closed
on Friday (N)" otherwise, sitting below the Rejected disclosure. Its rows are
ordered alphabetically and carry no rank number: it is a list, not a ranking.
Each row carries the same controls as a picker row, so the Household can still
Pick a Restaurant that turns out to be open after all, or Reject it with a
reason that records what was learned. Rejecting one moves it to the Rejected
disclosure.
_Avoid_: Closed list, Closed section.

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

**Interval**:
The usual number of days between the Household's eats of an Option — or, for a
Tag, of any active Option carrying it — over its whole history: the median of
every gap. It is the timing side of a habit: set against **Recency**, it says
whether something is recent *for that Option*. A median, so half the
Household's own gaps were shorter than it; how far short of its Interval an
Option may be and still be in play is a judgement for the evening, not a
threshold. The Interval is the habit over the whole history, so the AI
snapshot sets it beside the Option's **last few gaps** (its three newest): an
Option eaten every ten days for a year and every three weeks since carries an
Interval of ten and recent gaps of three weeks, and the two together say the
habit has slowed, which no single number could. Not a Score factor:
**Readiness** measures time since on one scale for every Option, and
**Affinity** measures how much an Option is wanted, not when it is due.
_Avoid_: Cadence (the habit itself, not its number), usual gap, overdue (the
Tag chip threshold, not a relation to the Interval).

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
query, finding those patterns is the whole job. It also reads every **Day
note**, past and future, as dated history, and treats the **Selected day**'s
own Day note as current context for the search.
Always a deliberate action, and never what Tonight loads with: what loads is a
**Prepared note**'s ranking if there is one, otherwise the deterministic list.
A search result sits on top of either one until cleared. The model decides how
many Options to return, so a narrowing query yields a subset of the Catalog,
not the whole list.
_Avoid_: AI ranking (it is search — there is a query, even when empty); AI
search for a **Prepared note** (that is written ahead, not searched).

**AI rationale**:
The model-generated line of prose on each AI search result row explaining why
that Option fits — naming the query intent, the habit the model found in the
Log, or what the Household's own **Notes** say about the Option ("Light and
fast — a soup, and the katsu was the good call last time"). Generative, and
query-aware on an AI search row. A **Prepared note**'s ranking rows carry one
too, with no query and more room: two or three sentences for the strong picks,
tapering to a short line for the tail. The deterministic Tonight list has no
prose "why" line; it shows the Recency chip and Tag chips instead.

A rationale states a **rhythm claim**, never an **elapsed-time claim**. A
rhythm claim names the shape of a habit — "runs about every two weeks and that
stretch is up", "the standing Thursday choice", "always follows a takeaway
night". An elapsed-time claim restates how long it has been, at any precision —
"9 days ago", "since early summer", "long out of rotation", "it's been a
while". The Recency chip and Tag chips already show elapsed time as numbers on
the same row, so an elapsed-time claim is redundant by construction however
well it is phrased; the Option's own **Interval** is the one timing fact the
chips cannot carry, and it qualifies a reason rather than being one.

On a strong pick the rationale leads with what the chips cannot show at all —
a Note, a weekday habit the Log bears out, a standing reason the Household once
gave, how the Option fits the shape of the evening — and timing earns at most a
clause ("…and its stretch is up"). A rationale whose only content is timing
belongs to the tail: a sense of why the Option sits low, nothing more.
_Avoid_: Recency chip (the deterministic per-Option recency indicator is data,
not a rationale).

**Prepared note**:
What a free local model writes ahead of time for one date, so it is ready when
Tonight opens (ADR-0011). It has two parts. The **brief** is two or three
sentences about that evening, read at a glance: what kind of evening it is
(the **Day note**, weekday habits, the last few days' eating), and the one or two
standout suggestions — what to reach for, with what sits low left to the
ranking. The **Prepared ranking** ranks every candidate Option with an **AI
rationale**. It is written only for an undecided date from today through six
days ahead, from the same snapshot AI search reads, and is rewritten in the
background whenever that input changes. Once its date is **decided** (has a
**Pick**) it **freezes**: it keeps the last version written before the
Household decided, so it can be read against what was actually eaten ("The
note ranked Katsu curry #4"). A note also freezes once its date has passed,
decided or not — it is no longer advice for a night still to come. On Tonight
its brief sits under the heading, and its Prepared ranking is what the list
shows on load. An AI search result sits on top of it until cleared, and
clearing the Prepared ranking shows the deterministic list. It never changes a
**Score** or a suppression. A note that has not frozen and was built from older
inputs is labelled out of date; a frozen note never is. A date with no note
shows nothing.
_Avoid_: AI notes, AI brief (say Prepared note, or its brief); **Note** or
**Day note** (both are the Household's own writing, a Prepared note is the
model's); AI search (a Prepared note has no query and is never triggered).

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
- A **Restaurant** carries zero or more **Closed days**; a **Home meal** never
  carries any.
- The **Catalog** is the set of all **Options**.
- A **Log entry** records exactly one **Option** on one date.
- A **Dinner** is one or more **Log entries** sharing the same date.
- The **Log** is the set of all **Log entries**.
- **Picking** creates a **Log entry** dated the **Selected day**.
- **Picking** an Option removes any **Rejection** of that Option on the same
  date.
- A **Planned dinner** is a **Log entry** dated after today.
- **Tonight** ranks active **Options** by **Score** for the **Selected day**.
- **Tonight** surfaces **Tonight's dinner** once a **Pick** is made.
- An Option's **Score** is its **Readiness** (per-Option + per-Tag recency)
  times its **Affinity** (recency-weighted eat-frequency).
- Each **Tonight** row carries one **Recency chip**.
- A **Log entry** carries zero or one **Note**; an **Option** carries its own
  standing **Option notes**.
- A date carries zero or one **Day note**.
- A date carries zero or one **Prepared note**. It is written only while the
  date is undecided and within six days of today, and freezes once the date has
  a **Log entry** or has passed.
- An **Option** has at most one **Day decision** per date — a **Pick** or a
  **Rejection**, never both — and a Pick wins.
- A **Tonight** row shows the Option's **Last note** — its newest **Note** dated
  before the **Selected day** — when it has one.
- An **Option** is either **Active** or **Archived**.
- A **Household** may **Reject** an Option for one night — live on **Tonight**,
  or entered by hand on the **Log** for any past, present, or future date.
- A **Rejection** is kept as dated history and feeds future **AI searches**; a
  **Rejection** dated after today is a **Planned rejection** and suppresses its
  Option from **Tonight** when that date arrives.
- A **Restaurant** whose **Closed days** include the **Selected day**'s weekday
  leaves **Tonight**'s ranked list for the **Closed disclosure** and leaves **AI
  search**'s candidate set — without any change to its **Score**.
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
>
> **Dev:** "Aji Ichi is shut every Monday. Is that seven Planned rejections a
> year, or something else?"
> **Domain expert:** "Neither — it's a **Closed day** on Aji Ichi. A Rejection
> is us deciding something about a night; being shut on Mondays is true whether
> or not we ever thought about it. The Planned rejection is for the one-offs:
> they're closed this Friday for a private function."
>
> **Dev:** "And if we turn up on a Monday and they're actually open?"
> **Domain expert:** "Then the Closed day is wrong and we fix it on the
> Restaurant. The Closed disclosure still has a Pick button for that night, so
> we're not blocked — but the fix belongs on the Restaurant, not in a nightly
> override."
>
> **Dev:** "We Picked the katsu tonight. Should the Prepared note regenerate now
> that it's out of date?"
> **Domain expert:** "No, it freezes. The point of keeping it is to see what the
> model said before we decided. It had the katsu at #4, and that's worth
> knowing. If we Remove the Pick, the night is open again and the note can be
> rewritten."

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
- "Closed" was recorded two ways: as a **Rejection** reason ("closed on
  Sundays") on whichever night it bit, and — the intent behind it — as a
  standing fact about the Restaurant the model was expected to infer. Resolved:
  a closure that repeats weekly is a **Closed day** on the Restaurant; a
  Rejection reason describes one night's decision; a one-off closure on a known
  date is a **Planned rejection**. ADR-0010.
- "Going back to Tonight" was used for two different things: navigating to the
  Tonight screen, and returning the **Selected day** to today while already on
  that screen. Resolved: the second is **resetting the Selected day to today**;
  "Tonight" unqualified always means the screen.
- "AI notes" was the working name for the local model's written-ahead output,
  which collides with **Note**, **Option notes**, and **Day note**, all of which
  are the Household's own writing. Resolved: it is a **Prepared note** (a brief
  plus a Prepared ranking). ADR-0011.
