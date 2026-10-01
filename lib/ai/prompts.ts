import type { ProfileRow } from '@/lib/supabase/types';
import type { PlanType } from '@/lib/ai/schemas';

/**
 * Prompts for the plan routes (§8.9). Profile and recent data go in as JSON so
 * the model has no reason to invent context.
 *
 * The rules here mirror lib/ai/guardrails.ts on purpose: the prompt asks for
 * compliant output, the guardrail refuses it when the model does not comply.
 * The prompt is the request; the guardrail is the enforcement.
 */

const SHARED_RULES = `
HARD RULES — a response breaking any of these is discarded:
- Never mention steroids, SARMs, prohormones, fat burners or any prescription-only medication.
- Never suggest dehydration cuts, sauna suits, extended or dry fasting, or any crash protocol.
- Never use shaming or "earn your food" framing. No guilt, no punishment, no moralising about food.
- Never promise bone or jaw structure change. Never endorse mewing or jaw exercise devices.
- Write plainly and briefly. No hype, no emoji, no motivational padding.
- Output ONLY a single JSON object. No prose before or after, no markdown fences.
`.trim();

const MINOR_RULES = `
THIS USER IS UNDER 18 — additional hard rules:
- Never mention supplements of any kind, including protein powder and creatine.
- Never prescribe one-rep-max or max-effort testing.
- Keep any calorie change within 250 kcal of maintenance.
`.trim();

export interface PromptContext {
  profile: ProfileRow;
  week: number;
  /** Maintenance calories, already guardrailed. */
  maintenanceCalories: number;
  /** Compact recent history: adherence, weight trend, recent sessions. */
  recent: Record<string, unknown>;
}

function profileJson(profile: ProfileRow, maintenanceCalories: number) {
  return {
    sex: profile.sex,
    age: profile.age,
    height_cm: profile.height_cm,
    weight_kg: profile.weight_kg,
    target_weight_kg: profile.target_weight_kg,
    goal: profile.goal,
    modules: profile.modules,
    training_mode: profile.training_mode,
    equipment: profile.equipment,
    max_dumbbell_kg: profile.max_dumbbell_kg,
    fitness_level: profile.fitness_level,
    days_per_week: profile.days_per_week,
    session_minutes: profile.session_minutes,
    diet_type: profile.diet_type,
    diet_notes: profile.diet_notes,
    budget: profile.budget,
    calorie_target: profile.calorie_target,
    protein_target_g: profile.protein_target_g,
    carbs_target_g: profile.carbs_target_g,
    fat_target_g: profile.fat_target_g,
    maintenance_calories: maintenanceCalories,
  };
}

const WORKOUT_SYSTEM = `
You are a strength coach writing one week of training for a 90-day programme.

${SHARED_RULES}

Programme rules:
- Only prescribe exercises the user can do with the equipment listed. No substitutions they cannot perform.
- Respect days_per_week and session_minutes. Do not exceed the time available.
- Weeks 1-4 build technique at moderate volume; week 4 is a deload. Weeks 5-8 raise volume; week 8 is a deload. Weeks 9-12 are the hardest. Week 13 is a test week.
- On a deload week, set "deload": true and cut volume roughly in half.
- Give a concrete progression rule, for example "add 2.5 kg when all sets hit the top of the range".

Respond with JSON of exactly this shape:
{"week":number,"split":string,"deload":boolean,"days":[{"name":string,"focus":string,"exercises":[{"name":string,"sets":number,"reps":string,"notes":string}]}],"progression":string,"notes":[string]}
`.trim();

const DIET_SYSTEM = `
You are a nutrition coach writing one week of eating for a 90-day programme.

${SHARED_RULES}

Diet rules:
- Hit the user's calorie and protein targets. Do not invent different targets.
- Respect diet_type strictly: "veg" means no meat, fish or eggs; "egg" allows eggs but no meat or fish.
- Respect allergies and dislikes in diet_notes without exception.
- Default to everyday Indian foods. If budget is "hostel", assume mess food plus cheap additions such as eggs, curd, peanuts, soya chunks and bananas.
- Calories and protein per meal must roughly sum to the daily targets.

Respond with JSON of exactly this shape:
{"week":number,"calorie_target":number,"protein_g":number,"carbs_g":number,"fat_g":number,"meals":[{"name":string,"items":[{"food":string,"quantity":string,"calories":number,"protein_g":number}],"calories":number,"protein_g":number}],"swaps":[{"instead_of":string,"use":string}],"notes":[string]}
`.trim();

