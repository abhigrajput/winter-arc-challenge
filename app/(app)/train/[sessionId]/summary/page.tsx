import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Trophy } from 'lucide-react';
import { requireUser } from '@/lib/profile';
import { createClient } from '@/lib/supabase/server';
import { epley1RM, sessionVolume, suggestOverload } from '@/lib/calc/progression';
import { repRange } from '@/lib/workout/splits';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Session summary' };
export const dynamic = 'force-dynamic';

export default async function SummaryPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const { profile } = await requireUser();
  if (!profile) return null;

  const supabase = await createClient();

  const { data: session } = await supabase
    .from('workout_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('user_id', profile.id)
    .maybeSingle();

  if (!session) notFound();

  const { data: sets } = await supabase
    .from('workout_sets')
    .select('*')
    .eq('session_id', sessionId)
    .order('set_no');

  const { data: library } = await supabase.from('exercises').select('*');
  const byId = new Map((library ?? []).map((e) => [e.id, e]));

  const allSets = sets ?? [];
  const volume = sessionVolume(allSets);
  const prs = allSets.filter((s) => s.is_pr);

  const durationMin =
    session.started_at && session.finished_at
      ? Math.max(
          1,
          Math.round(
            (new Date(session.finished_at).getTime() - new Date(session.started_at).getTime()) /
              60000,
          ),
        )
      : null;

  const exerciseIds = [...new Set(allSets.map((s) => s.exercise_id))];

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="label-xs">{session.session_date}</p>
        <h1 className="text-2xl font-semibold tracking-tight">{session.plan_day ?? 'Session'}</h1>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Session</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-3 gap-4 text-center">
            <Stat label="Sets" value={allSets.length} />
            <Stat label="Volume" value={volume > 0 ? `${volume}` : '—'} unit={volume > 0 ? 'kg' : ''} />
            <Stat label="Time" value={durationMin ?? '—'} unit={durationMin ? 'min' : ''} />
          </dl>
        </CardContent>
      </Card>

      {prs.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="size-4 text-primary" aria-hidden />
              {prs.length} personal {prs.length === 1 ? 'record' : 'records'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {prs.map((set) => {
                const exercise = byId.get(set.exercise_id);
                const bodyweight = Boolean(exercise?.is_bodyweight);
                return (
                  <li key={set.id} className="flex justify-between">
                    <span>{exercise?.name ?? 'Exercise'}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {bodyweight
                        ? `${set.reps} reps`
                        : `${set.weight_kg} kg x ${set.reps} · e1RM ${epley1RM(set.weight_kg ?? 0, set.reps ?? 0)}`}
                    </span>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <section className="space-y-2">
        <h2 className="label-xs">Next session</h2>
        <ul className="overflow-hidden rounded-lg border border-border">
          {exerciseIds.map((id, index) => {
            const exercise = byId.get(id);
            if (!exercise) return null;
            const exerciseSets = allSets.filter((s) => s.exercise_id === id);
            const isBodyweight = Boolean(exercise.is_bodyweight);
            const range = repRange(isBodyweight, profile.fitness_level);
            const nextUp = (library ?? []).find((e) => e.progression_of === id);

            const suggestion = suggestOverload({
              sets: exerciseSets,
              repRangeTop: range.top,
              isBodyweight,
              nextProgressionName: nextUp?.name ?? null,
            });

            return (
              <li
                key={id}
                className={`bg-card p-4 ${index > 0 ? 'border-t border-border' : ''}`}
              >
                <p className="text-sm">{exercise.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{suggestion.advice}</p>
              </li>
            );
          })}
        </ul>
      </section>

      {session.notes ? (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{session.notes}</p>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex gap-3">
        <Link href="/train" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
          Train
        </Link>
        <Link href="/today" className={buttonVariants({ size: 'lg', className: 'flex-1' })}>
          Back to today
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: number | string; unit?: string }) {
  return (
    <div>
      <dt className="label-xs">{label}</dt>
      <dd className="font-mono text-xl">{value}</dd>
      {unit ? <dd className="text-[0.65rem] text-muted-foreground">{unit}</dd> : null}
    </div>
  );
}
