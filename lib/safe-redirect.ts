/**
 * Whitelists post-auth redirect targets. Only same-origin absolute paths pass;
 * anything else (absolute URLs, protocol-relative, backslash tricks) falls back.
 * Prevents an open redirect via ?next=.
 */
export function safeNext(next: string | null | undefined, fallback = '/today'): string {
  if (!next) return fallback;
  if (!next.startsWith('/')) return fallback;
  if (next.startsWith('//') || next.startsWith('/\\')) return fallback;
  if (/[\u0000-\u001f]/.test(next)) return fallback;
  return next;
}