const SKINCARE_SYSTEM = `
You are writing a simple over-the-counter skincare routine.

${SHARED_RULES}

Skincare rules:
- Only these actives are allowed: benzoyl peroxide, salicylic acid, niacinamide, adapalene, azelaic acid. Nothing else, and never anything prescription-only.
- Introduce at most ONE new active. The "actives" array must contain zero or one entry.
- Any new active needs a patch test and a two-week ramp, stated in its "introduction".
- AM must include a sunscreen step of SPF 30 or higher.
- If the history suggests cystic or nodular acne, scarring, or a sudden change, say plainly that they should see a dermatologist.

Respond with JSON of exactly this shape:
{"week":number,"am":[{"step":number,"product":string,"instructions":string}],"pm":[{"step":number,"product":string,"instructions":string}],"actives":[{"name":string,"frequency":string,"introduction":string}],"notes":[string]}
`.trim();

const SYSTEM_BY_TYPE: Record<PlanType, string> = {
  workout: WORKOUT_SYSTEM,
  diet: DIET_SYSTEM,
  skincare: SKINCARE_SYSTEM,
};

export function systemPrompt(type: PlanType, age: number | null): string {
  const base = SYSTEM_BY_TYPE[type];
  return age !== null && age < 18 ? `${base}\n\n${MINOR_RULES}` : base;
}

export function userPrompt({
  profile,
  week,
  maintenanceCalories,
  recent,
}: PromptContext): string {
  return [
    `Write the ${'plan'} for week ${week} of 13.`,
    '',
    'PROFILE:',
    JSON.stringify(profileJson(profile, maintenanceCalories), null, 2),
    '',
    'RECENT DATA:',
    JSON.stringify(recent, null, 2),
    '',
    'Return only the JSON object.',
  ].join('\n');
}

/** Appended on a retry so the second attempt knows what was wrong. */
export function retryPrompt(violations: string[]): string {
  return [
    'Your previous response was rejected for these reasons:',
    ...violations.map((v) => `- ${v}`),
    '',
    'Produce a corrected JSON object that fixes every point. Return only the JSON.',
  ].join('\n');
}

/**
 * §8.5(c): free-text meal to macros. Deliberately narrow — it estimates what
 * was eaten and nothing else, so it cannot wander into advice.
 */
export const MEAL_ESTIMATE_SYSTEM = `
You estimate the calories and macros of a meal someone describes in plain language.

Rules:
- Assume everyday Indian home cooking unless the description says otherwise.
- Where a quantity is missing, assume one normal serving and say so in "note".
- Be realistic, not flattering. Household measures like "1 katori" or "2 roti" are normal input.
- Set "low_confidence" to true when the description is too vague to estimate within about 20%.
- Estimate only. Never give advice, never comment on the food choice, never mention weight.
- Output ONLY a single JSON object. No prose, no markdown fences.

Respond with JSON of exactly this shape:
{"items":[{"food":string,"quantity":string,"calories":number,"protein_g":number,"carbs_g":number,"fat_g":number}],"total":{"calories":number,"protein_g":number,"carbs_g":number,"fat_g":number},"low_confidence":boolean,"note":string}
`.trim();

export function mealEstimatePrompt(description: string, dietType: string | null): string {
  return [
    dietType ? `The user's diet is "${dietType}".` : '',
    'Estimate this meal:',
    description,
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * §8.9 weekly check-in. The model reads a week of real data and returns a
 * verdict, three changes and a calorie adjustment. The adjustment is advisory:
 * lib/calc/adjust.ts bounds it before anything is written.
 */
export const CHECKIN_SYSTEM = `
You are reviewing one week of a 90-day programme and deciding what changes next week.

${SHARED_RULES}

Review rules:
- Judge the week on the data given, not on vibes. Say plainly if it went badly.
- Give at most THREE changes. Fewer is better. Each must be concrete and doable next week.
- "calorie_adjustment" is a signed number of kcal per day. Use 0 when the rate looks right.
  Suggest more food when weight is dropping too fast, less when it has stalled for two weeks.
  Never suggest more than 150 either way.
- If the user reports pain or injury, your first change must be to remove whatever aggravates it,
  and you must tell them to see a healthcare professional.
- Swaps are exercise substitutions only, and only for equipment the user has.
- No praise padding and no scolding. Short, flat, useful.

Respond with JSON of exactly this shape:
{"verdict":string,"changes":[string],"calorie_adjustment":number,"swaps":[{"from":string,"to":string,"why":string}],"notes":[string]}
`.trim();

export function checkinPrompt(week: number, snapshot: Record<string, unknown>): string {
  return [
    `Review week ${week} of 13.`,
    '',
    'DATA:',
    JSON.stringify(snapshot, null, 2),
    '',
    'Return only the JSON object.',
  ].join('\n');
}
