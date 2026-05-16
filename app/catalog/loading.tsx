/** §17 Catalog loading state — calm placeholder rows, no shimmer. */
export default function CatalogLoading() {
  return (
    <main className="column flex min-h-screen flex-col gap-5.5 py-5.5">
      <h1 className="text-h1 font-h1 text-ink">Catalog</h1>
      {[0, 1].map((section) => (
        <div key={section} className="flex flex-col gap-2">
          <div className="h-3 w-28 rounded-badge bg-chip" />
          {[0, 1, 2].map((row) => (
            <div key={row} className="h-11 border-b border-line" />
          ))}
        </div>
      ))}
    </main>
  );
}
