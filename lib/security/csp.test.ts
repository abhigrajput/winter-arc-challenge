import { describe, expect, it } from 'vitest';
import { CSP_REPORT_PATH, buildCsp } from './csp';

const url = 'https://abc123.supabase.co';

function directive(csp: string, name: string): string[] {
  const found = csp.split('; ').find((d) => d.startsWith(`${name} `));
  return found ? found.split(' ').slice(1) : [];
}

describe('buildCsp', () => {
  it('allows the Supabase origin for data, realtime and signed photo URLs', () => {
    const csp = buildCsp({ supabaseUrl: url });
    expect(directive(csp, 'connect-src')).toEqual(["'self'", url, 'wss://abc123.supabase.co']);
    expect(directive(csp, 'img-src')).toContain(url);
  });

  it('forbids framing, plugins and foreign base URIs', () => {
    const csp = buildCsp({ supabaseUrl: url });
    expect(directive(csp, 'frame-ancestors')).toEqual(["'none'"]);
    expect(directive(csp, 'object-src')).toEqual(["'none'"]);
    expect(directive(csp, 'base-uri')).toEqual(["'self'"]);
  });

  it('allows eval and the HMR socket only in dev', () => {
    expect(directive(buildCsp({ supabaseUrl: url }), 'script-src')).not.toContain("'unsafe-eval'");
    expect(directive(buildCsp({ supabaseUrl: url, dev: true }), 'script-src')).toContain("'unsafe-eval'");
    expect(directive(buildCsp({ supabaseUrl: url, dev: true }), 'connect-src')).toContain('ws:');
  });

  it('reports to the app endpoint', () => {
    expect(directive(buildCsp({ supabaseUrl: url }), 'report-uri')).toEqual([CSP_REPORT_PATH]);
  });
});
