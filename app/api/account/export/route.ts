import { NextResponse } from 'next/server';
import { buildExport } from '@/lib/account/server';
import { exportFilename } from '@/lib/account/tables';

/**
 * GET /api/account/export — "Export my data". Everything the signed-in user
 * owns, as one JSON download. Read through their own session (RLS).
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const data = await buildExport();
  if (!data) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${exportFilename()}"`,
      'Cache-Control': 'no-store',
    },
  });
}
