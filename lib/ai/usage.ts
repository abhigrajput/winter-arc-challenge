import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { PlanType } from '@/lib/ai/schemas';

/**
 * Server-side rate limiting via the ai_usage table (§8.9).
 *
 * Limits are per route, counted over a rolling window. The check runs before
 * the model call and the row is written after a successful one, so a provider
 * outage does not burn the user's quota.
 */

export interface RateLimit {
  /** Value stored in ai_usage.route. */
  route: string;
  max: number;
  windowHours: number;
  label: string;
}

/** §8.9: 3 plans per type per week, 1 check-in per week, 30 meal estimates per day. */
export function planLimit(type: PlanType): RateLimit {
  return {
    route: `ai/plan:${type}`,
    max: 3,
    windowHours: 24 * 7,
    label: `3 ${type} plans per week`,
  };
}

export const CHECKIN_LIMIT: RateLimit = {
  route: 'ai/checkin',
  max: 1,
  windowHours: 24 * 7,
  label: '1 check-in per week',
};

export const MEAL_ESTIMATE_LIMIT: RateLimit = {
  route: 'ai/meal-estimate',
  max: 30,
  windowHours: 24,
  label: '30 meal estimates per day',
};

export interface RateLimitState {
  allowed: boolean;
  used: number;
  remaining: number;
  limit: RateLimit;
}

export async function checkRateLimit(userId: string, limit: RateLimit): Promise<RateLimitState> {
  const supabase = await createClient();
  const since = new Date(Date.now() - limit.windowHours * 3600_000).toISOString();

  const { count } = await supabase
    .from('ai_usage')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('route', limit.route)
    .gte('created_at', since);

  const used = count ?? 0;

  return {
    allowed: used < limit.max,
    used,
    remaining: Math.max(0, limit.max - used),
    limit,
  };
}

/** Records one successful call. Failures are not charged against the quota. */
export async function recordUsage(userId: string, limit: RateLimit): Promise<void> {
  const supabase = await createClient();
  await supabase.from('ai_usage').insert({ user_id: userId, route: limit.route });
}
