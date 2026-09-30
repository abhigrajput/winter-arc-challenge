import type { Metadata } from 'next';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { requireUser } from '@/lib/profile';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CHALLENGE_DAYS } from '@/lib/calc/projection';

export const metadata: Metadata = { title: 'Today' };

export default async function TodayPage() {
  const { profile, email } = await requireUser();

  const day = profile?.challenge_start
    ? Math.min(
        CHALLENGE_DAYS,
        Math.max(0, differenceInCalendarDays(new Date(), parseISO(profile.challenge_start)) + 1),
      )
    : 0;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="label-xs">
          Day {day} / {CHALLENGE_DAYS}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          {profile?.display_name ?? profile?.username ?? email ?? 'Athlete'}
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daily targets</CardTitle>
          <CardDescription>
            Locked in at setup. Re-calculated by the weekly check-in later on.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-4 gap-4 text-center">
            <Target label="Calories" value={profile?.calorie_target} unit="kcal" />
            <Target label="Protein" value={profile?.protein_target_g} unit="g" />
            <Target label="Carbs" value={profile?.carbs_target_g} unit="g" />
            <Target label="Fat" value={profile?.fat_target_g} unit="g" />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Checklist coming</CardTitle>
          <CardDescription>
            The daily tasks, streak and points land in Phase 3. Your plan is already saved.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="label-xs">Goal</dt>
              <dd className="font-mono">{profile?.goal ?? '—'}</dd>
            </div>
            <div>
              <dt className="label-xs">Training</dt>
              <dd className="font-mono">
                {profile?.training_mode ?? '—'} · {profile?.days_per_week ?? '—'}x
              </dd>
            </div>
            <div>
              <dt className="label-xs">Water</dt>
              <dd className="font-mono">
                {profile?.water_target_ml ? `${(profile.water_target_ml / 1000).toFixed(1)} L` : '—'}
              </dd>
            </div>
            <div>
              <dt className="label-xs">Modules</dt>
              <dd className="font-mono">
                {profile?.modules?.length ? profile.modules.join(', ') : 'none'}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}

function Target({ label, value, unit }: { label: string; value?: number | null; unit: string }) {
  return (
    <div>
      <dt className="label-xs">{label}</dt>
      <dd className="font-mono text-xl">{value ?? '—'}</dd>
      <dd className="text-[0.65rem] text-muted-foreground">{unit}</dd>
    </div>
  );
}
