import Link from 'next/link';
import { ListChecks, LogOut } from 'lucide-react';
import { AppNav } from '@/components/app-nav';
import { Button } from '@/components/ui/button';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/profile';
import { signOut } from '@/app/(auth)/login/actions';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, email } = await requireUser();

  // Nothing in here works without a finished profile, so send them to setup.
  if (!profile?.onboarded) redirect('/onboarding');

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <Link href="/today" className="label-xs hover:text-foreground">
            Winter Arc
          </Link>
          <div className="flex items-center gap-1">
            <span className="mr-2 font-mono text-xs text-muted-foreground">
              {profile?.username ?? email}
            </span>
            <Button asChild variant="ghost" size="icon" aria-label="Manage tasks">
              <Link href="/tasks">
                <ListChecks />
              </Link>
            </Button>
            <form action={signOut}>
              <Button type="submit" variant="ghost" size="icon" aria-label="Sign out">
                <LogOut />
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">{children}</main>

      <AppNav />
    </div>
  );
}
