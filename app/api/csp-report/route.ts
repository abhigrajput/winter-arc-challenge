import { NextResponse } from 'next/server';

/**
 * POST /api/csp-report — receives Content-Security-Policy-Report-Only
 * violations (legacy report-uri and Reporting API bodies) and logs a compact
 * line per violation to the runtime logs. Public: browsers send no session.
 */
export const dynamic = 'force-dynamic';

const MAX_BODY = 16_000;

type Report = Record<string, unknown>;

function compact(report: Report) {
  const pick = (...keys: string[]) => keys.map((k) => report[k]).find((v) => typeof v === 'string') as string | undefined;
  return {
    directive: pick('effective-directive', 'effectiveDirective', 'violated-directive'),
    blocked: pick('blocked-uri', 'blockedURL')?.slice(0, 200),
    page: pick('document-uri', 'documentURL')?.slice(0, 200),
    source: pick('source-file', 'sourceFile')?.slice(0, 200),
  };
}

export async function POST(request: Request) {
  const text = (await request.text()).slice(0, MAX_BODY);
  try {
    const parsed: unknown = JSON.parse(text);
    const reports: Report[] = Array.isArray(parsed)
      ? parsed.map((r) => ((r as { body?: Report }).body ?? {}) as Report)
      : [((parsed as { 'csp-report'?: Report })['csp-report'] ?? {}) as Report];
    for (const report of reports.slice(0, 20)) console.warn('[csp]', JSON.stringify(compact(report)));
  } catch {
    // Malformed body: nothing to log.
  }
  return new NextResponse(null, { status: 204 });
}
