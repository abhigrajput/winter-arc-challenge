'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Field, OptionCard } from '@/components/onboarding/field';
import { StepForm } from '@/components/onboarding/step-form';
import { ACTIVITY_LEVELS } from '@/lib/calc/tdee';
import { EQUIPMENT_LABELS, EQUIPMENT_SLUGS } from '@/lib/onboarding/schema';
import type { ProfileRow } from '@/lib/supabase/types';
import {
  saveBaseline,
  saveBody,
  saveDiet,
  saveGoal,
  saveIdentity,
  saveModules,
  saveRoutine,
  saveSchedule,
  saveTraining,
} from '@/app/onboarding/actions';

interface StepProps {
  profile: ProfileRow;
  back: string | null;
}

// ---------------------------------------------------------------------------
// 1 — identity
// ---------------------------------------------------------------------------
/**
 * Controlled, because the server and the browser can enumerate different
 * timezone lists — an uncontrolled select loses its selection on hydration.
 */
function TimezoneSelect({ current, options }: { current: string; options: string[] }) {
  const [value, setValue] = useState(current);

  return (
    <select
      id="timezone"
      name="timezone"
      value={value}
      onChange={(event) => setValue(event.currentTarget.value)}
      className="flex h-11 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {options.includes(current) ? null : <option value={current}>{current}</option>}
      {options.map((tz) => (
        <option key={tz} value={tz}>
          {tz}
        </option>
      ))}
    </select>
  );
}

export function IdentityStep({ profile, back }: StepProps) {
  const timezones = supportedTimezones();
  // The signup trigger sets a provisional user_<uuid8>; make them pick a real one.
  const suggested = profile.username?.startsWith('user_') ? '' : (profile.username ?? '');

  return (
    <StepForm action={saveIdentity} back={back}>
      {({ fieldErrors }) => (
        <>
          <Field
            label="Username"
            htmlFor="username"
            error={fieldErrors.username}
            hint="Public. Shown on the leaderboard."
          >
            <Input
              id="username"
              name="username"
              defaultValue={suggested}
              placeholder="abhishek"
              autoComplete="username"
              required
            />
          </Field>

          <Field label="Display name" htmlFor="display_name" error={fieldErrors.display_name}>
            <Input
              id="display_name"
              name="display_name"
              defaultValue={profile.display_name ?? ''}
              placeholder="Abhishek"
              required
            />
          </Field>

          <Field label="Timezone" htmlFor="timezone" error={fieldErrors.timezone}>
            <TimezoneSelect current={profile.timezone ?? 'Asia/Kolkata'} options={timezones} />
          </Field>

          <Field
            label="Start date"
            htmlFor="challenge_start"
            error={fieldErrors.challenge_start}
            hint="Day 1 of 90. Logs only open for yesterday, today and tomorrow."
          >
            <Input
              id="challenge_start"
              name="challenge_start"
              type="date"
              defaultValue={profile.challenge_start ?? today()}
              required
            />
          </Field>
        </>
      )}
    </StepForm>
  );
}

// ---------------------------------------------------------------------------
// 2 — body
// ---------------------------------------------------------------------------
export function BodyStep({ profile, back }: StepProps) {
  return (
    <StepForm action={saveBody} back={back}>
      {({ fieldErrors }) => (
        <>
          <Field label="Sex" error={fieldErrors.sex} hint="Used by the metabolic formulas.">
            <div className="grid grid-cols-2 gap-3">
              <OptionCard
                name="sex"
                value="male"
                title="Male"
                defaultChecked={profile.sex === 'male'}
              />
              <OptionCard
                name="sex"
                value="female"
                title="Female"
                defaultChecked={profile.sex === 'female'}
              />
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Age" htmlFor="age" error={fieldErrors.age}>
              <Input
                id="age"
                name="age"
                type="number"
                inputMode="numeric"
                defaultValue={profile.age ?? ''}
                required
              />
            </Field>
            <Field label="Height (cm)" htmlFor="height_cm" error={fieldErrors.height_cm}>
              <Input
                id="height_cm"
                name="height_cm"
                type="number"
                step="0.1"
                inputMode="decimal"
                defaultValue={profile.height_cm ?? ''}
                required
              />
            </Field>
            <Field label="Weight (kg)" htmlFor="weight_kg" error={fieldErrors.weight_kg}>
              <Input
                id="weight_kg"
                name="weight_kg"
                type="number"
                step="0.1"
                inputMode="decimal"
                defaultValue={profile.weight_kg ?? ''}
                required
              />
            </Field>
            <Field
              label="Target (kg)"
              htmlFor="target_weight_kg"
              error={fieldErrors.target_weight_kg}
            >
              <Input
                id="target_weight_kg"
                name="target_weight_kg"
                type="number"
                step="0.1"
                inputMode="decimal"
                defaultValue={profile.target_weight_kg ?? ''}
                required
              />
            </Field>
          </div>

          <Field label="Activity level" error={fieldErrors.activity_level}>
            <div className="grid gap-3">
              {ACTIVITY_LEVELS.map((level) => (
                <OptionCard
                  key={level.slug}
                  name="activity_level"
                  value={String(level.value)}
                  title={level.label}
                  description={level.description}
                  defaultChecked={profile.activity_level === level.value}
                />
              ))}
            </div>
          </Field>
        </>
      )}
    </StepForm>
  );
}

