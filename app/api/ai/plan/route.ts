import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { tdee as computeTdee } from '@/lib/calc/tdee';
import { calorieTarget } from '@/lib/calc/macros';
import { generatePlan } from '@/lib/ai/pipeline';
import { AI_SOURCE, FALLBACK_SOURCE, fallbackPlan } from '@/lib/ai/fallback';
import { checkRateLimit, planLimit, recordUsage } from '@/lib/ai/usage';
import { isPlanType, type PlanType } from '@/lib/ai/schemas';
import { AiNotConfiguredError } from '@/lib/ai/client';
import { buildRecentContext } from '@/lib/ai/context';

/**
 * POST /api/ai/plan — §8.9.
 *
 * Auth required, rate limited server-side. A plan that fails validation or the
 * §10 guardrails is logged and replaced by a template rather than shown.
 */

export const dynamic = 'force-dynamic';
/** V4 Pro reasoning can run 20–60 s; the default function timeout is shorter. */
export const maxDuration = 60;

const bodySchema = z.object({
  type: z.string().refine(isPlanType, 'Unknown plan type.'),
  week: z.number().int().min(1).max(13),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

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

  const type = parsed.data.type as PlanType;
  const { week } = parsed.data;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile?.onboarded) {
    return NextResponse.json({ error: 'Finish setup first.' }, { status: 409 });
  }

  const limit = planLimit(type);
  const rate = await checkRateLimit(user.id, limit);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: `Limit reached: ${limit.label}.`, used: rate.used },
      { status: 429 },
    );
  }

  const maintenance =
    profile.sex && profile.age && profile.height_cm && profile.weight_kg && profile.activity_level
      ? computeTdee(
          {
            sex: profile.sex,
            age: profile.age,
            heightCm: profile.height_cm,
            weightKg: profile.weight_kg,
          },
          profile.activity_level,
        )
      : (profile.calorie_target ?? 2200);

  // Keep the guardrail's maintenance figure consistent with what onboarding used.
  const guardrailMaintenance =
    profile.sex && profile.age && profile.weight_kg && profile.goal
      ? calorieTarget({
          tdee: maintenance,
          goal: profile.goal,
          sex: profile.sex,
          age: profile.age,
          weightKg: profile.weight_kg,
        }).maintenance
      : maintenance;

  const recent = await buildRecentContext(user.id, profile);

  let result;
  try {
    result = await generatePlan(
      type,
      { profile, week, maintenanceCalories: maintenance, recent },
      {
        sex: profile.sex ?? 'male',
        age: profile.age ?? 25,
        maintenanceCalories: guardrailMaintenance,
        injuryReported: Boolean(recent.injury_note),
      },
    );
  } catch (error) {
    if (error instanceof AiNotConfiguredError) {
      const plan = fallbackPlan(type, profile, week);
      await savePlan(supabase, user.id, type, week, plan, FALLBACK_SOURCE, [
        'no AI provider configured',
      ]);
      return NextResponse.json(
        { source: FALLBACK_SOURCE, plan, reason: 'The coach is not configured yet.' },
        { status: 200 },
      );
    }
    throw error;
  }

  if (!result.ok) {
    // §10: rejected output is logged and a template is shown instead.
    const plan = fallbackPlan(type, profile, week);
    await savePlan(supabase, user.id, type, week, plan, FALLBACK_SOURCE, result.reasons);

    return NextResponse.json(
      {
        source: FALLBACK_SOURCE,
        plan,
        reason:
          result.kind === 'provider'
            ? 'The coach is unavailable right now, so here is the template.'
            : 'The generated plan did not pass the safety checks, so here is the template.',
        violations: result.reasons,
      },
      { status: 200 },
    );
  }

  await savePlan(supabase, user.id, type, week, result.plan, AI_SOURCE, []);
  await recordUsage(user.id, limit);

  return NextResponse.json({ source: AI_SOURCE, plan: result.plan }, { status: 200 });
}

type Supa = Awaited<ReturnType<typeof createClient>>;

/** Stores the plan and retires any earlier one for the same type and week. */
async function savePlan(
  supabase: Supa,
  userId: string,
  type: PlanType,
  week: number,
  plan: unknown,
  source: string,
  rejections: string[],
): Promise<void> {
  await supabase
    .from('ai_plans')
    .update({ is_active: false })
    .eq('user_id', userId)
    .eq('plan_type', type)
    .eq('week', week);

  await supabase.from('ai_plans').insert({
    user_id: userId,
    plan_type: type,
    week,
    content: { plan, source, rejections } as never,
    is_active: true,
  });
}
