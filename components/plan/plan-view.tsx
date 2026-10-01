'use client';

import {
  dietPlanSchema,
  skincarePlanSchema,
  workoutPlanSchema,
  type PlanType,
} from '@/lib/ai/schemas';

/**
 * Renders a stored plan. The content comes back from the database as JSON, so
 * it is re-validated here rather than trusted — a plan written by an older
 * version of the schema renders as a notice instead of crashing the page.
 */
export function PlanView({ type, plan }: { type: PlanType; plan: unknown }) {
  if (type === 'workout') {
    const parsed = workoutPlanSchema.safeParse(plan);
    return parsed.success ? <WorkoutView plan={parsed.data} /> : <Unreadable />;
  }
  if (type === 'diet') {
    const parsed = dietPlanSchema.safeParse(plan);
    return parsed.success ? <DietView plan={parsed.data} /> : <Unreadable />;
  }
  const parsed = skincarePlanSchema.safeParse(plan);
  return parsed.success ? <SkincareView plan={parsed.data} /> : <Unreadable />;
}

function Unreadable() {
  return (
    <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
      This plan was saved in an older format. Generate a new one.
    </p>
  );
}

function WorkoutView({ plan }: { plan: import('@/lib/ai/schemas').WorkoutPlan }) {
  return (
    <div className="space-y-4">
      <p className="font-mono text-xs text-muted-foreground">
        {plan.split}
        {plan.deload ? ' · deload week' : ''}
      </p>

      {plan.days.map((day) => (
        <section key={day.name} className="overflow-hidden rounded-lg border border-border">
          <header className="bg-card p-4">
            <h3 className="text-sm font-semibold">{day.name}</h3>
            <p className="text-xs text-muted-foreground">{day.focus}</p>
          </header>
          <ul>
            {day.exercises.map((exercise, index) => (
              <li
                key={`${day.name}-${exercise.name}-${index}`}
                className="border-t border-border bg-card p-4"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm">{exercise.name}</span>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {exercise.sets} x {exercise.reps}
                  </span>
                </div>
                {exercise.notes ? (
                  <p className="mt-1 text-xs text-muted-foreground">{exercise.notes}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ))}

      <Notes title="Progression" items={[plan.progression, ...plan.notes]} />
    </div>
  );
}

function DietView({ plan }: { plan: import('@/lib/ai/schemas').DietPlan }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3 rounded-lg border border-border bg-card p-4 text-center">
        <Macro label="Kcal" value={plan.calorie_target} />
        <Macro label="Protein" value={`${plan.protein_g}g`} />
        <Macro label="Carbs" value={`${plan.carbs_g}g`} />
        <Macro label="Fat" value={`${plan.fat_g}g`} />
      </div>

      {plan.meals.map((meal) => (
        <section key={meal.name} className="overflow-hidden rounded-lg border border-border">
          <header className="flex items-baseline justify-between bg-card p-4">
            <h3 className="text-sm font-semibold">{meal.name}</h3>
            <span className="font-mono text-xs text-muted-foreground">
              {meal.calories} kcal · {meal.protein_g}g P
            </span>
          </header>
          <ul>
            {meal.items.map((item, index) => (
              <li
                key={`${meal.name}-${item.food}-${index}`}
                className="flex items-baseline justify-between gap-3 border-t border-border bg-card p-3 px-4"
              >
                <span className="text-sm">
                  {item.food}
                  <span className="text-muted-foreground"> · {item.quantity}</span>
                </span>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  {item.calories} / {item.protein_g}g
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {plan.swaps.length > 0 ? (
        <section className="space-y-2">
          <h3 className="label-xs">Swaps</h3>
          <ul className="overflow-hidden rounded-lg border border-border">
            {plan.swaps.map((swap, index) => (
              <li
                key={`${swap.instead_of}-${index}`}
                className={`bg-card p-3 px-4 text-sm ${index > 0 ? 'border-t border-border' : ''}`}
              >
                <span className="text-muted-foreground line-through">{swap.instead_of}</span>
                <span className="mx-2 text-muted-foreground">→</span>
                {swap.use}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Notes title="Notes" items={plan.notes} />
    </div>
  );
}

function SkincareView({ plan }: { plan: import('@/lib/ai/schemas').SkincarePlan }) {
  return (
    <div className="space-y-4">
      <Routine title="Morning" steps={plan.am} />
      <Routine title="Evening" steps={plan.pm} />

      {plan.actives.length > 0 ? (
        <section className="space-y-2">
          <h3 className="label-xs">New active</h3>
          {plan.actives.map((active) => (
            <div key={active.name} className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm font-semibold">{active.name}</p>
              <p className="mt-0.5 font-mono text-xs text-muted-foreground">{active.frequency}</p>
              <p className="mt-2 text-xs text-muted-foreground">{active.introduction}</p>
            </div>
          ))}
        </section>
      ) : null}

      <Notes title="Notes" items={plan.notes} />
    </div>
  );
}

function Routine({
  title,
  steps,
}: {
  title: string;
  steps: { step: number; product: string; instructions: string }[];
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-border">
      <header className="bg-card p-4">
        <h3 className="text-sm font-semibold">{title}</h3>
      </header>
      <ol>
        {steps.map((step) => (
          <li key={`${title}-${step.step}`} className="flex gap-3 border-t border-border bg-card p-4">
            <span className="font-mono text-xs text-muted-foreground">{step.step}</span>
            <div className="min-w-0">
              <p className="text-sm">{step.product}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{step.instructions}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Notes({ title, items }: { title: string; items: string[] }) {
  const visible = items.filter(Boolean);
  if (visible.length === 0) return null;

  return (
    <section className="space-y-2">
      <h3 className="label-xs">{title}</h3>
      <ul className="space-y-1 text-xs text-muted-foreground">
        {visible.map((note, index) => (
          <li key={`${note}-${index}`}>· {note}</li>
        ))}
      </ul>
    </section>
  );
}

function Macro({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="label-xs">{label}</p>
      <p className="font-mono text-lg">{value}</p>
    </div>
  );
}
