/** Route-level skeleton shown while server pages stream in. */
export default function Loading() {
  return (
    <div className="animate-pulse space-y-5" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading… / جاري التحميل…</span>
      <div className="h-9 w-1/3 rounded-xl bg-stone-200" />
      <div className="flex gap-3">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-20 w-20 rounded-full bg-stone-200" />)}</div>
      {[0, 1].map((i) => (
        <div key={i} className="card space-y-3 p-4">
          <div className="h-6 w-1/4 rounded bg-stone-200" />
          <div className="grid grid-cols-3 gap-3">{[0, 1, 2].map((j) => <div key={j} className="h-40 rounded-xl bg-stone-200" />)}</div>
        </div>
      ))}
    </div>
  );
}