// ---------------------------------------------------------------------------
// 3 — goal
// ---------------------------------------------------------------------------
const GOALS = [
  ['fat_loss', 'Fat loss', 'Lose fat, keep the muscle you have.'],
  ['six_pack', 'Six pack', 'Fat loss with the abs module switched on.'],
  ['lean_bulk', 'Lean bulk', 'Add size slowly, minimise fat gain.'],
  ['recomp', 'Recomp', 'Slight deficit. Build and lean out together.'],
  ['discipline', 'Discipline', 'Maintenance calories. Habits are the point.'],
  ['spiritual', 'Spiritual', 'Maintenance calories. Mind and practice first.'],
] as const;

export function GoalStep({ profile, back }: StepProps) {
  return (
    <StepForm action={saveGoal} back={back}>
      {({ fieldErrors }) => (
        <Field label="Primary goal" error={fieldErrors.goal}>
          <div className="grid gap-3">
            {GOALS.map(([value, title, description]) => (
              <OptionCard
                key={value}
                name="goal"
                value={value}
                title={title}
                description={description}
                defaultChecked={profile.goal === value}
              />
            ))}
          </div>
        </Field>
      )}
    </StepForm>
  );
}

// ---------------------------------------------------------------------------
// 4 — modules
// ---------------------------------------------------------------------------
const MODULES = [
  ['abs', 'Abs', 'Ab circuits and the Abs ETA card.'],
  ['face_skin', 'Skin', 'AM/PM routine, breakout log, correlations.'],
  ['jawline', 'Jawline', 'Neck work, posture drills, face photos.'],
  ['running', 'Running', 'Distance tracking as a daily task.'],
  ['content_creator', 'Content', 'Posts published and editing time.'],
] as const;

export function ModulesStep({ profile, back }: StepProps) {
  const selected = new Set(profile.modules ?? []);

  return (
    <StepForm action={saveModules} back={back}>
      {() => (
        <Field label="Add-ons" hint="Optional. Turn any of these on or off later.">
          <div className="grid gap-3">
            {MODULES.map(([value, title, description]) => (
              <OptionCard
                key={value}
                type="checkbox"
                name="modules"
                value={value}
                title={title}
                description={description}
                defaultChecked={selected.has(value)}
              />
            ))}
          </div>
        </Field>
      )}
    </StepForm>
  );
}

