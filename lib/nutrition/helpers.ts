import type { BudgetMode, DietType, PrimaryGoal } from '@/lib/supabase/types';

/**
 * §8.5 quick-add helpers: Indian defaults, hostel/mess mode, and the
 * goal-specific lists (calorie-dense add-ons for gaining, volume foods and
 * protein-first ideas for losing).
 *
 * Macros are per the stated serving and are deliberately conservative
 * round numbers — this is a quick-add list, not a food database.
 */

export interface QuickFood {
  slug: string;
  label: string;
  serving: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  /** Lowest diet type that can eat it. */
  diet: DietType;
}

/** Everyday staples, always offered. */
const STAPLES: QuickFood[] = [
  { slug: 'roti', label: 'Roti', serving: '1', calories: 120, proteinG: 3, carbsG: 22, fatG: 2, diet: 'veg' },
  { slug: 'rice', label: 'Rice', serving: '1 cup', calories: 200, proteinG: 4, carbsG: 45, fatG: 0.5, diet: 'veg' },
  { slug: 'dal', label: 'Dal', serving: '1 katori', calories: 150, proteinG: 9, carbsG: 20, fatG: 4, diet: 'veg' },
  { slug: 'curd', label: 'Curd', serving: '200 g', calories: 120, proteinG: 7, carbsG: 9, fatG: 6, diet: 'veg' },
  { slug: 'paneer', label: 'Paneer', serving: '100 g', calories: 265, proteinG: 18, carbsG: 3, fatG: 21, diet: 'veg' },
  { slug: 'soya_chunks', label: 'Soya chunks', serving: '50 g dry', calories: 170, proteinG: 26, carbsG: 16, fatG: 0.5, diet: 'veg' },
  { slug: 'milk', label: 'Milk', serving: '250 ml', calories: 150, proteinG: 8, carbsG: 12, fatG: 8, diet: 'veg' },
  { slug: 'banana', label: 'Banana', serving: '1 medium', calories: 105, proteinG: 1, carbsG: 27, fatG: 0.3, diet: 'veg' },
  { slug: 'peanuts', label: 'Peanuts', serving: '30 g', calories: 170, proteinG: 7, carbsG: 5, fatG: 14, diet: 'veg' },
  { slug: 'egg', label: 'Egg', serving: '1 whole', calories: 78, proteinG: 6, carbsG: 0.6, fatG: 5, diet: 'egg' },
  { slug: 'egg_whites', label: 'Egg whites', serving: '3', calories: 51, proteinG: 11, carbsG: 0.7, fatG: 0.2, diet: 'egg' },
  { slug: 'chicken', label: 'Chicken breast', serving: '100 g', calories: 165, proteinG: 31, carbsG: 0, fatG: 3.6, diet: 'nonveg' },
  { slug: 'fish', label: 'Fish', serving: '100 g', calories: 140, proteinG: 22, carbsG: 0, fatG: 5, diet: 'nonveg' },
];

/** §8.5 hostel/mess mode: the thali plus the add-ons that actually travel. */
const MESS_EXTRAS: QuickFood[] = [
  { slug: 'mess_thali', label: 'Mess thali', serving: '1 plate', calories: 600, proteinG: 18, carbsG: 95, fatG: 15, diet: 'veg' },
  { slug: 'mess_thali_nonveg', label: 'Mess thali (non-veg)', serving: '1 plate', calories: 700, proteinG: 32, carbsG: 90, fatG: 20, diet: 'nonveg' },
  { slug: 'whey', label: 'Whey scoop', serving: '1 scoop', calories: 120, proteinG: 24, carbsG: 3, fatG: 1.5, diet: 'veg' },
  { slug: 'chana', label: 'Roasted chana', serving: '50 g', calories: 180, proteinG: 10, carbsG: 30, fatG: 3, diet: 'veg' },
];

const DIET_RANK: Record<DietType, number> = { veg: 0, egg: 1, nonveg: 2 };

/** Foods the user will actually eat, in a sensible order. */
export function quickFoods(diet: DietType | null, budget: BudgetMode | null): QuickFood[] {
  const allowed = DIET_RANK[diet ?? 'nonveg'];
  const pool = budget === 'hostel' ? [...MESS_EXTRAS, ...STAPLES] : [...STAPLES, ...MESS_EXTRAS];
  return pool.filter((food) => DIET_RANK[food.diet] <= allowed);
}

export interface FoodTip {
  title: string;
  body: string;
}

/**
 * §8.5: different help depending on which way the user is going.
 * Phrased as options, never as instructions about willpower.
 */
export function foodTips(goal: PrimaryGoal | null): FoodTip[] {
  if (goal === 'lean_bulk') {
    return [
      {
        title: 'Calorie-dense add-ons',
        body: 'Peanut butter, whole milk, banana shakes, ghee on roti, dry fruit. Easier than eating more volume.',
      },
      {
        title: 'Liquid calories',
        body: 'A milk, banana, peanut butter and oats shake is roughly 500 kcal and goes down fast.',
      },
      {
        title: 'Eat on schedule',
        body: 'Appetite lags behind the target. Fixed meal times beat waiting to feel hungry.',
      },
    ];
  }

  if (goal === 'fat_loss' || goal === 'six_pack') {
    return [
      {
        title: 'Protein first',
        body: 'Put the protein on the plate before the carbs. It fills you up for the fewest calories.',
      },
      {
        title: 'Volume foods',
        body: 'Salad, cucumber, sprouts, soup, curd, roasted chana. High bulk, low calories.',
      },
      {
        title: 'Watch the liquids',
        body: 'Sugary drinks, chai with sugar and juice add up without filling you up.',
      },
    ];
  }

  return [
    {
      title: 'Protein first',
      body: 'Hit the protein target before worrying about anything else on the plate.',
    },
    {
      title: 'Keep it repeatable',
      body: 'A few meals you can cook without thinking beat a perfect plan you abandon.',
    },
  ];
}

export const QUICK_WATER_ML = [250, 500, 1000] as const;
