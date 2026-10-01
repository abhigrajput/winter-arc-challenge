import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { challengeDay, localDate, phaseForDay } from '@/lib/calc/day';
import { boundSuggestedAdjustment, reconcileAdjustment } from '@/lib/calc/adjust';
import { clampCalories } from '@/lib/calc/guardrails';
import { macroTargets } from '@/lib/calc/macros';
import { complete, AiNotConfiguredError, AiRequestError } from '@/lib/ai/provider';
import { CHECKIN_SYSTEM, checkinPrompt, retryPrompt } from '@/lib/ai/prompts';
import { checkinSchema, stripFences, type CheckinFeedback } from '@/lib/ai/schemas';
import { checkPlan } from '@/lib/ai/guardrails';
import { buildCheckinContext } from '@/lib/ai/checkin';
import { CHECKIN_LIMIT, checkRateLimit, recordUsage } from '@/lib/ai/usage';

/**
 * POST /api/ai/checkin — §8.9, once a week.
 *
 * The §6 calorie adjustment is computed deterministically before the model is
 * asked, and is what gets applied. The model's suggestion is bounded and only
 * used when it agrees in direction — it advises, it does not decide.
 */

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  energy: z.number().int().min(1).max(5).nullable().default(null),
  hunger: z.number().int().min(1).max(5).nullable().default(null),
  notes: z.string().trim().max(1000).default(''),
  painNotes: z.string().trim().max(500).default(''),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request.' },
      { status: 400 },
    );
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile?.onboarded) {
    return NextResponse.json({ error: 'Finish setup first.' }, { status: 409 });
  }

  const week = phaseForDay(
    challengeDay(profile.challenge_start, profile.timezone ?? ''),
  ).week;

  // The database also enforces one check-in per week, but answering cleanly
  // here beats surfacing a constraint violation.
  const { data: existing } = await supabase
    .from('checkins')
    .select('id')
    .eq('user_id', profile.id)
    .eq('week', week)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: `You have already checked in for week ${week}.` },
      { status: 409 },
    );
  }

  const rate = await checkRateLimit(user.id, CHECKIN_LIMIT);
  if (!rate.allowed) {
    return NextResponse.json({ error: `Limit reached: ${CHECKIN_LIMIT.label}.` }, { status: 429 });
  }

  const { snapshot, autoAdjust, maintenanceCalories } = await buildCheckinContext(profile, week, {
    energy: parsed.data.energy,
    hunger: parsed.data.hunger,
    notes: parsed.data.notes,
    painNotes: parsed.data.painNotes,
  });

  const injuryReported = parsed.data.painNotes.trim().length > 0;

  let feedback: CheckinFeedback | null = null;
  let source: 'ai' | 'rules' = 'rules';
  let rejections: string[] = [];

  try {
    const result = await generate(snapshot, week, {
      sex: profile.sex ?? 'male',
      age: profile.age ?? 25,
      maintenanceCalories,
      injuryReported,
    });

    if (result.ok) {
      feedback = result.feedback;
      source = 'ai';
    } else {
      rejections = result.reasons;
    }
  } catch (error) {
    if (error instanceof AiNotConfiguredError) {
      rejections = ['no AI provider configured'];
    } else if (error instanceof AiRequestError) {
      rejections = [error.message];
    } else {
      throw error;
    }
  }

  // §6 decides the number. The model may only narrow it, never exceed it.
  const modelSuggestion = feedback ? boundSuggestedAdjustment(feedback.calorie_adjustment) : 0;
  const appliedDelta = reconcileAdjustment(autoAdjust.deltaKcal, modelSuggestion);

  const clamped = clampCalories({
    calories: (profile.calorie_target ?? maintenanceCalories) + appliedDelta,
    maintenance: maintenanceCalories,
    sex: profile.sex ?? 'male',
    age: profile.age ?? 25,
    weightKg: profile.weight_kg ?? 70,
  });

  const finalDelta = clamped.calories - (profile.calorie_target ?? maintenanceCalories);

  if (!feedback) {
    feedback = fallbackFeedback(autoAdjust.reason, injuryReported, finalDelta);
  }

  if (finalDelta !== 0) {
    const macros = macroTargets({
      calories: clamped.calories,
      weightKg: profile.weight_kg ?? 70,
      goal: profile.goal ?? 'discipline',
    });

    await supabase
      .from('profiles')
      .update({
        calorie_target: clamped.calories,
        protein_target_g: macros.proteinG,
        carbs_target_g: macros.carbsG,
        fat_target_g: macros.fatG,
      })
      .eq('id', profile.id);
  }

  const { error: insertError } = await supabase.from('checkins').insert({
    user_id: profile.id,
    week,
    energy: parsed.data.energy,
    hunger: parsed.data.hunger,
    notes: parsed.data.notes || null,
    pain_notes: parsed.data.painNotes || null,
    input_snapshot: { ...snapshot, logged_on: localDate(profile.timezone ?? '') } as never,
    ai_feedback: { ...feedback, source, rejections } as never,
    calorie_adjustment: finalDelta,
  });

  if (insertError) {
    return NextResponse.json({ error: 'Could not save your check-in.' }, { status: 500 });
  }

  if (source === 'ai') await recordUsage(user.id, CHECKIN_LIMIT);

  return NextResponse.json({
    source,
    week,
    feedback,
    calorieAdjustment: finalDelta,
    newCalorieTarget: clamped.calories,
    autoAdjustReason: autoAdjust.reason,
    rejections,
  });
}

