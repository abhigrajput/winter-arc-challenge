import Link from 'next/link';
import type { ReactNode } from 'react';
import { LEGAL } from '@/lib/legal';

/** Shared shell for /privacy and /terms: readable measure, dated, linked. */
export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <Link href="/" className="label-xs hover:text-foreground">
        {LEGAL.appName}
      </Link>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-xs text-muted-foreground">Last updated {LEGAL.lastUpdated}</p>
      <div className="legal mt-8 space-y-8 text-sm leading-relaxed text-muted-foreground">{children}</div>
      <nav aria-label="Legal" className="mt-12 flex gap-4 border-t border-border pt-6 text-xs">
        <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
        <Link href="/terms" className="hover:text-foreground">Terms</Link>
        <Link href="/" className="hover:text-foreground">Home</Link>
      </nav>
    </main>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

export function ContactLine() {
  return LEGAL.contactEmail ? (
    <p>
      Questions or requests: <a className="text-primary underline-offset-4 hover:underline" href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>.
    </p>
  ) : null;
}

export function GrievanceOfficer() {
  const { name, email } = LEGAL.grievanceOfficer;
  return (
    <p data-testid="grievance-officer">
      <strong className="text-foreground">Grievance officer:</strong> {name ? `${name}, ` : ''}
      <a className="text-primary underline-offset-4 hover:underline" href={`mailto:${email}`}>
        {email}
      </a>
    </p>
  );
}
