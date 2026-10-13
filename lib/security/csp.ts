/**
 * Content-Security-Policy for every page. Shipped as Report-Only first:
 * violations are POSTed to /api/csp-report and logged, nothing is blocked.
 * Flip to enforcing once the logs stay quiet.
 *
 * 'unsafe-inline' on script-src is required while the app has no nonces:
 * Next inlines its bootstrap and RSC payload scripts.
 */
export const CSP_REPORT_PATH = '/api/csp-report';

export function buildCsp({ supabaseUrl, dev = false }: { supabaseUrl: string; dev?: boolean }): string {
  const supabase = new URL(supabaseUrl);
  const https = supabase.origin;
  const wss = `wss://${supabase.host}`;

  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-inline'", ...(dev ? ["'unsafe-eval'"] : [])],
    'style-src': ["'self'", "'unsafe-inline'"],
    // Progress photos are signed Storage URLs; blob: for local previews before upload.
    'img-src': ["'self'", 'data:', 'blob:', https],
    'font-src': ["'self'", 'data:'],
    'connect-src': ["'self'", https, wss, ...(dev ? ['ws:'] : [])],
    'worker-src': ["'self'", 'blob:'],
    'manifest-src': ["'self'"],
    'media-src': ["'self'"],
    'frame-src': ["'none'"],
    'frame-ancestors': ["'none'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    // Google sign-in is a server action that redirects through Supabase to Google.
    'form-action': ["'self'", https, 'https://accounts.google.com'],
    'report-uri': [CSP_REPORT_PATH],
    'report-to': ['csp'],
  };

  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(' ')}`)
    .join('; ');
}
