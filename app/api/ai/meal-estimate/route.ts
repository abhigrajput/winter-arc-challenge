import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { complete, AiNotConfiguredError, AiRequestError } from '@/lib/ai/client';
import { MEAL_ESTIMATE_SYSTEM, mealEstimatePrompt } from '@/lib/ai/prompts';
import { mealEstimateSchema, stripFences } from '@/lib/ai/schemas';
import { MEAL_ESTIMATE_LIMIT, checkRateLimit, recordUsage } from '@/lib/ai/usage';

/**
 * POST /api/ai/meal-estimate — §8.5(c), capped at 30 a day (§8.9).
 *
 * Returns an estimate for the user to confirm. Nothing is written to
 * food_entries here; the client confirms and calls addFoodEntry.
 */

export const dynamic = 'force-dynamic';
/** V4 Pro reasoning can run 20–60 s; the default function timeout is shorter. */
export const maxDuration = 60;

const bodySchema = z.object({
  description: z.string().trim().min(2, 'Describe the meal.').max(300),
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

  const rate = await checkRateLimit(user.id, MEAL_ESTIMATE_LIMIT);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: `Limit reached: ${MEAL_ESTIMATE_LIMIT.label}.` },
      { status: 429 },
    );
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('diet_type')
    .eq('id', user.id)
    .maybeSingle();

  let raw: string;
  try {
    raw = await complete({
      system: MEAL_ESTIMATE_SYSTEM,
      user: mealEstimatePrompt(parsed.data.description, profile?.diet_type ?? null),
      tier: 'fast',
      label: 'meal-estimate',
    });
  } catch (error) {
    if (error instanceof AiNotConfiguredError) {
      return NextResponse.json(
        { error: 'The estimator is not configured. Use quick add instead.' },
        { status: 503 },
      );
    }
    if (error instanceof AiRequestError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    throw error;
  }

  const result = mealEstimateSchema.safeParse(safeParseJson(stripFences(raw)));
  if (!result.success) {
    return NextResponse.json(
      { error: 'Could not read that estimate. Try rewording, or use quick add.' },
      { status: 502 },
    );
  }

  await recordUsage(user.id, MEAL_ESTIMATE_LIMIT);

  return NextResponse.json({ estimate: result.data, remaining: rate.remaining - 1 });
}

function safeParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
