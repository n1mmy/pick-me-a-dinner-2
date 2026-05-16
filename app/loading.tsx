/** §17 Tonight loading state — calm placeholder rows, no shimmer. */
export default function TonightLoading() {
  return (
    <main className="column flex min-h-screen flex-col gap-5.5 py-5.5">
      <h1 className="text-h1 font-h1 text-ink">Tonight</h1>
      <div className="flex flex-col">
        {[0, 1, 2, 3, 4].map((row) => (
          <div key={row} className="h-16 border-b border-line" />
        ))}
      </div>
    </main>
  );
}
