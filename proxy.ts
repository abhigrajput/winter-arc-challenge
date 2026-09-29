import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

/** Next 16 renamed middleware to proxy. Runs on every matched request. */
export default async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons/|sw.js|.*\.(?:png|jpg|jpeg|svg|webp|ico|webmanifest)$).*)',
  ],
};
