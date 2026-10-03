import type { Metadata } from 'next';
import Link from 'next/link';
import { Flame, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/server';
import {
  LEADERBOARD_LIMIT,
  LEADERBOARD_RANGES,
  parseRange,
  rankRows,
  type LeaderboardRange,
} from '@/lib/leaderboard';

export const metadata: Metadata = {
  title: 'Leaderboard',
  description: 'Ranked by discipline: points and streak. Nothing else.',
};

/**
 * Public. Anyone can read it, signed in or not (§8.12). Points and streak only;
 * get_leaderboard never returns body data, and private or unfinished profiles
 * are not listed at all.
 */
export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string | string[] }>;
}) {
  const range = parseRange((await searchParams).range);
  const supabase = await createClient();

  const [{ data, error }, { data: auth }] = await Promise.all([
    supabase.rpc('get_leaderboard', {
      p_days: LEADERBOARD_RANGES[range].days,
      p_limit: LEADERBOARD_LIMIT,
    }),
    supabase.auth.getUser(),
  ]);

  const viewerId = auth.user?.id ?? null;
  const rows = rankRows(data ?? []);
  const viewerListed = viewerId !== null && rows.some((r) => r.user_id === viewerId);

  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8">
      <header className="space-y-3">
        <Link href={viewerId ? '/today' : '/'} className="label-xs hover:text-foreground">
          Winter Arc
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Trophy className="size-5 text-primary" aria-hidden />
          Leaderboard
        </h1>
        <p className="text-sm text-muted-foreground">
          Ranked by discipline: points, then streak. Body data is never ranked or shown.
        </p>
      </header>

      <nav aria-label="Range" className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border">
        {(Object.keys(LEADERBOARD_RANGES) as LeaderboardRange[]).map((key) => (
          <Link
            key={key}
            href={key === 'week' ? '/leaderboard' : '/leaderboard?range=all'}
            aria-current={key === range ? 'page' : undefined}
            className={cn(
              'bg-card py-3 text-center text-xs font-medium uppercase tracking-wider transition-colors',
              key === range ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {LEADERBOARD_RANGES[key].label}
          </Link>
        ))}
      </nav>

      {error ? (
        <p role="alert" className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Could not load the board. Try again in a minute.
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Nobody on the board yet. Finish a day to get on it.
        </p>
      ) : (
        <ol className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card" aria-label={`${LEADERBOARD_RANGES[range].label} ranking`}>
          {rows.map((row) => {
            const isViewer = row.user_id === viewerId;
            const name = row.display_name || row.username || 'Unknown';
            return (
              <li
                key={row.user_id}
                data-testid="leaderboard-row"
                className={cn('flex items-center gap-3 px-4 py-3', isViewer && 'bg-primary/5')}
              >
                <span
                  className={cn(
                    'w-8 shrink-0 font-mono text-sm tabular-nums',
                    row.rank <= 3 ? 'text-primary' : 'text-muted-foreground',
                  )}
                >
                  {row.rank}
                </span>
                <span className="min-w-0 flex-1">
                  {row.username ? (
                    <Link href={`/u/${row.username}`} className="block truncate text-sm font-medium hover:underline">
                      {name}
                      {isViewer ? <span className="ml-2 text-xs text-primary">you</span> : null}
                    </Link>
                  ) : (
                    <span className="block truncate text-sm font-medium">{name}</span>
                  )}
                  {row.username ? (
                    <span className="block truncate font-mono text-xs text-muted-foreground">@{row.username}</span>
                  ) : null}
                </span>
                <span className="flex shrink-0 items-center gap-1 font-mono text-xs text-muted-foreground" title="Current streak">
                  <Flame className="size-3.5" aria-hidden />
                  <span className="tabular-nums">{row.current_streak}</span>
                  <span className="sr-only">day streak</span>
                </span>
                <span className="w-16 shrink-0 text-right font-mono text-sm tabular-nums">
                  {row.points}
                  <span className="ml-1 text-[0.65rem] text-muted-foreground">pts</span>
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {viewerId && !viewerListed && !error ? (
        <p className="text-xs text-muted-foreground">
          You are not on this board. Only public profiles with setup finished are ranked, and points
          start with your first completed task.
        </p>
      ) : null}

      {!viewerId ? (
        <p className="text-center text-sm">
          <Link href="/login" className="text-primary underline-offset-4 hover:underline">
            Start your 90 days
          </Link>
        </p>
      ) : null}
    </main>
  );
}
