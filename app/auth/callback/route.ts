import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { safeNext } from '@/lib/safe-redirect';

/** OAuth + email-confirmation landing point. Exchanges the code for a session. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const next = safeNext(searchParams.get('next'));

  const errorDescription = searchParams.get('error_description');
  if (errorDescription) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(errorDescription)}`,
    );
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('Missing auth code.')}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent('Sign-in link expired. Try again.')}`,
    );
  }

  // Behind a proxy, origin is the internal host — prefer the forwarded one.
  const forwardedHost = request.headers.get('x-forwarded-host');
  const base = process.env.NODE_ENV === 'production' && forwardedHost
    ? `https://${forwardedHost}`
    : origin;

  return NextResponse.redirect(`${base}${next}`);
}
