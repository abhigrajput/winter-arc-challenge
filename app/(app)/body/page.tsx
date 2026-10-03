import type { Metadata } from 'next';
import { requireUser } from '@/lib/profile';
import { createClient } from '@/lib/supabase/server';
import { localDate } from '@/lib/calc/day';
import { measurementDeltas, movingAverage, weightTrend } from '@/lib/calc/body';
import { BODY_FAT_ERROR_MARGIN, bodyFatRange } from '@/lib/calc/bodyfat';
import { groupByAngle, type PhotoAngle } from '@/lib/body/angles';
import { loadPhotos } from '@/lib/body/photos';
import { WeightChart } from '@/components/body/weight-chart';
import { PhotoPanel, type ClientPhoto } from '@/components/body/photo-panel';
import { MeasurementForm } from '@/components/body/measurement-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Body' };
export const dynamic = 'force-dynamic';

export default async function BodyPage() {
  const { profile } = await requireUser();
  if (!profile) return null;

  const supabase = await createClient();
  const today = localDate(profile.timezone ?? '');

  const [{ data: rows }, photos] = await Promise.all([
    supabase
      .from('body_measurements')
      .select('*')
      .eq('user_id', profile.id)
      .order('log_date', { ascending: true }),
    loadPhotos(profile.id),
  ]);

  const measurements = rows ?? [];
  const latest = measurements[measurements.length - 1];
  const first = measurements[0];
  const todayRow = measurements.find((m) => m.log_date === today);

  const weighIns = measurements
    .filter((m) => typeof m.weight_kg === 'number')
    .map((m) => ({ date: m.log_date, weightKg: Number(m.weight_kg) }));

  const trend = weightTrend(weighIns);
  const points = movingAverage(weighIns);

  const bodyFat = latest?.body_fat_pct ? Number(latest.body_fat_pct) : null;
  const fatRange = bodyFat === null ? null : bodyFatRange(bodyFat);

  const deltas =
    first && latest && first.log_date !== latest.log_date
      ? measurementDeltas(toSet(first), toSet(latest))
      : [];

  const clientPhotos = groupByAngle(photos) as Record<PhotoAngle, ClientPhoto[]>;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="label-xs">{today}</p>
        <h1 className="text-2xl font-semibold tracking-tight">Body</h1>
        <p className="text-sm text-muted-foreground">
          {trend.currentKg !== null
            ? `7-day average ${trend.currentKg} kg${
                trend.weeklyChangeKg !== null
                  ? ` · ${trend.weeklyChangeKg > 0 ? '+' : ''}${trend.weeklyChangeKg} kg this week`
                  : ''
              }`
            : 'No weight logged yet.'}
        </p>
      </header>

      <section className="space-y-2">
        <h2 className="label-xs">Weight</h2>
        <WeightChart points={points} />
      </section>

      {fatRange ? (
        <Card>
          <CardHeader>
            <CardTitle>Body fat estimate</CardTitle>
            <CardDescription>
              Tape-measure estimate, accurate to about {BODY_FAT_ERROR_MARGIN} points either way.
              Watch the direction, not the number.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-3xl">
              {fatRange.low}-{fatRange.high}%
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Body fat estimate</CardTitle>
            <CardDescription>Add waist + neck below to get an estimate.</CardDescription>
          </CardHeader>
        </Card>
      )}

      {deltas.length > 0 ? (
        <section className="space-y-2">
          <h2 className="label-xs">
            Since {first!.log_date}
          </h2>
          <ul className="overflow-hidden rounded-lg border border-border">
            {deltas.map((delta, index) => (
              <li
                key={delta.key}
                className={`flex items-baseline justify-between bg-card p-3 px-4 ${
                  index > 0 ? 'border-t border-border' : ''
                }`}
              >
                <span className="text-sm">{delta.label}</span>
                <span className="font-mono text-xs">
                  {delta.first} → {delta.latest} cm
                  <span
                    className={
                      delta.changeCm === 0
                        ? ' text-muted-foreground'
                        : ' text-primary'
                    }
                  >
                    {' '}
                    ({delta.changeCm > 0 ? '+' : ''}
                    {delta.changeCm})
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="label-xs">Log today</h2>
        <MeasurementForm
          needsHip={profile.sex === 'female'}
          current={{
            weight_kg: numberOrEmpty(todayRow?.weight_kg),
            waist_cm: numberOrEmpty(todayRow?.waist_cm),
            chest_cm: numberOrEmpty(todayRow?.chest_cm),
            arm_cm: numberOrEmpty(todayRow?.arm_cm),
            thigh_cm: numberOrEmpty(todayRow?.thigh_cm),
            neck_cm: numberOrEmpty(todayRow?.neck_cm),
            hip_cm: numberOrEmpty(todayRow?.hip_cm),
          }}
        />
      </section>

      <section className="space-y-2">
        <h2 className="label-xs">Photos</h2>
        <PhotoPanel photos={clientPhotos} />
      </section>
    </div>
  );
}

function toSet(row: {
  waist_cm: number | null;
  chest_cm: number | null;
  arm_cm: number | null;
  thigh_cm: number | null;
  neck_cm: number | null;
  hip_cm: number | null;
}) {
  return {
    waistCm: row.waist_cm,
    chestCm: row.chest_cm,
    armCm: row.arm_cm,
    thighCm: row.thigh_cm,
    neckCm: row.neck_cm,
    hipCm: row.hip_cm,
  };
}

function numberOrEmpty(value: number | null | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}
