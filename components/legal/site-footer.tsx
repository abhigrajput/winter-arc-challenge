import Link from 'next/link';
import { cn } from '@/lib/utils';

/** Public-page footer: the fixed disclaimer plus the legal links. */
export function SiteFooter({ className }: { className?: string }) {
  return (
    <footer className={cn('space-y-2 text-center text-xs text-muted-foreground', className)}>
      <p>General guidance, not medical advice.</p>
      <nav aria-label="Legal" className="flex justify-center gap-4">
        <Link href="/privacy" className="hover:text-foreground">
          Privacy
        </Link>
        <Link href="/terms" className="hover:text-foreground">
          Terms
        </Link>
      </nav>
    </footer>
  );
}
