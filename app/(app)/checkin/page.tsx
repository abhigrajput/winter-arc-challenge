import type { Metadata } from 'next';
import { requireUser } from '@/lib/profile';
import { createClient } from '@/lib/supabase/server';
import { challengeDay, phaseForDay } from '@/lib/calc/day';
import { POINTS } from '@/lib/calc/points';
import { CheckinForm } from '@/components/checkin/checkin-form';

export const metadata: Metadata = { title: 'Check-in' };
export const dynamic = 'force-dynamic';

export default async function CheckinPage() {
  const { profile } = await requireUser();
  if (!profile) return null;

  const day = challengeDay(profile.challenge_start, profile.timezone ?? '');
  const phase = phaseForDay(day);

  const supabase = await createClient();
  const [{ data: thisWeek }, { data: past }] = await Promise.all([
    supabase
      .from('checkins')
      .select('id')
      .eq('user_id', profile.id)
      .eq('week', phase.week)
      .maybeSingle(),
    supabase
      .from('checkins')
      .select('week, calorie_adjustment, ai_feedback, created_at')
      .eq('user_id', profile.id)
      .order('week', { ascending: false })
      .limit(6),
  ]);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="label-xs">
          Week {phase.week} · {phase.name}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Weekly check-in</h1>
        <p className="text-sm text-muted-foreground">
          A look at the week and what changes next. Worth {POINTS.checkin} points.
        </p>
      </header>

      <CheckinForm week={phase.week} alreadyDone={Boolean(thisWeek)} />

      {past && past.length > 0 ? (
        <section className="space-y-2">
          <h2 className="label-xs">Previous</h2>
          <ul className="overflow-hidden rounded-lg border border-border">
            {past.map((row) => {
              const feedback = row.ai_feedback as { verdict?: string } | null;
              return (
                <li key={row.week} className="border-t border-border bg-card p-4 first:border-t-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm">Week {row.week}</span>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">
                      {row.calorie_adjustment !== null && row.calorie_adjustment !== 0
                        ? `${row.calorie_adjustment > 0 ? '+' : ''}${row.calorie_adjustment} kcal`
                        : 'no change'}
                    </span>
                  </div>
                  {feedback?.verdict ? (
                    <p className="mt-1 text-xs text-muted-foreground">{feedback.verdict}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <p className="text-xs text-muted-foreground">General guidance, not medical advice.</p>
    </div>
  );
}
