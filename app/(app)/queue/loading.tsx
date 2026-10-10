// Skeleton shaped like the ledger so the layout does not jump when data arrives.
export default function QueueLoading() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-12" aria-busy="true" aria-label="Cargando la cola">
      <div className="h-5 w-48 animate-pulse bg-line motion-reduce:animate-none" />
      <div className="mt-3 h-10 w-full max-w-lg animate-pulse bg-line motion-reduce:animate-none" />
      <div className="mt-8 h-16 w-full animate-pulse border-y border-line motion-reduce:animate-none" />
      <div className="mt-8 divide-y divide-line border border-line bg-surface">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-6 px-4 py-5">
            <div className="h-6 w-16 bg-line/70" />
            <div className="h-4 flex-1 bg-line/70" />
            <div className="h-3 w-40 bg-line/70" />
          </div>
        ))}
      </div>
      <p className="sr-only">Cargando discrepancias…</p>
    </main>
  );
}
