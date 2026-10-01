import type { Metadata } from 'next';
import Link from 'next/link';
import { Dumbbell } from 'lucide-react';
import { requireUser } from '@/lib/profile';
import { buildSessionPlan, findOpenSession } from '@/lib/workout/session';
import { createClient } from '@/lib/supabase/server';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { startSession } from './actions';

export const metadata: Metadata = { title: 'Train' };
export const dynamic = 'force-dynamic';

export default async function TrainPage() {
  const { profile } = await requireUser();
  if (!profile) return null;

  const [open, plan] = await Promise.all([findOpenSession(profile), buildSessionPlan(profile)]);

  const supabase = await createClient();
  const { data: recent } = await supabase
    .from('workout_sessions')
    .select('id, session_date, plan_day, finished_at')
    .eq('user_id', profile.id)
    .not('finished_at', 'is', null)
    .order('finished_at', { ascending: false })
    .limit(5);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="label-xs">Next session</p>
        <h1 className="text-2xl font-semibold tracking-tight">{plan.day.name}</h1>
        <p className="text-sm text-muted-foreground">
          {plan.exercises.length} exercises · {profile.session_minutes ?? 45} min ·{' '}
          {profile.training_mode ?? 'home'}
        </p>
      </header>

      {open ? (
        <Card>
          <CardHeader>
            <CardTitle>Session in progress</CardTitle>
            <CardDescription>You started one today and have not finished it.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href={`/train/${open.id}`} className={buttonVariants({ size: 'lg' })}>
              Back to it
            </Link>
          </CardContent>
        </Card>
      ) : (
        <form action={startSession}>
          <Button type="submit" size="lg" className="w-full">
            <Dumbbell />
            Start {plan.day.name}
          </Button>
        </form>
      )}

      <section className="space-y-2">
        <h2 className="label-xs">Today&apos;s plan</h2>
        <ul className="overflow-hidden rounded-lg border border-border">
          {plan.exercises.map((item, index) => (
            <li
              key={item.exercise.id}
              className={`flex items-center justify-between bg-card p-4 ${index > 0 ? 'border-t border-border' : ''}`}
            >
              <div className="min-w-0">
                <p className="text-sm">{item.exercise.name}</p>
                <p className="font-mono text-xs text-muted-foreground">
                  {item.sets} x {item.repLow}-{item.repTop}
                  {item.previous?.lastWeightKg ? ` · last ${item.previous.lastWeightKg} kg` : ''}
                </p>
              </div>
              <span className="shrink-0 font-mono text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                {item.exercise.muscle_group}
              </span>
            </li>
          ))}
        </ul>
        {plan.exercises.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No exercises match your equipment. Add equipment in setup.
          </p>
        ) : null}
      </section>

      {recent && recent.length > 0 ? (
        <section className="space-y-2">
          <h2 className="label-xs">Recent</h2>
          <ul className="overflow-hidden rounded-lg border border-border">
            {recent.map((session, index) => (
              <li key={session.id} className={index > 0 ? 'border-t border-border' : ''}>
                <Link
                  href={`/train/${session.id}/summary`}
                  className="flex items-center justify-between bg-card p-4 transition-colors hover:bg-accent"
                >
                  <span className="text-sm">{session.plan_day ?? 'Session'}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {session.session_date}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
