import 'server-only';
import { AI_TIME_BUDGET_MS, complete, AiRequestError } from '@/lib/ai/client';
import { retryPrompt, systemPrompt, userPrompt, type PromptContext } from '@/lib/ai/prompts';
import { checkPlan, type GuardrailContext } from '@/lib/ai/guardrails';
import { parseAndValidate, planSchemas, type PlanContent, type PlanType } from '@/lib/ai/schemas';

/**
 * §4: strip fences → JSON.parse → zod validate → guardrail check → save.
 * Retry once on any failure, then give up with a 502.
 */

export interface GenerationSuccess {
  ok: true;
  plan: PlanContent;
  attempts: number;
}

export interface GenerationFailure {
  ok: false;
  /** Why it was rejected, for the log and the fallback notice. */
  reasons: string[];
  attempts: number;
  status: number;
  /** provider: the model could not be reached; rejected: its answer failed checks. */
  kind: 'provider' | 'rejected';
}

export type GenerationResult = GenerationSuccess | GenerationFailure;

const MAX_ATTEMPTS = 2;

export async function generatePlan(
  type: PlanType,
  promptContext: PromptContext,
  guardrailContext: GuardrailContext,
): Promise<GenerationResult> {
  const system = systemPrompt(type, promptContext.profile.age);
  const base = userPrompt(promptContext);
  const schema = planSchemas[type];

  let reasons: string[] = [];
  // Both attempts share one budget so a slow retry cannot outlive the function.
  const deadline = Date.now() + AI_TIME_BUDGET_MS;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const user = attempt === 1 ? base : `${base}\n\n${retryPrompt(reasons)}`;

    let raw: string;
    try {
      raw = await complete({
        system,
        user,
        tier: 'pro',
        timeoutMs: deadline - Date.now(),
        label: `plan:${type}#${attempt}`,
      });
    } catch (error) {
      // A transport or credential failure will not fix itself on a retry.
      if (error instanceof AiRequestError) {
        return {
          ok: false,
          reasons: [error.message],
          attempts: attempt,
          status: error.status,
          kind: 'provider',
        };
      }
      throw error;
    }

    const parsed = parseAndValidate(schema, raw);
    if (!parsed.ok) {
      reasons = parsed.reasons;
      continue;
    }

    const guard = checkPlan(type, parsed.plan, guardrailContext);
    if (!guard.ok) {
      reasons = guard.violations;
      continue;
    }

    return { ok: true, plan: parsed.plan, attempts: attempt };
  }

  return { ok: false, reasons, attempts: MAX_ATTEMPTS, status: 502, kind: 'rejected' };
}
