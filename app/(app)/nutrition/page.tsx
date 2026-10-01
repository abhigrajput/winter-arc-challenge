import type { Metadata } from 'next';
import { requireUser } from '@/lib/profile';
import { createClient } from '@/lib/supabase/server';
import { challengeDay, phaseForDay } from '@/lib/calc/day';
import { loadNutritionDay } from '@/lib/nutrition/day';
import { QUICK_WATER_ML, foodTips, quickFoods } from '@/lib/nutrition/helpers';
import { dietPlanSchema } from '@/lib/ai/schemas';
import { NutritionRings } from '@/components/nutrition/rings';
import { LogFood, type LoggedEntry, type PlanMeal } from '@/components/nutrition/log-food';

export const metadata: Metadata = { title: 'Nutrition' };
export const dynamic = 'force-dynamic';

export default async function NutritionPage() {
  const { profile } = await requireUser();
  if (!profile) return null;

  const day = await loadNutritionDay(profile);
  const week = phaseForDay(challengeDay(profile.challenge_start, profile.timezone ?? '')).week;

  // §8.5(a): meals from the active diet plan, if one has been generated.
  const supabase = await createClient();
  const { data: planRow } = await supabase
    .from('ai_plans')
    .select('content')
    .eq('user_id', profile.id)
    .eq('plan_type', 'diet')
    .eq('week', week)
    .eq('is_active', true)
    .maybeSingle();

  const planMeals: PlanMeal[] = (() => {
    const content = planRow?.content as { plan?: unknown } | null;
    if (!content?.plan) return [];
    const parsed = dietPlanSchema.safeParse(content.plan);
    if (!parsed.success) return [];
    return parsed.data.meals.map((meal) => ({
      name: meal.name,
      calories: meal.calories,
      proteinG: Math.round(meal.protein_g),
    }));
  })();

  const entries: LoggedEntry[] = day.entries.map((entry) => ({
    id: entry.id,
    description: entry.description,
    calories: entry.calories,
    proteinG: Math.round(Number(entry.protein_g ?? 0)),
    source: entry.source,
  }));

  const tips = foodTips(profile.goal);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="label-xs">{day.logDate}</p>
        <h1 className="text-2xl font-semibold tracking-tight">Nutrition</h1>
        <p className="text-sm text-muted-foreground">
          {day.totals.carbsG}g carbs · {day.totals.fatG}g fat logged
        </p>
      </header>

      <NutritionRings
        calories={day.rings.calories}
        protein={day.rings.protein}
        water={day.rings.water}
        overCalories={day.rings.calories.over && !day.inCalorieRange}
      />

      <LogFood
        entries={entries}
        foods={quickFoods(profile.diet_type, profile.budget)}
        planMeals={planMeals}
        waterSteps={QUICK_WATER_ML}
      />

      <section className="space-y-2">
        <h2 className="label-xs">Helpers</h2>
        <ul className="overflow-hidden rounded-lg border border-border">
          {tips.map((tip, index) => (
            <li
              key={tip.title}
              className={`bg-card p-4 ${index > 0 ? 'border-t border-border' : ''}`}
            >
              <p className="text-sm font-medium">{tip.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{tip.body}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
