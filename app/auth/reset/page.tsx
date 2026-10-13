import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { buttonVariants } from '@/components/ui/button';
import { isRecoverySessionNow, passwordResetEnabled } from '@/lib/auth/recovery';
import { NewPasswordForm } from './reset-forms';

export const metadata: Metadata = {
  title: 'New password',
  description: 'Set a new password for your Winter Arc account.',
  robots: { index: false },
};

export const dynamic = 'force-dynamic';

/** Step 2 of forgot password: reached from the email link via /auth/callback. */
export default async function ResetPasswordPage() {
  if (!passwordResetEnabled()) notFound();

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const valid = data ? isRecoverySessionNow(data.claims.amr) : false;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-6 py-12">
      <div className="space-y-2">
        <Link href="/" className="label-xs hover:text-foreground">
          Winter Arc
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">{valid ? 'New password.' : 'Link expired.'}</h1>
        <p className="text-sm text-muted-foreground">
          {valid
            ? 'Pick a new password. Every other device gets signed out.'
            : 'Reset links work once and only for a short time. Request a new one.'}
        </p>
      </div>
      {valid ? (
        <NewPasswordForm email={typeof data?.claims.email === 'string' ? data.claims.email : null} />
      ) : (
        <Link href="/auth/forgot" className={buttonVariants({ size: 'lg' })}>
          Request a new link
        </Link>
      )}
    </main>
  );
}
