'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Apple, CalendarCheck, Dumbbell, Scale, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

const ITEMS = [
  { href: '/today', label: 'Today', icon: CalendarCheck },
  { href: '/train', label: 'Train', icon: Dumbbell },
  { href: '/nutrition', label: 'Food', icon: Apple },
  { href: '/body', label: 'Body', icon: Scale },
  { href: '/leaderboard', label: 'Rank', icon: Trophy },
] as const;

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="sticky bottom-0 z-20 border-t border-border bg-background/95 backdrop-blur"
    >
      <ul className="mx-auto grid max-w-2xl grid-cols-5">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-16 flex-col items-center justify-center gap-1 text-[0.65rem] font-medium uppercase tracking-wider transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="size-5" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