type GenerateResult =
  | { ok: true; feedback: CheckinFeedback }
  | { ok: false; reasons: string[] };

/** §4 pipeline, with one retry, reusing the shared guardrails. */
async function generate(
  snapshot: unknown,
  week: number,
  guardrailContext: {
    sex: 'male' | 'female';
    age: number;
    maintenanceCalories: number;
    injuryReported: boolean;
  },
): Promise<GenerateResult> {
  const base = checkinPrompt(week, snapshot as Record<string, unknown>);
  let reasons: string[] = [];

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const user = attempt === 1 ? base : `${base}\n\n${retryPrompt(reasons)}`;
    const raw = await complete({ system: CHECKIN_SYSTEM, user, maxTokens: 1500 });

    let json: unknown;
    try {
      json = JSON.parse(stripFences(raw));
    } catch {
      reasons = ['response was not valid JSON'];
      continue;
    }

    const result = checkinSchema.safeParse(json);
    if (!result.success) {
      reasons = result.error.issues.slice(0, 5).map((i) => `${i.path.join('.')}: ${i.message}`);
      continue;
    }

    // The check-in is reviewed as a workout plan: same banned substances, same
    // shame rules, same injury-referral requirement.
    const guard = checkPlan('workout', result.data as never, guardrailContext);
    if (!guard.ok) {
      reasons = guard.violations;
      continue;
    }

    return { ok: true, feedback: result.data };
  }

  return { ok: false, reasons };
}

/** Used when the model is unavailable or its answer was rejected. */
function fallbackFeedback(
  reason: string,
  injuryReported: boolean,
  delta: number,
): CheckinFeedback {
  const changes: string[] = [];

  if (injuryReported) {
    changes.push(
      'Drop whatever aggravates the pain this week, and see a healthcare professional about it.',
    );
  }
  changes.push(
    delta === 0
      ? 'Keep the current calorie target and hit it more consistently.'
      : `Move your calorie target by ${delta > 0 ? '+' : ''}${delta} kcal a day.`,
  );
  changes.push('Pick the one task you missed most last week and protect it.');

  return {
    verdict: reason,
    changes: changes.slice(0, 3),
    calorie_adjustment: delta,
    swaps: [],
    notes: ['Written from your numbers. The coach was unavailable this week.'],
  };
}
