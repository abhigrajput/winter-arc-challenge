import 'server-only';

/**
 * Model provider.
 *
 * CLAUDE.md §1 specifies the Claude API. The deployed .env.local currently
 * carries DEEPSEEK_* instead, so this resolves whichever credentials are
 * actually present rather than hard-failing on one vendor: Anthropic wins if
 * both are configured. Everything above this file is provider-agnostic.
 */

export type ProviderName = 'anthropic' | 'deepseek';

export interface ResolvedProvider {
  name: ProviderName;
  model: string;
  apiKey: string;
}

export class AiNotConfiguredError extends Error {
  constructor() {
    super('No AI provider configured. Set ANTHROPIC_API_KEY or DEEPSEEK_API_KEY.');
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

export function resolveProvider(): ResolvedProvider {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    return {
      name: 'anthropic',
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5',
      apiKey: anthropicKey,
    };
  }

  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  if (deepseekKey) {
    return {
      name: 'deepseek',
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      apiKey: deepseekKey,
    };
  }

  throw new AiNotConfiguredError();
}

export interface CompletionRequest {
  system: string;
  user: string;
  maxTokens?: number;
}

/** Sends one completion and returns the raw text. No parsing happens here. */
export async function complete({
  system,
  user,
  maxTokens = 4000,
}: CompletionRequest): Promise<string> {
  const provider = resolveProvider();

  return provider.name === 'anthropic'
    ? callAnthropic(provider, system, user, maxTokens)
    : callDeepseek(provider, system, user, maxTokens);
}

async function callAnthropic(
  provider: ResolvedProvider,
  system: string,
  user: string,
  maxTokens: number,
): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': provider.apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: provider.model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });

  if (!response.ok) {
    throw new AiRequestError(await describeFailure(response), response.status);
  }

  const body: unknown = await response.json();
  const text = extractAnthropicText(body);
  if (!text) throw new AiRequestError('Empty response from the model.', 502);
  return text;
}

async function callDeepseek(
  provider: ResolvedProvider,
  system: string,
  user: string,
  maxTokens: number,
): Promise<string> {
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${provider.apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: provider.model,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      // Ask for JSON directly where the provider supports it.
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    throw new AiRequestError(await describeFailure(response), response.status);
  }

  const body: unknown = await response.json();
  const text = extractOpenAiText(body);
  if (!text) throw new AiRequestError('Empty response from the model.', 502);
  return text;
}

async function describeFailure(response: Response): Promise<string> {
  // Never surface the body verbatim: it can echo the request, including keys.
  const detail = response.status === 401 || response.status === 403 ? 'credentials rejected' : 'request failed';
  return `Model provider ${detail} (HTTP ${response.status}).`;
}

function extractAnthropicText(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const content = (body as { content?: unknown }).content;
  if (!Array.isArray(content)) return null;

  const parts = content
    .filter(
      (block): block is { type: string; text: string } =>
        typeof block === 'object' &&
        block !== null &&
        (block as { type?: unknown }).type === 'text' &&
        typeof (block as { text?: unknown }).text === 'string',
    )
    .map((block) => block.text);

  return parts.length > 0 ? parts.join('') : null;
}

function extractOpenAiText(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const choices = (body as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;

  const message = (choices[0] as { message?: unknown }).message;
  if (!message || typeof message !== 'object') return null;

  const content = (message as { content?: unknown }).content;
  return typeof content === 'string' && content.length > 0 ? content : null;
}
