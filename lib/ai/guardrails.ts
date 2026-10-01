import type { Sex } from '@/lib/supabase/types';
import { CALORIE_FLOOR, MINOR_MAX_CALORIE_DELTA, isMinor } from '@/lib/calc/guardrails';
import { ALLOWED_ACTIVES, type PlanContent, type PlanType } from '@/lib/ai/schemas';

/**
 * §10 guardrails applied to model output. Nothing reaches the database or the
 * screen without passing these.
 *
 * The numeric floors live in lib/calc/guardrails.ts and are shared with
 * onboarding, so a model cannot talk the app past a limit the UI enforces.
 */

/** Substances and practices the app never recommends, at any age. */
const BANNED_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /\b(steroid|anabolic|testosterone cycle|trt)\b/i, reason: 'anabolic steroids' },
  { pattern: /\bsarms?\b/i, reason: 'SARMs' },
  { pattern: /\b(clenbuterol|anavar|dianabol|winstrol|trenbolone|ostarine)\b/i, reason: 'performance drugs' },
  { pattern: /\bfat.?burner|thermogenic\b/i, reason: 'fat burners' },
  { pattern: /\b(isotretinoin|accutane|tretinoin|retin-a|spironolactone|hydroquinone)\b/i, reason: 'prescription-only medication' },
  { pattern: /\b(antibiotic|doxycycline|minocycline)\b/i, reason: 'prescription-only medication' },
  { pattern: /\b(water cut|dehydrat\w*|sauna suit|sweat suit)\b/i, reason: 'dehydration cutting' },
  { pattern: /\b(\d{2,}.?hour fast|extended fast|dry fast|starv\w+)\b/i, reason: 'extreme fasting' },
  { pattern: /\b(mewing|jaw exerciser|jawzrsize|bone smashing)\b/i, reason: 'unproven jawline claims' },
];

/** Shame and "earn it" framing is banned outright (§10). */
const SHAME_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /\bearn (your|the) (food|meal|calories|carbs)\b/i, reason: 'earn-your-food framing' },
  { pattern: /\b(burn off|work off) (that|the|your) \w+/i, reason: 'punishment framing' },
  { pattern: /\b(lazy|greedy|disgusting|pathetic|no excuses for being)\b/i, reason: 'shaming language' },
  { pattern: /\bcheat (day|meal) guilt\b/i, reason: 'guilt framing' },
  { pattern: /\byou (should be )?(ashamed|embarrassed)\b/i, reason: 'shaming language' },
];

/** Signs a user needs a professional, not a plan (§8.3). */
const DERM_REFERRAL = /dermatolog|see a doctor|medical advice|healthcare professional/i;

export interface GuardrailContext {
  sex: Sex;
  age: number;
  /** Guardrailed maintenance calories, for judging a diet plan. */
  maintenanceCalories: number;
  /** True when the user reported pain or injury. */
  injuryReported?: boolean;
}

export interface GuardrailResult {
  ok: boolean;
  /** Every rule that failed, for the rejection log. */
  violations: string[];
}

/** Walks every string in the plan so a banned term cannot hide in a nested field. */
function collectText(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) for (const item of value) collectText(item, out);
  else if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collectText(item, out);
  }
  return out;
}

export function checkPlan(
  type: PlanType,
  plan: PlanContent,
  context: GuardrailContext,
): GuardrailResult {
  const violations: string[] = [];
  const text = collectText(plan).join('\n');

  for (const { pattern, reason } of BANNED_PATTERNS) {
    if (pattern.test(text)) violations.push(`mentions ${reason}`);
  }
  for (const { pattern, reason } of SHAME_PATTERNS) {
    if (pattern.test(text)) violations.push(`uses ${reason}`);
  }

  // §10: no supplement talk at all for under-18s.
  if (isMinor(context.age) && /\b(supplement|creatine|whey|pre.?workout|protein powder)\b/i.test(text)) {
    violations.push('recommends supplements to a minor');
  }

  if (type === 'diet') violations.push(...checkDiet(plan as never, context));
  if (type === 'workout') violations.push(...checkWorkout(text, context));
  if (type === 'skincare') violations.push(...checkSkincare(plan as never, text));

  return { ok: violations.length === 0, violations: [...new Set(violations)] };
}

function checkDiet(
  plan: { calorie_target: number; protein_g: number },
  context: GuardrailContext,
): string[] {
  const violations: string[] = [];
  const floor = CALORIE_FLOOR[context.sex];

  if (plan.calorie_target < floor) {
    violations.push(`calorie target ${plan.calorie_target} is below the ${floor} kcal floor`);
  }

  if (isMinor(context.age)) {
    const delta = Math.abs(plan.calorie_target - context.maintenanceCalories);
    if (delta > MINOR_MAX_CALORIE_DELTA) {
      violations.push(`under-18 calorie swing of ${Math.round(delta)} exceeds 250 kcal`);
    }
  }

  if (plan.protein_g < 0) violations.push('negative protein target');

  return violations;
}

function checkWorkout(text: string, context: GuardrailContext): string[] {
  const violations: string[] = [];

  // §10: no max-effort testing for under-18s.
  if (isMinor(context.age) && /\b(1rm|one.rep max|max.effort|test your max)\b/i.test(text)) {
    violations.push('prescribes max-effort testing to a minor');
  }

  // §10: an injury must send the user to a professional, not just get worked around.
  if (context.injuryReported && !DERM_REFERRAL.test(text)) {
    violations.push('injury reported but the plan does not advise seeing a professional');
  }

  return violations;
}

function checkSkincare(plan: { actives: { name: string }[] }, text: string): string[] {
  const violations: string[] = [];

  for (const active of plan.actives) {
    const known = ALLOWED_ACTIVES.some((allowed) =>
      active.name.toLowerCase().includes(allowed.toLowerCase()),
    );
    if (!known) violations.push(`active "${active.name}" is not on the OTC list`);
  }

  // §8.3: one new active at a time.
  if (plan.actives.length > 1) {
    violations.push('introduces more than one new active at once');
  }

  // §8.3: severe presentations must be referred on.
  if (/\b(cystic|nodular|scarring|severe acne)\b/i.test(text) && !DERM_REFERRAL.test(text)) {
    violations.push('describes severe acne without advising a dermatologist');
  }

  return violations;
}

/** Fixed copy required on every plan page (§10). */
export const PLAN_DISCLAIMER = 'General guidance, not medical advice.';
