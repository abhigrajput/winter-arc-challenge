import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6">
      <div className="space-y-2">
        <p className="label-xs">404</p>
        <h1 className="text-2xl font-semibold tracking-tight">Nothing here.</h1>
        <p className="text-sm text-muted-foreground">That page does not exist.</p>
      </div>
      <Link href="/today" className={buttonVariants({ size: 'lg' })}>
        Back to today
      </Link>
    </main>
  );
}
