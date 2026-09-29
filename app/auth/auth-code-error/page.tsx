import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';

export default function AuthCodeErrorPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6">
      <div className="space-y-2">
        <p className="label-xs">Auth</p>
        <h1 className="text-2xl font-semibold tracking-tight">That link is dead.</h1>
        <p className="text-sm text-muted-foreground">Sign-in links expire. Request a new one.</p>
      </div>
      <Link href="/login" className={buttonVariants({ size: 'lg' })}>
        Back to sign in
      </Link>
    </main>
  );
}
