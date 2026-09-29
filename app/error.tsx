'use client';

import { Button } from '@/components/ui/button';

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6">
      <div className="space-y-2">
        <p className="label-xs">Error</p>
        <h1 className="text-2xl font-semibold tracking-tight">Something broke.</h1>
        <p className="text-sm text-muted-foreground">
          The page failed to load. Retry, or come back in a minute.
        </p>
      </div>
      <Button onClick={reset} size="lg">
        Retry
      </Button>
    </main>
  );
}
