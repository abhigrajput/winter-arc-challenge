import type { Metadata } from 'next';
import Link from 'next/link';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-6 py-12">
      <div className="space-y-2">
        <Link href="/" className="label-xs hover:text-foreground">
          Winter Arc
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">Day 1 starts here.</h1>
        <p className="text-sm text-muted-foreground">90 days. No backfilling. No excuses.</p>
      </div>

      <LoginForm next={next ?? '/today'} initialError={error} />

      <p className="text-xs text-muted-foreground">General guidance, not medical advice.</p>
    </main>
  );
}
