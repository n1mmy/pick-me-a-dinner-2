/**
 * The browser suite's fixture, as data: what `prepare-db.ts` inserts and what
 * the specs expect to see. Dates are days relative to today in `APP_TZ`.
 */

/** The model recorded on the fixture's notes. */
export const FIXTURE_MODEL = "e2e-fixture";

export const OPTIONS = [
  { name: "Lemon Chicken Traybake", kind: "home", tags: ["comfort"] },
  { name: "Mushroom Risotto", kind: "home", tags: ["comfort", "vegetarian"] },
  { name: "Black Bean Tacos", kind: "home", tags: ["quick", "spicy", "vegetarian"] },
  // Never eaten: the Cold start.
  { name: "Miso Salmon Bowls", kind: "home", tags: ["quick"] },
  { name: "Pho Saigon", kind: "restaurant", tags: ["quick", "takeout"] },
  // Closed on the weekday two days out, so neither today's nor tomorrow's
  // candidate set depends on the day the suite runs.
  { name: "Luigi's Pizzeria", kind: "restaurant", tags: ["comfort", "takeout"], closedInDays: 2 },
  { name: "Thai Basil", kind: "restaurant", tags: ["quick", "spicy", "takeout"] },
] as const;

/** Past dinners, by days ago: about ten over the last forty days. */
export const LOG: { daysAgo: number; name: string; note?: string }[] = [
  { daysAgo: 2, name: "Pho Saigon", note: "Broth was great — ask for extra basil next time." },
  { daysAgo: 5, name: "Mushroom Risotto" },
  { daysAgo: 9, name: "Lemon Chicken Traybake", note: "Kids finished it. Double the potatoes." },
  { daysAgo: 13, name: "Luigi's Pizzeria" },
  { daysAgo: 17, name: "Thai Basil", note: "Too spicy for Mia." },
  { daysAgo: 21, name: "Pho Saigon" },
  { daysAgo: 26, name: "Lemon Chicken Traybake" },
  { daysAgo: 30, name: "Mushroom Risotto" },
  { daysAgo: 35, name: "Luigi's Pizzeria", note: "Long wait on a weekend." },
  { daysAgo: 39, name: "Black Bean Tacos" },
];

export const DAY_NOTE = "Sam's back late from football — something quick.";

/** Tomorrow's Planned dinner. */
export const PLANNED = { name: "Thai Basil", note: "Pickup at six, mild for Mia." };

export const TODAY_BRIEF =
  "Sam's back late, so tonight wants something quick that doesn't keep anyone " +
  "at the stove. Tacos haven't been on the table in over a month and come " +
  "together in twenty minutes; Pho Saigon is the easy fallback if nobody wants " +
  "to cook.";

/** Today's Prepared ranking, by name, rationales tapering from three sentences to one. */
export const TODAY_RANKING: [string, string][] = [
  [
    "Black Bean Tacos",
    "It's been more than a month since the last taco night. They're on the " +
      "table in twenty minutes, which suits a late evening. Go easy on the " +
      "chipotle for Mia.",
  ],
  [
    "Miso Salmon Bowls",
    "Still untried, and quick enough for tonight. The rice cooker does most " +
      "of the work. A good night to finally give it a go.",
  ],
  [
    "Pho Saigon",
    "Two nights ago, but it's the quickest thing going. Order ahead and it's " +
      "ready when Sam is.",
  ],
  [
    "Lemon Chicken Traybake",
    "A crowd-pleaser last time. It needs forty minutes in the oven, though.",
  ],
  ["Luigi's Pizzeria", "Comfort, but the wait can run long."],
  ["Mushroom Risotto", "Too much stirring for a late night."],
  ["Thai Basil", "Already planned for tomorrow."],
];

export const TOMORROW_BRIEF =
  "Thai Basil is planned, so tonight is settled. If plans change, the tacos " +
  "still haven't had their turn.";

/** Tomorrow's Prepared ranking, written as the sweep would have the day before. */
export const TOMORROW_RANKING: [string, string][] = [
  ["Black Bean Tacos", "Overdue, and quick if the takeout plan falls through."],
  ["Miso Salmon Bowls", "Still untried."],
  ["Pho Saigon", "Fine, though it was only a few nights ago."],
  ["Lemon Chicken Traybake", "Good, if there's time for the oven."],
  ["Luigi's Pizzeria", "A long wait on a busy night."],
  ["Mushroom Risotto", "Too much stirring."],
];
