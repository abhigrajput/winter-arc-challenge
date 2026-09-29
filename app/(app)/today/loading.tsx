export default function TodayLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-3 w-20 animate-pulse rounded bg-muted" />
        <div className="h-9 w-48 animate-pulse rounded bg-muted" />
      </div>
      <div className="h-48 animate-pulse rounded-lg bg-muted" />
    </div>
  );
}
