import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Award, Flame, Trophy } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { CHALLENGE_DAYS, challengeDayOn, phaseForDay } from '@/lib/calc/day';
import { heatmapWeeks } from '@/lib/stats/heatmap';
import { sortForDisplay } from '@/lib/achievements';
import { CompletionHeatmap } from '@/components/stats/heatmap';

/**
 * Public profile (§8.12): day count, streak, achievements, completion heatmap.
 *
 * Reads only public_profiles (five columns), get_public_profile (daily
 * completion counts + badge codes) and get_streak. None of them can return
 * weight, measurements, nutrition or photos. A private or unfinished profile
 * is a plain 404, so the page does not reveal that the account exists.
 */

type Params = Promise<{ username: string }>;

async function loadProfile(username: string) {
  const supabase = await createClient();
  const handle = username.toLowerCase();

  const { data: profile } = await supabase
    .from('public_profiles')
    .select('id, username, display_name, challenge_start')
    .eq('username', handle)
    .maybeSingle();

  if (!profile) return null;

  const [{ data: stats }, { data: streak }] = await Promise.all([
    supabase.rpc('get_public_profile', { p_username: handle }),
    supabase.rpc('get_streak', { p_user: profile.id }),
  ]);

  if (!stats) return null;
  return { profile, stats, streak: streak ?? 0 };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { username } = await params;
  return {
    title: `@${username.toLowerCase()}`,
    description: 'A Winter Arc public profile: day count, streak and badges.',
  };
}

export default async function PublicProfilePage({ params }: { params: Params }) {
  const { username } = await params;
  const loaded = await loadProfile(username);
  if (!loaded) notFound();

  const { profile, stats, streak } = loaded;
  const day = challengeDayOn(profile.challenge_start, stats.today);
  const phase = day > 0 ? phaseForDay(day) : null;
  const weeks = heatmapWeeks(stats.days, profile.challenge_start);
  const earned = sortForDisplay(new Set(stats.achievements)).filter((a) => a.earned);
  const name = profile.display_name || profile.username || 'Unknown';

  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8">
      <header className="space-y-3">
        <Link href="/leaderboard" className="label-xs hover:text-foreground">
          Winter Arc · Leaderboard
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
          <p className="font-mono text-sm text-muted-foreground">@{profile.username}</p>
        </div>
      </header>

      <section aria-label="Progress" className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="label-xs">Day</p>
          <p className="font-mono text-3xl" data-testid="profile-day">
            {day}
            <span className="text-base text-muted-foreground">/{CHALLENGE_DAYS}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {phase ? `${phase.name} · week ${phase.week}` : 'Not started yet'}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="label-xs">Streak</p>
          <p className="flex items-center gap-2 font-mono text-3xl" data-testid="profile-streak">
            <Flame className="size-6 text-primary" aria-hidden />
            {streak}
          </p>
          <p className="text-xs text-muted-foreground">days at 80% or better</p>
        </div>
      </section>

      <section aria-label="Completion" className="space-y-3">
        <h2 className="label-xs">Completion</h2>
        <CompletionHeatmap weeks={weeks} today={stats.today} />
      </section>

      <section aria-label="Achievements" className="space-y-3">
        <h2 className="label-xs">Badges</h2>
        {earned.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No badges yet.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-3">
            {earned.map((badge) => (
              <li key={badge.code} className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
                <Award className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <span>
                  <span className="block text-sm font-medium">{badge.name}</span>
                  <span className="block text-xs text-muted-foreground">{badge.description}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
        <Trophy className="size-3.5" aria-hidden />
        Discipline only. Body data and photos are never public.
      </p>
    </main>
  );
}
