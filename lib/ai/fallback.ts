import type { ProfileRow } from '@/lib/supabase/types';
import { splitForDays } from '@/lib/workout/splits';
import type { DietPlan, PlanContent, PlanType, SkincarePlan, WorkoutPlan } from '@/lib/ai/schemas';

/**
 * §10: when AI output fails the guardrails, a template plan is shown instead.
 * These are deliberately plain and derived entirely from the profile, so they
 * are always safe and always available — including when no model is configured
 * at all.
 */

export function fallbackPlan(type: PlanType, profile: ProfileRow, week: number): PlanContent {
  switch (type) {
    case 'workout':
      return fallbackWorkout(profile, week);
    case 'diet':
      return fallbackDiet(profile, week);
    case 'skincare':
      return fallbackSkincare(week);
  }
}

function fallbackWorkout(profile: ProfileRow, week: number): WorkoutPlan {
  const daysPerWeek = profile.days_per_week ?? 4;
  const rotation = splitForDays(daysPerWeek);
  const deload = week === 4 || week === 8;
  const home = profile.training_mode === 'home';

  const byFocus: Record<string, { name: string; sets: number; reps: string }[]> = {
    chest: home
      ? [{ name: 'Push-up', sets: 3, reps: '8-15' }]
      : [{ name: 'Bench press', sets: 3, reps: '6-10' }],
    back: home
      ? [{ name: 'Inverted row', sets: 3, reps: '8-15' }]
      : [{ name: 'Barbell row', sets: 3, reps: '6-10' }],
    shoulders: home
      ? [{ name: 'Pike push-up', sets: 3, reps: '8-12' }]
      : [{ name: 'Overhead press', sets: 3, reps: '6-10' }],
    arms: [{ name: 'Dumbbell curl', sets: 2, reps: '8-12' }],
    legs: home
      ? [{ name: 'Split squat', sets: 3, reps: '8-15' }]
      : [{ name: 'Back squat', sets: 3, reps: '6-10' }],
    core: [{ name: 'Plank', sets: 3, reps: '30-45s' }],
  };

  return {
    week,
    split: rotation.map((d) => d.name).join(' / '),
    deload,
    days: rotation.map((day, index) => ({
      name: `Day ${index + 1} — ${day.name}`,
      focus: day.focus.join(', '),
      exercises: day.focus
        .flatMap((group) => byFocus[group] ?? [])
        .map((exercise) => ({
          ...exercise,
          sets: deload ? Math.max(1, Math.floor(exercise.sets / 2)) : exercise.sets,
          notes: 'Leave one or two reps in reserve.',
        })),
    })),
    progression: 'Add 2.5 kg, or move to the next progression, once every set hits the top of the range.',
    notes: deload
      ? ['Deload week. Half the volume, same technique.']
      : ['Template plan. Generate a tailored one when the coach is available.'],
  };
}

function fallbackDiet(profile: ProfileRow, week: number): DietPlan {
  const calories = profile.calorie_target ?? 2200;
  const protein = profile.protein_target_g ?? 140;
  const carbs = profile.carbs_target_g ?? 220;
  const fat = profile.fat_target_g ?? 60;
  const veg = profile.diet_type === 'veg';

  const share = (fraction: number) => Math.round(calories * fraction);
  const proteinShare = (fraction: number) => Math.round(protein * fraction);

  return {
    week,
    calorie_target: calories,
    protein_g: protein,
    carbs_g: carbs,
    fat_g: fat,
    meals: [
      {
        name: 'Breakfast',
        items: [
          { food: veg ? 'Paneer bhurji' : 'Egg bhurji', quantity: '150 g', calories: share(0.14), protein_g: proteinShare(0.25) },
          { food: 'Roti', quantity: '2', calories: share(0.1), protein_g: proteinShare(0.05) },
        ],
        calories: share(0.24),
        protein_g: proteinShare(0.3),
      },
      {
        name: 'Lunch',
        items: [
          { food: 'Dal', quantity: '1 bowl', calories: share(0.12), protein_g: proteinShare(0.12) },
          { food: 'Rice', quantity: '1 cup', calories: share(0.14), protein_g: proteinShare(0.04) },
          { food: veg ? 'Soya chunks' : 'Chicken curry', quantity: '100 g', calories: share(0.12), protein_g: proteinShare(0.24) },
        ],
        calories: share(0.38),
        protein_g: proteinShare(0.4),
      },
      {
        name: 'Snack',
        items: [
          { food: 'Curd', quantity: '200 g', calories: share(0.08), protein_g: proteinShare(0.1) },
          { food: 'Peanuts', quantity: '30 g', calories: share(0.08), protein_g: proteinShare(0.05) },
        ],
        calories: share(0.16),
        protein_g: proteinShare(0.15),
      },
      {
        name: 'Dinner',
        items: [
          { food: veg ? 'Rajma' : 'Fish curry', quantity: '1 bowl', calories: share(0.12), protein_g: proteinShare(0.1) },
          { food: 'Roti', quantity: '2', calories: share(0.1), protein_g: proteinShare(0.05) },
        ],
        calories: share(0.22),
        protein_g: proteinShare(0.15),
      },
    ],
    swaps: [
      { instead_of: 'Fried snacks', use: 'Roasted chana or fruit' },
      { instead_of: 'Sugary drinks', use: 'Water or black coffee' },
    ],
    notes: ['Template plan. Hit the calorie and protein numbers; the exact foods are flexible.'],
  };
}

function fallbackSkincare(week: number): SkincarePlan {
  return {
    week,
    am: [
      { step: 1, product: 'Gentle cleanser', instructions: 'Lukewarm water, 30 seconds, pat dry.' },
      { step: 2, product: 'Light moisturiser', instructions: 'Apply while the skin is still slightly damp.' },
      { step: 3, product: 'Sunscreen SPF 30+', instructions: 'Two fingers worth. Reapply if you are outside for hours.' },
    ],
    pm: [
      { step: 1, product: 'Gentle cleanser', instructions: 'Remove sweat and sunscreen properly.' },
      { step: 2, product: 'Moisturiser', instructions: 'Same as the morning.' },
    ],
    actives: [],
    notes: [
      'Template routine. Keep it boring for two weeks before changing anything.',
      'Persistent, cystic or scarring acne needs a dermatologist, not a routine change.',
    ],
  };
}

/** Marker stored alongside a fallback so the UI can label it honestly. */
export const FALLBACK_SOURCE = 'template';
export const AI_SOURCE = 'ai';
