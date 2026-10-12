export function DetailSkeleton() {
  return (
    <div className="mt-6 space-y-6" aria-busy="true" aria-label="Cargando el detalle">
      <div className="h-5 w-64 animate-pulse bg-line motion-reduce:animate-none" />
      <div className="h-10 w-full max-w-md animate-pulse bg-line motion-reduce:animate-none" />
      <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-16 border-t border-line bg-line/40" />
        ))}
      </div>
      <div className="h-40 border border-line bg-surface" />
    </div>
  );
}
