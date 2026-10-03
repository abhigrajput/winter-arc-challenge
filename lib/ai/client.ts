import 'server-only';

/**
 * DeepSeek V4 client (OpenAI-compatible chat completions).
 *
 *  - pro  → DEEPSEEK_MODEL       (deepseek-v4-pro):   /api/ai/plan, /api/ai/checkin
 *  - fast → DEEPSEEK_MODEL_FAST  (deepseek-v4-flash): /api/ai/meal-estimate
 *
 * V4 Pro is a reasoning model. Its chain of thought arrives in
 * message.reasoning_content and counts against max_tokens; only
 * message.content carries the JSON answer, so that is all we read.
 */

const BASE_URL = 'https://api.deepseek.com';

export type ModelTier = 'pro' | 'fast';

const DEFAULT_MODELS: Record<ModelTier, string> = {
  pro: 'deepseek-v4-pro',
  fast: 'deepseek-v4-flash',
};

/** Reasoning tokens share the max_tokens budget, so pro needs headroom. */
const DEFAULT_MAX_TOKENS: Record<ModelTier, number> = {
  pro: 16000,
  fast: 2000,
};

/** Routes set maxDuration = 60. Leave room for auth, DB reads and the save. */
export const AI_TIME_BUDGET_MS = 50_000;

export class AiNotConfiguredError extends Error {
  constructor() {
    super('No AI provider configured. Set DEEPSEEK_API_KEY.');
    this.name = 'AiNotConfiguredError';
  }
}

export class AiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'AiRequestError';
  }
}

export function modelFor(tier: ModelTier): string {
  const fromEnv = tier === 'pro' ? process.env.DEEPSEEK_MODEL : process.env.DEEPSEEK_MODEL_FAST;
  return fromEnv || DEFAULT_MODELS[tier];
}

function apiKey(): string {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new AiNotConfiguredError();
  return key;
}

export interface CompletionRequest {
  system: string;
  user: string;
  tier: ModelTier;
  maxTokens?: number;
  /** Hard stop for this call. Defaults to the whole route budget. */
  timeoutMs?: number;
  /** Short tag for the usage log line, e.g. "plan:workout". */
  label?: string;
}

/** Sends one completion and returns the raw answer text. No parsing happens here. */
export async function complete({
  system,
  user,
  tier,
  maxTokens = DEFAULT_MAX_TOKENS[tier],
  timeoutMs = AI_TIME_BUDGET_MS,
  label = tier,
}: CompletionRequest): Promise<string> {
  const key = apiKey();
  const model = modelFor(tier);

  if (timeoutMs < 1000) throw new AiRequestError('Out of time for another attempt.', 504);

  const started = Date.now();
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${key}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      console.error('[ai] timeout', { label, model, ms: Date.now() - started });
      throw new AiRequestError('The coach took too long to answer.', 504);
    }
    throw new AiRequestError('Could not reach the model provider.', 502);
  }

  if (!response.ok) {
    console.error('[ai] http error', { label, model, status: response.status });
    throw new AiRequestError(describeFailure(response.status), response.status);
  }

  const body: unknown = await response.json();
  const { content, finishReason, usage } = readCompletion(body);

  console.info('[ai] completion', {
    label,
    model,
    ms: Date.now() - started,
    finish: finishReason,
    prompt_tokens: usage?.prompt_tokens,
    completion_tokens: usage?.completion_tokens,
    reasoning_tokens: usage?.completion_tokens_details?.reasoning_tokens,
    cache_hit_tokens: usage?.prompt_cache_hit_tokens,
  });

  if (!content) {
    // Usually the reasoning ate the whole max_tokens budget.
    throw new AiRequestError(
      finishReason === 'length' ? 'The model ran out of tokens before answering.' : 'Empty response from the model.',
      502,
    );
  }
  return content;
}

function describeFailure(status: number): string {
  // Never surface the body verbatim: it can echo the request, including keys.
  const detail = status === 401 || status === 403 ? 'credentials rejected' : 'request failed';
  return `Model provider ${detail} (HTTP ${status}).`;
}

interface Usage {
  prompt_tokens?: number;
  completion_tokens?: number;
  prompt_cache_hit_tokens?: number;
  completion_tokens_details?: { reasoning_tokens?: number };
}

/** Reads choices[0].message.content only — reasoning_content is deliberately ignored. */
export function readCompletion(body: unknown): {
  content: string | null;
  finishReason: string | null;
  usage: Usage | null;
} {
  if (!body || typeof body !== 'object') return { content: null, finishReason: null, usage: null };

  const usageRaw = (body as { usage?: unknown }).usage;
  const usage = usageRaw && typeof usageRaw === 'object' ? (usageRaw as Usage) : null;

  const choices = (body as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    return { content: null, finishReason: null, usage };
  }

  const choice = choices[0] as { message?: unknown; finish_reason?: unknown };
  const finishReason = typeof choice.finish_reason === 'string' ? choice.finish_reason : null;
  const message = choice.message;
  if (!message || typeof message !== 'object') return { content: null, finishReason, usage };

  const content = (message as { content?: unknown }).content;
  return {
    content: typeof content === 'string' && content.trim().length > 0 ? content : null,
    finishReason,
    usage,
  };
}
