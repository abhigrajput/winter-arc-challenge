import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { passwordResetEnabled } from '@/lib/auth/recovery';
import { RequestResetForm } from '../reset/reset-forms';

export const metadata: Metadata = {
  title: 'Forgot password',
  description: 'Get a link to reset your Winter Arc password.',
};

export const dynamic = 'force-dynamic';

/** Step 1 of forgot password. 404 while FORGOT_PASSWORD_ENABLED is off. */
export default function ForgotPasswordPage() {
  if (!passwordResetEnabled()) notFound();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-6 py-12">
      <div className="space-y-2">
        <Link href="/" className="label-xs hover:text-foreground">
          Winter Arc
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">Forgot password.</h1>
        <p className="text-sm text-muted-foreground">Enter your email. We send a one-time link to set a new one.</p>
      </div>
      <RequestResetForm />
      <Link href="/login" className="text-center text-sm text-muted-foreground hover:text-foreground">
        Back to sign in
      </Link>
    </main>
  );
}
