import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertTriangle, Ban } from 'lucide-react';
import { requireUser } from '@/lib/profile';
import { createClient } from '@/lib/supabase/server';
import { loadFaceDay } from '@/lib/face/day';
import { CORRELATION_DISCLAIMER } from '@/lib/calc/correlation';
import { weightTrend } from '@/lib/calc/body';
import {
  ACTIVE_INTRO_RULE,
  AM_ROUTINE,
  DERM_REFERRAL,
  FACE_PHOTO_PROMPT,
  JAWLINE_NOT_RECOMMENDED,
  JAWLINE_TRUTH,
  OTC_ACTIVES,
  PM_ROUTINE,
} from '@/lib/face/routine';
import { SkinLog, type SkinToday } from '@/components/face/skin-log';
import { SkinTrend } from '@/components/face/skin-trend';
import { JawlineDrills } from '@/components/face/jawline-panel';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Face' };
export const dynamic = 'force-dynamic';

export default async function FacePage() {
  const { profile } = await requireUser();
  if (!profile) return null;

  const modules = new Set(profile.modules ?? []);
  const hasSkin = modules.has('face_skin');
  const hasJawline = modules.has('jawline');

  if (!hasSkin && !hasJawline) {
    return (
      <div className="space-y-4">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Face</h1>
          <p className="text-sm text-muted-foreground">
            Neither face module is switched on.
          </p>
        </header>
        <Link href="/tasks" className={buttonVariants({ variant: 'outline' })}>
          Turn one on
        </Link>
      </div>
    );
  }

  const face = await loadFaceDay(profile);

  const supabase = await createClient();
  const { data: measurements } = await supabase
    .from('body_measurements')
    .select('log_date, weight_kg, body_fat_pct')
    .eq('user_id', profile.id)
    .order('log_date', { ascending: true });

  const weighIns = (measurements ?? [])
    .filter((m) => typeof m.weight_kg === 'number')
    .map((m) => ({ date: m.log_date, weightKg: Number(m.weight_kg) }));
  const trend = weightTrend(weighIns);
  const latestBodyFat = [...(measurements ?? [])]
    .reverse()
    .find((m) => typeof m.body_fat_pct === 'number')?.body_fat_pct;

  const neckTaskDone = hasJawline ? await isTaskDone(profile.id, face.logDate, 'neck_posture') : false;

  const today: SkinToday = {
    amDone: Boolean(face.today?.am_done),
    pmDone: Boolean(face.today?.pm_done),
    breakouts: face.today?.breakouts ?? null,
    dairy: face.today?.dairy ?? null,
    notes: face.today?.notes ?? '',
  };

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <p className="label-xs">{face.logDate}</p>
        <h1 className="text-2xl font-semibold tracking-tight">Face</h1>
      </header>

      {face.dermReferral ? (
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-4" aria-hidden />
              See a dermatologist
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{DERM_REFERRAL}</p>
          </CardContent>
        </Card>
      ) : null}

      {hasSkin ? (
        <>
          <section className="space-y-3">
            <h2 className="label-xs">Today</h2>
            <SkinLog today={today} />
          </section>

          <section className="space-y-2">
            <h2 className="label-xs">Weekly trend</h2>
            <SkinTrend data={face.weeklyTrend} />
          </section>

          <section className="space-y-2">
            <h2 className="label-xs">What lines up with your skin</h2>
            <ul className="overflow-hidden rounded-lg border border-border">
              {face.correlations.map((item, index) => (
                <li
                  key={item.key}
                  className={`bg-card p-4 ${index > 0 ? 'border-t border-border' : ''}`}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm first-letter:uppercase">{item.label}</span>
                    {item.result.enoughData && item.result.r !== null ? (
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">
                        r {item.result.r > 0 ? '+' : ''}
                        {item.result.r}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{item.result.summary}</p>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">{CORRELATION_DISCLAIMER}</p>
          </section>

          <section className="space-y-3">
            <h2 className="label-xs">Routine</h2>
            <Routine title="Morning" steps={AM_ROUTINE} />
            <Routine title="Evening" steps={PM_ROUTINE} />
            <p className="text-xs text-muted-foreground">{ACTIVE_INTRO_RULE}</p>
          </section>

          <section className="space-y-2">
            <h2 className="label-xs">Over-the-counter actives</h2>
            <ul className="overflow-hidden rounded-lg border border-border">
              {OTC_ACTIVES.map((active, index) => (
                <li
                  key={active.slug}
                  className={`bg-card p-4 ${index > 0 ? 'border-t border-border' : ''}`}
                >
                  <p className="text-sm font-medium">{active.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{active.bestFor}</p>
                  <p className="mt-1 font-mono text-[0.65rem] text-muted-foreground">
                    Start: {active.startAt}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{active.caution}</p>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              Over-the-counter only. Anything prescription is a conversation with a doctor.
            </p>
          </section>
        </>
      ) : null}

      {hasJawline ? (
        <>
          <section className="space-y-2">
            <h2 className="label-xs">Jawline, honestly</h2>
            <ul className="space-y-2 rounded-lg border border-border bg-card p-4">
              {JAWLINE_TRUTH.map((line) => (
                <li key={line} className="text-xs text-muted-foreground">
                  · {line}
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="label-xs">Facial fat follows body fat</h2>
            <div className="rounded-lg border border-border bg-card p-4">
              {trend.currentKg !== null ? (
                <p className="font-mono text-sm">
                  {trend.currentKg} kg
                  {trend.weeklyChangeKg !== null ? (
                    <span className="text-muted-foreground">
                      {' '}
                      ({trend.weeklyChangeKg > 0 ? '+' : ''}
                      {trend.weeklyChangeKg} kg/week)
                    </span>
                  ) : null}
                  {typeof latestBodyFat === 'number' ? (
                    <span className="text-muted-foreground"> · ~{latestBodyFat}% body fat</span>
                  ) : null}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Log your weight on the Body page to track this.
                </p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                This is the lever that matters most. The drills below help, but they work on a
                face that is already leaning out.
              </p>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="label-xs">Neck and posture</h2>
            <JawlineDrills done={neckTaskDone} />
          </section>

          <section className="space-y-2">
            <h2 className="label-xs">Face photos</h2>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">{FACE_PHOTO_PROMPT}</p>
              <Link
                href="/body"
                className={buttonVariants({ variant: 'outline', size: 'sm', className: 'mt-3' })}
              >
                Take a face photo
              </Link>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="label-xs flex items-center gap-1.5">
              <Ban className="size-3.5" aria-hidden />
              Not recommended
            </h2>
            <ul className="space-y-1.5 rounded-lg border border-border bg-card p-4">
              {JAWLINE_NOT_RECOMMENDED.map((line) => (
                <li key={line} className="text-xs text-muted-foreground">
                  · {line}
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}

      <p className="text-xs text-muted-foreground">General guidance, not medical advice.</p>
    </div>
  );
}

function Routine({
  title,
  steps,
}: {
  title: string;
  steps: { slug: string; product: string; instruction: string; essential: boolean }[];
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <header className="bg-card p-4">
        <h3 className="text-sm font-semibold">{title}</h3>
      </header>
      <ol>
        {steps.map((step, index) => (
          <li key={step.slug} className="flex gap-3 border-t border-border bg-card p-4">
            <span className="font-mono text-xs text-muted-foreground">{index + 1}</span>
            <div className="min-w-0">
              <p className="text-sm">
                {step.product}
                {!step.essential ? (
                  <span className="ml-2 text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                    optional
                  </span>
                ) : null}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{step.instruction}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

async function isTaskDone(userId: string, logDate: string, slug: string): Promise<boolean> {
  const supabase = await createClient();

  const { data: template } = await supabase
    .from('task_templates')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  if (!template) return false;

  const { data: task } = await supabase
    .from('user_tasks')
    .select('id')
    .eq('user_id', userId)
    .eq('template_id', template.id)
    .maybeSingle();
  if (!task) return false;

  const { data: log } = await supabase
    .from('daily_logs')
    .select('completed')
    .eq('user_id', userId)
    .eq('user_task_id', task.id)
    .eq('log_date', logDate)
    .maybeSingle();

  return Boolean(log?.completed);
}