// ---------------------------------------------------------------------------
// 5 — training
// ---------------------------------------------------------------------------
export function TrainingStep({ profile, back }: StepProps) {
  const owned = new Set(profile.equipment ?? []);
  const [hasDumbbells, setHasDumbbells] = useState(owned.has('dumbbells'));

  return (
    <StepForm action={saveTraining} back={back}>
      {({ fieldErrors }) => (
        <>
          <Field label="Where you train" error={fieldErrors.training_mode}>
            <div className="grid gap-3">
              <OptionCard
                name="training_mode"
                value="gym"
                title="Gym"
                description="Full equipment."
                defaultChecked={profile.training_mode === 'gym'}
              />
              <OptionCard
                name="training_mode"
                value="home"
                title="Home"
                description="Bodyweight progressions and whatever you own."
                defaultChecked={profile.training_mode === 'home'}
              />
              <OptionCard
                name="training_mode"
                value="hybrid"
                title="Hybrid"
                description="Both, depending on the day."
                defaultChecked={profile.training_mode === 'hybrid'}
              />
            </div>
          </Field>

          <Field label="Equipment" hint="What you can actually reach today.">
            <div className="grid grid-cols-2 gap-3">
              {EQUIPMENT_SLUGS.map((slug) => (
                <label
                  key={slug}
                  className="flex cursor-pointer items-center gap-3 rounded-md border border-border bg-card p-3 text-sm transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                >
                  <input
                    type="checkbox"
                    name="equipment"
                    value={slug}
                    defaultChecked={owned.has(slug)}
                    onChange={
                      slug === 'dumbbells'
                        ? (event) => setHasDumbbells(event.currentTarget.checked)
                        : undefined
                    }
                    className="size-4 accent-primary"
                  />
                  {EQUIPMENT_LABELS[slug]}
                </label>
              ))}
            </div>
          </Field>

          {hasDumbbells ? (
            <Field
              label="Heaviest dumbbell (kg)"
              htmlFor="max_dumbbell_kg"
              error={fieldErrors.max_dumbbell_kg}
            >
              <Input
                id="max_dumbbell_kg"
                name="max_dumbbell_kg"
                type="number"
                step="0.5"
                inputMode="decimal"
                defaultValue={profile.max_dumbbell_kg ?? ''}
              />
            </Field>
          ) : null}
        </>
      )}
    </StepForm>
  );
}

// ---------------------------------------------------------------------------
// 6 — schedule
// ---------------------------------------------------------------------------
export function ScheduleStep({ profile, back }: StepProps) {
  return (
    <StepForm action={saveSchedule} back={back}>
      {({ fieldErrors }) => (
        <>
          <Field label="Training experience" error={fieldErrors.fitness_level}>
            <div className="grid gap-3">
              <OptionCard
                name="fitness_level"
                value="beginner"
                title="Beginner"
                description="Under a year of consistent training."
                defaultChecked={profile.fitness_level === 'beginner'}
              />
              <OptionCard
                name="fitness_level"
                value="intermediate"
                title="Intermediate"
                description="One to three years. Form is solid."
                defaultChecked={profile.fitness_level === 'intermediate'}
              />
              <OptionCard
                name="fitness_level"
                value="advanced"
                title="Advanced"
                description="Three years plus. You know your numbers."
                defaultChecked={profile.fitness_level === 'advanced'}
              />
            </div>
          </Field>

          <Field label="Days per week" error={fieldErrors.days_per_week}>
            <div className="grid grid-cols-4 gap-2">
              {[3, 4, 5, 6].map((days) => (
                <OptionCard
                  key={days}
                  name="days_per_week"
                  value={String(days)}
                  title={String(days)}
                  defaultChecked={profile.days_per_week === days}
                />
              ))}
            </div>
          </Field>

          <Field label="Session length" error={fieldErrors.session_minutes}>
            <div className="grid grid-cols-4 gap-2">
              {[30, 45, 60, 90].map((minutes) => (
                <OptionCard
                  key={minutes}
                  name="session_minutes"
                  value={String(minutes)}
                  title={`${minutes}m`}
                  defaultChecked={profile.session_minutes === minutes}
                />
              ))}
            </div>
          </Field>
        </>
      )}
    </StepForm>
  );
}

