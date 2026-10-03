export default function LeaderboardLoading() {
  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8" aria-busy="true">
      <div className="space-y-3">
        <div className="h-3 w-20 animate-pulse rounded bg-muted" />
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
      </div>
      <div className="h-11 w-full animate-pulse rounded-lg bg-muted" />
      <div className="space-y-px overflow-hidden rounded-lg border border-border">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="h-14 animate-pulse bg-muted/60" />
        ))}
      </div>
    </main>
  );
}
