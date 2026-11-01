/**
 * §17 Tonight loading state — calm placeholder rows, no shimmer. The H1
 * sits where Tonight's sticky header puts it — 8px from the top, centred in
 * the stepper's 36px row — so it doesn't jump when the page arrives.
 */
export default function TonightLoading() {
  return (
    <main className="column flex min-h-screen flex-col gap-5.5 pb-5.5 pt-2">
      <div className="flex min-h-9 items-center">
        <h1 className="font-display text-h1 font-h1 text-ink">Tonight</h1>
      </div>
      <div className="flex flex-col">
        {[0, 1, 2, 3, 4].map((row) => (
          <div key={row} className="h-16 border-b border-divider" />
        ))}
      </div>
    </main>
  );
}
