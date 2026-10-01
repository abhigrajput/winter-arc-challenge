import type { Metadata } from 'next';
import { requireUser } from '@/lib/profile';
import { createClient } from '@/lib/supabase/server';
import { challengeDay, phaseForDay } from '@/lib/calc/day';
import { PLAN_DISCLAIMER } from '@/lib/ai/guardrails';
import { checkRateLimit, planLimit } from '@/lib/ai/usage';
import { PLAN_TYPES, type PlanType } from '@/lib/ai/schemas';
import { PlanBoard, type StoredPlan } from '@/components/plan/plan-board';

export const metadata: Metadata = { title: 'Plan' };
export const dynamic = 'force-dynamic';

export default async function PlanPage() {
  const { profile } = await requireUser();
  if (!profile) return null;

  const day = challengeDay(profile.challenge_start, profile.timezone ?? '');
  const phase = phaseForDay(day);
  const week = phase.week;

  const supabase = await createClient();

  const { data: rows } = await supabase
    .from('ai_plans')
    .select('plan_type, week, content, created_at')
    .eq('user_id', profile.id)
    .eq('week', week)
    .eq('is_active', true);

  const limits = await Promise.all(
    PLAN_TYPES.map(async (type) => {
      const state = await checkRateLimit(profile.id, planLimit(type));
      return [type, state.remaining] as const;
    }),
  );

  const stored: Partial<Record<PlanType, StoredPlan>> = {};
  for (const row of rows ?? []) {
    const type = row.plan_type as PlanType;
    const content = row.content as { plan?: unknown; source?: string } | null;
    if (!content?.plan) continue;
    stored[type] = {
      plan: content.plan,
      source: content.source === 'ai' ? 'ai' : 'template',
      createdAt: row.created_at,
    };
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="label-xs">
          Week {week} · {phase.name}
          {phase.deload ? ' · deload' : ''}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Plan</h1>
        <p className="text-sm text-muted-foreground">{phase.description}</p>
      </header>

      <PlanBoard
        week={week}
        plans={stored}
        remaining={Object.fromEntries(limits) as Record<PlanType, number>}
      />

      <p className="text-xs text-muted-foreground">{PLAN_DISCLAIMER}</p>
    </div>
  );
}
