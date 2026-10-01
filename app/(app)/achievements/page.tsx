import type { Metadata } from 'next';
import { Lock, Trophy } from 'lucide-react';
import { requireUser } from '@/lib/profile';
import { createClient } from '@/lib/supabase/server';
import { loadStats } from '@/lib/stats/load';
import { ACHIEVEMENTS, sortForDisplay } from '@/lib/achievements';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Achievements' };
export const dynamic = 'force-dynamic';

export default async function AchievementsPage() {
  const { profile } = await requireUser();
  if (!profile) return null;

  // Loading stats also awards anything newly earned.
  const stats = await loadStats(profile);

  const supabase = await createClient();
  const { data: rows } = await supabase
    .from('achievements')
    .select('code, earned_at')
    .eq('user_id', profile.id);

  const earnedAt = new Map((rows ?? []).map((row) => [row.code, row.earned_at]));
  const badges = sortForDisplay(stats.earnedCodes);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="label-xs">
          {stats.earnedCodes.size} of {ACHIEVEMENTS.length}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Achievements</h1>
        <p className="text-sm text-muted-foreground">
          Earned badges show on your public profile. Nothing about your body does.
        </p>
      </header>

      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {badges.map((badge) => (
          <li
            key={badge.code}
            className={cn(
              'flex items-start gap-3 rounded-lg border p-4',
              badge.earned ? 'border-primary/40 bg-primary/5' : 'border-border bg-card',
            )}
          >
            <span
              className={cn(
                'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full',
                badge.earned ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
              )}
              aria-hidden
            >
              {badge.earned ? <Trophy className="size-4" /> : <Lock className="size-3.5" />}
            </span>

            <div className="min-w-0">
              <p className={cn('text-sm font-medium', !badge.earned && 'text-muted-foreground')}>
                {badge.name}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{badge.description}</p>
              {badge.earned && earnedAt.get(badge.code) ? (
                <p className="mt-1 font-mono text-[0.65rem] text-muted-foreground">
                  {String(earnedAt.get(badge.code)).slice(0, 10)}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
