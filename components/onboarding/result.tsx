import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { buildPlan } from '@/lib/calc/plan';
import { VISIBLE_ABS_BODY_FAT } from '@/lib/calc/bodyfat';
import { weeksToBodyFat } from '@/lib/calc/projection';
import type { BodyMeasurementRow, ProfileRow } from '@/lib/supabase/types';
import { finishOnboarding } from '@/app/onboarding/actions';

/**
 * The §5 result screen. Every number comes from lib/calc, already guardrailed,
 * and nothing is written until the user presses Start Day 1.
 */
export function ResultStep({
  profile,
  baseline,
  back,
}: {
  profile: ProfileRow;
  baseline: BodyMeasurementRow | null;
  back: string | null;
}) {
  if (
    !profile.sex ||
    !profile.age ||
    !profile.height_cm ||
    !profile.weight_kg ||
    !profile.target_weight_kg ||
    !profile.activity_level ||
    !profile.goal
  ) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Some answers are still missing.</p>
        <Button asChild size="lg">
          <Link href="/onboarding">Go back</Link>
        </Button>
      </div>
    );
  }

  const plan = buildPlan({
    sex: profile.sex,
    age: profile.age,
    heightCm: profile.height_cm,
    weightKg: profile.weight_kg,
    targetWeightKg: profile.target_weight_kg,
    activityLevel: profile.activity_level,
    goal: profile.goal,
    waistCm: baseline?.waist_cm,
    neckCm: baseline?.neck_cm,
    hipCm: baseline?.hip_cm,
  });

  const absTarget = VISIBLE_ABS_BODY_FAT[profile.sex];
  const absEta = plan.bodyFat
    ? weeksToBodyFat(
        plan.bodyFat.estimate,
        absTarget.high,
        plan.projection.weeklyRateKg,
        profile.weight_kg,
      )
    : null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Energy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <Stat label="BMR" value={plan.bmr} unit="kcal" />
            <Stat label="TDEE" value={plan.tdee} unit="kcal" />
            <Stat label="Target" value={plan.calories.target} unit="kcal" accent />
          </div>
          {plan.calories.min !== plan.calories.max ? (
            <p className="text-xs text-muted-foreground">
              Stay between {plan.calories.min} and {plan.calories.max} kcal.
            </p>
          ) : null}
          {plan.calories.applied.length > 0 ? (
            <p className="text-xs text-primary">
              Adjusted for safety: {plan.calories.applied.join('; ')}.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Daily macros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-3 text-center">
            <Stat label="Protein" value={plan.macros.proteinG} unit="g" />
            <Stat label="Carbs" value={plan.macros.carbsG} unit="g" />
            <Stat label="Fat" value={plan.macros.fatG} unit="g" />
            <Stat label="Water" value={(plan.waterMl / 1000).toFixed(1)} unit="L" />
          </div>
        </CardContent>
      </Card>

      {plan.bodyFat ? (
        <Card>
          <CardHeader>
            <CardTitle>Body fat estimate</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="font-mono text-3xl">
              {plan.bodyFat.low}-{plan.bodyFat.high}%
            </p>
            <p className="text-xs text-muted-foreground">
              Tape-measure estimate, accurate to about 4 points either way. Track the trend, not
              the number.
            </p>
            {absEta ? (
              <p className="text-xs text-muted-foreground">
                Visible abs usually sit at {absTarget.low}-{absTarget.high}% for you. At this rate
                that is roughly {absEta.low}-{absEta.high} weeks — if the deficit holds.
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>90 days out</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {plan.projection.maintenance ? (
            <>
              <p className="font-mono text-3xl">{profile.weight_kg} kg</p>
              <p className="text-xs text-muted-foreground">
                Maintenance. Weight holds; the work shows up elsewhere.
              </p>
            </>
          ) : (
            <>
              <p className="font-mono text-3xl">
                {plan.projection.lowKg}-{plan.projection.highKg} kg
              </p>
              <p className="text-xs text-muted-foreground">
                From {profile.weight_kg} kg at about{' '}
                {Math.abs(plan.projection.weeklyRateKg).toFixed(2)} kg/week. Energy balance only —
                it assumes you hit the target most days.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <form action={finishOnboarding} className="flex items-center gap-3">
        {back ? (
          <Button asChild variant="ghost" size="icon" aria-label="Back">
            <Link href={back}>
              <ArrowLeft />
            </Link>
          </Button>
        ) : null}
        <Button type="submit" size="lg" className="flex-1">
          Start Day 1
        </Button>
      </form>
    </div>
  );
}

function Stat({
  label,
  value,
  unit,
  accent,
}: {
  label: string;
  value: number | string;
  unit: string;
  accent?: boolean;
}) {
  return (
    <div>
      <p className="label-xs">{label}</p>
      <p className={`font-mono text-xl ${accent ? 'text-primary' : ''}`}>{value}</p>
      <p className="text-[0.65rem] text-muted-foreground">{unit}</p>
    </div>
  );
}
