/**
 * Walking-skeleton placeholder. It renders nothing of the real product yet —
 * its job is to prove Next.js, Tailwind and the §16 design tokens are wired
 * up: warm palette, system font, the single centered-column primitive.
 */
export default function Home() {
  return (
    <main className="column flex min-h-screen flex-col justify-center gap-3 py-5.5">
      <h1 className="text-h1 font-h1 text-ink">Pick Me a Dinner</h1>
      <p className="text-body text-muted">
        Helps one household decide what&apos;s for dinner. This walking skeleton
        wires up Next.js, Drizzle, PostgreSQL and Tailwind end to end — the real
        Tonight, Log and Catalog screens land in the issues that follow.
      </p>
      <span className="self-start rounded-full bg-chip px-3 py-1.5 text-chip text-muted">
        warm palette · system font · single centered column
      </span>
    </main>
  );
}
