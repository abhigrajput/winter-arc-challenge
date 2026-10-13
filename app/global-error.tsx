'use client';

import Link from 'next/link';
import './globals.css';

/**
 * Last-resort boundary: replaces the root layout when it throws, so it brings
 * its own <html>/<body> and must not rely on anything the layout sets up.
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background font-sans text-foreground">
        <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6">
          <div className="space-y-2">
            <p className="label-xs">Error</p>
            <h1 className="text-2xl font-semibold tracking-tight">Winter Arc is down.</h1>
            <p className="text-sm text-muted-foreground">Something failed before the app could load. Retry in a minute.</p>
            {error.digest ? <p className="font-mono text-xs text-muted-foreground">Ref {error.digest}</p> : null}
          </div>
          <button
            type="button"
            onClick={() => retry()}
            className="h-11 rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground"
          >
            Retry
          </button>
          <Link href="/" className="text-center text-sm text-muted-foreground underline-offset-4 hover:underline">
            Home
          </Link>
        </main>
      </body>
    </html>
  );
}
