import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { publicEnv } from '@/lib/env';

/** Routes reachable without a session. */
// /api/cron authenticates itself with CRON_SECRET; it never has a user session.
const PUBLIC_PREFIXES = ['/login', '/auth', '/u/', '/leaderboard', '/manifest.webmanifest', '/robots.txt', '/api/cron/'];

function isPublic(pathname: string): boolean {
  if (pathname === '/') return true;
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));
}

/**
 * Refreshes the Supabase session cookie on every request and gates private routes.
 * The response returned here must be the one sent to the browser, otherwise the
 * refreshed cookies are lost.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser() revalidates the token with Supabase — do not swap for getSession().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;

  if (!user && !isPublic(pathname)) {
    // API callers get JSON, not a redirect to an HTML login page.
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
    }

    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    url.searchParams.set('next', `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  // Signed-in users skip the landing page and the login screen.
  if (user && (pathname === '/' || pathname === '/login')) {
    const url = request.nextUrl.clone();
    url.pathname = '/today';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}