// ---------------------------------------------------------------------------
// 7 — diet
// ---------------------------------------------------------------------------
export function DietStep({ profile, back }: StepProps) {
  return (
    <StepForm action={saveDiet} back={back}>
      {({ fieldErrors }) => (
        <>
          <Field label="Diet" error={fieldErrors.diet_type}>
            <div className="grid grid-cols-3 gap-3">
              <OptionCard
                name="diet_type"
                value="veg"
                title="Veg"
                defaultChecked={profile.diet_type === 'veg'}
              />
              <OptionCard
                name="diet_type"
                value="egg"
                title="Egg"
                defaultChecked={profile.diet_type === 'egg'}
              />
              <OptionCard
                name="diet_type"
                value="nonveg"
                title="Non-veg"
                defaultChecked={profile.diet_type === 'nonveg'}
              />
            </div>
          </Field>

          <Field label="Budget" error={fieldErrors.budget}>
            <div className="grid gap-3">
              <OptionCard
                name="budget"
                value="hostel"
                title="Hostel / mess"
                description="Mess thali plus cheap add-ons."
                defaultChecked={profile.budget === 'hostel'}
              />
              <OptionCard
                name="budget"
                value="normal"
                title="Normal"
                description="You choose and cook your own food."
                defaultChecked={profile.budget === 'normal'}
              />
            </div>
          </Field>

          <Field
            label="Allergies and dislikes"
            htmlFor="diet_notes"
            error={fieldErrors.diet_notes}
            hint="Optional. Anything the plan should avoid."
          >
            <textarea
              id="diet_notes"
              name="diet_notes"
              rows={3}
              defaultValue={profile.diet_notes ?? ''}
              placeholder="No mushrooms. Lactose intolerant."
              className="w-full rounded-md border border-input bg-card p-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </Field>
        </>
      )}
    </StepForm>
  );
}

// ---------------------------------------------------------------------------
// 8 — routine
// ---------------------------------------------------------------------------
export function RoutineStep({ profile, back }: StepProps) {
  return (
    <StepForm action={saveRoutine} back={back}>
      {({ fieldErrors }) => (
        <>
          <Field label="Wake time" htmlFor="wake_time" error={fieldErrors.wake_time}>
            <Input
              id="wake_time"
              name="wake_time"
              type="time"
              defaultValue={(profile.wake_time ?? '05:00').slice(0, 5)}
              required
            />
          </Field>

          <Field
            label="Sleep target (hours)"
            htmlFor="sleep_target_h"
            error={fieldErrors.sleep_target_h}
            hint="7-9 h is the range that actually supports training."
          >
            <Input
              id="sleep_target_h"
              name="sleep_target_h"
              type="number"
              step="0.5"
              inputMode="decimal"
              defaultValue={profile.sleep_target_h ?? 8}
              required
            />
          </Field>

          <p className="text-xs text-muted-foreground">
            Reminder notifications are set up later, once push is enabled.
          </p>
        </>
      )}
    </StepForm>
  );
}

// ---------------------------------------------------------------------------
// 9 — baseline
// ---------------------------------------------------------------------------
export function BaselineStep({
  profile,
  back,
  baseline,
}: StepProps & {
  baseline: { waist_cm: number | null; neck_cm: number | null; hip_cm: number | null } | null;
}) {
  const needsHip = profile.sex === 'female';

  return (
    <StepForm action={saveBaseline} back={back} submitLabel="See my plan">
      {({ fieldErrors }) => (
        <>
          <p className="text-sm text-muted-foreground">
            Measure relaxed, first thing, same spot every time. These feed the body fat estimate.
          </p>

          <Field
            label="Waist (cm)"
            htmlFor="waist_cm"
            error={fieldErrors.waist_cm}
            hint="At the navel, not pulled in."
          >
            <Input
              id="waist_cm"
              name="waist_cm"
              type="number"
              step="0.1"
              inputMode="decimal"
              defaultValue={baseline?.waist_cm ?? ''}
              required
            />
          </Field>

          <Field
            label="Neck (cm)"
            htmlFor="neck_cm"
            error={fieldErrors.neck_cm}
            hint="Just below the larynx."
          >
            <Input
              id="neck_cm"
              name="neck_cm"
              type="number"
              step="0.1"
              inputMode="decimal"
              defaultValue={baseline?.neck_cm ?? ''}
              required
            />
          </Field>

          {needsHip ? (
            <Field
              label="Hip (cm)"
              htmlFor="hip_cm"
              error={fieldErrors.hip_cm}
              hint="At the widest point."
            >
              <Input
                id="hip_cm"
                name="hip_cm"
                type="number"
                step="0.1"
                inputMode="decimal"
                defaultValue={baseline?.hip_cm ?? ''}
                required
              />
            </Field>
          ) : null}

          <p className="text-xs text-muted-foreground">
            Progress photos are added from the Body page once you start.
          </p>
        </>
      )}
    </StepForm>
  );
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function supportedTimezones(): string[] {
  const fallback = ['Asia/Kolkata', 'UTC'];
  try {
    const all = Intl.supportedValuesOf('timeZone');
    return all.length ? all : fallback;
  } catch {
    return fallback;
  }
}
