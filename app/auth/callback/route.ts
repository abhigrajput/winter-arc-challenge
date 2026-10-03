import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { safeNext } from '@/lib/safe-redirect';

const OTP_TYPES: readonly EmailOtpType[] = [
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
];

function isOtpType(value: string | null): value is EmailOtpType {
  return value !== null && (OTP_TYPES as readonly string[]).includes(value);
}

/**
 * OAuth + email-confirmation landing point. Handles both flows:
 *  - ?code=        PKCE (OAuth, default email links) → exchangeCodeForSession
 *  - ?token_hash=  custom email templates           → verifyOtp
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  const next = safeNext(searchParams.get('next'));

  const errorDescription = searchParams.get('error_description');
  if (errorDescription) {
    console.error('[auth] callback error param', {
      error: searchParams.get('error'),
      code: searchParams.get('error_code'),
      description: errorDescription,
    });
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(errorDescription)}`,
    );
  }

  const supabase = await createClient();
  let error;

  if (code) {
    ({ error } = await supabase.auth.exchangeCodeForSession(code));
  } else if (tokenHash && isOtpType(type)) {
    ({ error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type }));
  } else {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('Missing auth code.')}`);
  }

  if (error) {
    console.error('[auth] callback exchange failed', {
      flow: code ? 'pkce' : 'token_hash',
      message: error.message,
      status: error.status,
      code: error.code,
    });
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
  }

  // Behind a proxy, origin is the internal host — prefer the forwarded one.
  const forwardedHost = request.headers.get('x-forwarded-host');
  const base = process.env.NODE_ENV === 'production' && forwardedHost
    ? `https://${forwardedHost}`
    : origin;

  return NextResponse.redirect(`${base}${next}`);
}
