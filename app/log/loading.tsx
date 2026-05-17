/** §17 Log loading state — calm placeholder rows, no shimmer. */
export default function LogLoading() {
  return (
    <main className="column flex min-h-screen flex-col gap-5.5 py-5.5">
      <h1 className="font-display text-h1 font-h1 text-ink">Log</h1>
      <div className="flex flex-col">
        {[0, 1, 2, 3, 4].map((row) => (
          <div key={row} className="h-16 border-b border-line" />
        ))}
      </div>
    </main>
  );
}
