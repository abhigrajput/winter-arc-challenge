'use client';

import { useState, useTransition } from 'react';
import { Check, Droplets, Loader2, Minus, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { QuickFood } from '@/lib/nutrition/helpers';
import type { MealEstimate } from '@/lib/ai/schemas';
import { addFoodEntry, deleteFoodEntry, logPlanMeal, logWater } from '@/app/(app)/nutrition/actions';

export interface LoggedEntry {
  id: string;
  description: string;
  calories: number;
  proteinG: number;
  source: string | null;
}

export interface PlanMeal {
  name: string;
  calories: number;
  proteinG: number;
}

export function LogFood({
  entries,
  foods,
  planMeals,
  waterSteps,
}: {
  entries: LoggedEntry[];
  foods: QuickFood[];
  planMeals: PlanMeal[];
  waterSteps: readonly number[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const run = (fn: () => Promise<{ error?: string }>) =>
    startTransition(async () => {
      const result = await fn();
      setError(result.error ?? null);
    });

  return (
    <div className="space-y-6">
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <section className="space-y-2">
        <h2 className="label-xs flex items-center gap-1.5">
          <Droplets className="size-3.5" aria-hidden />
          Water
        </h2>
        <div className="flex gap-2">
          {waterSteps.map((ml) => (
            <button
              key={ml}
              type="button"
              onClick={() => run(() => logWater({ deltaMl: ml }))}
              className="flex-1 rounded-md border border-input py-2.5 font-mono text-xs transition-colors hover:bg-accent"
            >
              +{ml}
            </button>
          ))}
          <button
            type="button"
            onClick={() => run(() => logWater({ deltaMl: -250 })) }
            aria-label="Remove 250 ml"
            className="rounded-md border border-input px-3 transition-colors hover:bg-accent"
          >
            <Minus className="size-3.5" />
          </button>
        </div>
      </section>

      {planMeals.length > 0 ? (
        <section className="space-y-2">
          <h2 className="label-xs">From your diet plan</h2>
          <ul className="overflow-hidden rounded-lg border border-border">
            {planMeals.map((meal, index) => (
              <li
                key={`${meal.name}-${index}`}
                className={cn('flex items-center gap-3 bg-card p-3 px-4', index > 0 && 'border-t border-border')}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{meal.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {meal.calories} kcal · {meal.proteinG}g P
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => run(() => logPlanMeal(meal))}
                  aria-label={`Log ${meal.name}`}
                  className="shrink-0 rounded-md border border-input p-2 transition-colors hover:bg-accent"
                >
                  <Check className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <QuickAdd foods={foods} run={run} />
      <AiEstimate run={run} onError={setError} />

      <section className="space-y-2">
        <h2 className="label-xs">Logged today</h2>
        {entries.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
            Nothing logged yet.
          </p>
        ) : (
          <ul className="overflow-hidden rounded-lg border border-border">
            {entries.map((entry, index) => (
              <li
                key={entry.id}
                className={cn('flex items-center gap-3 bg-card p-3 px-4', index > 0 && 'border-t border-border')}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{entry.description}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {entry.calories} kcal · {entry.proteinG}g P
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => run(() => deleteFoodEntry({ entryId: entry.id }))}
                  aria-label={`Remove ${entry.description}`}
                  className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function QuickAdd({
  foods,
  run,
}: {
  foods: QuickFood[];
  run: (fn: () => Promise<{ error?: string }>) => void;
}) {
  const [custom, setCustom] = useState(false);
  const [description, setDescription] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');

  function submitCustom() {
    const kcal = Number(calories);
    if (!description.trim() || !Number.isFinite(kcal) || kcal < 0) return;

    run(() =>
      addFoodEntry({
        description: description.trim(),
        meal: null,
        calories: Math.round(kcal),
        proteinG: protein === '' ? 0 : Number(protein),
        carbsG: 0,
        fatG: 0,
        source: 'manual',
      }),
    );

    setDescription('');
    setCalories('');
    setProtein('');
    setCustom(false);
  }

  return (
    <section className="space-y-2">
      <h2 className="label-xs">Quick add</h2>

      <div className="flex flex-wrap gap-2">
        {foods.map((food) => (
          <button
            key={food.slug}
            type="button"
            onClick={() =>
              run(() =>
                addFoodEntry({
                  description: `${food.label} (${food.serving})`,
                  meal: null,
                  calories: food.calories,
                  proteinG: food.proteinG,
                  carbsG: food.carbsG,
                  fatG: food.fatG,
                  source: 'manual',
                }),
              )
            }
            className="rounded-md border border-input px-3 py-2 text-xs transition-colors hover:bg-accent"
          >
            {food.label}
            <span className="ml-1.5 font-mono text-[0.65rem] text-muted-foreground">
              {food.calories}
            </span>
          </button>
        ))}
      </div>

      {custom ? (
        <div className="space-y-3 rounded-lg border border-border bg-card p-4">
          <div className="space-y-2">
            <Label htmlFor="food-desc">What</Label>
            <Input
              id="food-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Rajma chawal"
              maxLength={200}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="food-kcal">Calories</Label>
              <Input
                id="food-kcal"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
                inputMode="numeric"
                placeholder="450"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="food-protein">Protein (g)</Label>
              <Input
                id="food-protein"
                value={protein}
                onChange={(e) => setProtein(e.target.value)}
                inputMode="decimal"
                placeholder="20"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={submitCustom} className="flex-1">
              Add
            </Button>
            <Button variant="ghost" onClick={() => setCustom(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" className="w-full" onClick={() => setCustom(true)}>
          <Plus />
          Something else
        </Button>
      )}
    </section>
  );
}

function AiEstimate({
  run,
  onError,
}: {
  run: (fn: () => Promise<{ error?: string }>) => void;
  onError: (message: string | null) => void;
}) {
  const [text, setText] = useState('');
  const [estimate, setEstimate] = useState<MealEstimate | null>(null);
  const [pending, startTransition] = useTransition();

  function estimateMeal() {
    onError(null);
    setEstimate(null);

    startTransition(async () => {
      const response = await fetch('/api/ai/meal-estimate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ description: text }),
      });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        onError(body?.error ?? 'Could not estimate that.');
        return;
      }
      setEstimate(body.estimate);
    });
  }

  function confirm() {
    if (!estimate) return;
    run(() =>
      addFoodEntry({
        description: text.trim().slice(0, 200),
        meal: null,
        calories: estimate.total.calories,
        proteinG: estimate.total.protein_g,
        carbsG: estimate.total.carbs_g,
        fatG: estimate.total.fat_g,
        source: 'ai_estimate',
      }),
    );
    setText('');
    setEstimate(null);
  }

  return (
    <section className="space-y-2">
      <h2 className="label-xs">Describe a meal</h2>

      <div className="flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="2 roti, dal, paneer 100g"
          maxLength={300}
          aria-label="Meal description"
        />
        <Button
          variant="outline"
          onClick={estimateMeal}
          disabled={pending || text.trim().length < 2}
          aria-label="Estimate macros"
        >
          {pending ? <Loader2 className="animate-spin" /> : <Sparkles />}
        </Button>
      </div>

      {estimate ? (
        <div className="space-y-3 rounded-lg border border-border bg-card p-4">
          <ul className="space-y-1 text-xs">
            {estimate.items.map((item, index) => (
              <li key={`${item.food}-${index}`} className="flex justify-between gap-3">
                <span>
                  {item.food}
                  <span className="text-muted-foreground"> · {item.quantity}</span>
                </span>
                <span className="shrink-0 font-mono text-muted-foreground">
                  {item.calories} / {item.protein_g}g
                </span>
              </li>
            ))}
          </ul>

          <p className="font-mono text-sm">
            {estimate.total.calories} kcal · {estimate.total.protein_g}g protein
          </p>

          {estimate.low_confidence ? (
            <p className="text-xs text-muted-foreground">
              Rough estimate — the description was vague. Edit after adding if you know better.
            </p>
          ) : null}
          {estimate.note ? (
            <p className="text-xs text-muted-foreground">{estimate.note}</p>
          ) : null}

          <div className="flex gap-2">
            <Button onClick={confirm} className="flex-1">
              <Check />
              Add this
            </Button>
            <Button variant="ghost" onClick={() => setEstimate(null)} aria-label="Discard estimate">
              <X />
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
