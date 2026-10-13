import type { Metadata } from 'next';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { SiteFooter } from '@/components/legal/site-footer';

export const metadata: Metadata = { title: 'Not found', robots: { index: false } };

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6">
      <div className="space-y-2">
        <p className="label-xs">404 · Off the arc</p>
        <h1 className="text-2xl font-semibold tracking-tight">Nothing here.</h1>
        <p className="text-sm text-muted-foreground">That page does not exist, or it is not public.</p>
      </div>
      <div className="grid gap-3">
        <Link href="/today" className={buttonVariants({ size: 'lg' })}>
          Back to today
        </Link>
        <Link href="/leaderboard" className={buttonVariants({ size: 'lg', variant: 'outline' })}>
          Leaderboard
        </Link>
      </div>
      <SiteFooter className="pt-6" />
    </main>
  );
}
