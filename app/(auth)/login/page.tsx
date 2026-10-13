import type { Metadata } from 'next';
import Link from 'next/link';
import { safeNext } from '@/lib/safe-redirect';
import { SiteFooter } from '@/components/legal/site-footer';
import { LoginForm, type AuthTab } from './login-form';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in or create an account to start your 90 days.',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; tab?: string; deleted?: string }>;
}) {
  const { next, error, tab, deleted } = await searchParams;
  const initialTab: AuthTab = tab === 'signup' ? 'signup' : 'signin';

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-6 py-12">
      <div className="space-y-2">
        <Link href="/" className="label-xs hover:text-foreground">
          Winter Arc
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">Day 1 starts here.</h1>
        <p className="text-sm text-muted-foreground">90 days. No backfilling. No excuses.</p>
      </div>

      {deleted ? (
        <p role="status" className="rounded-md border border-border bg-card p-3 text-sm text-muted-foreground">
          Account deleted. Your data and photos are gone.
        </p>
      ) : null}

      <LoginForm next={safeNext(next)} initialTab={initialTab} initialError={error} />

      <SiteFooter />
    </main>
  );
}
