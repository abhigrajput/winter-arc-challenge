'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isIOS } from '@/lib/push/support';
import { IosInstallSteps } from '@/components/settings/push-panel';

/** Chrome/Edge/Android: the deferred native install prompt. Not in lib.dom yet. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'wa-install-dismissed';

type Mode = { kind: 'hidden' } | { kind: 'ios' } | { kind: 'native'; event: BeforeInstallPromptEvent };

function dismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * "Install Winter Arc" card on /today (only reachable after onboarding).
 * Hidden once installed or dismissed. On iOS Safari, which has no install
 * prompt, it shows the Add to Home Screen steps — and that is also the only
 * way to get notifications there.
 */
export function InstallPrompt() {
  const [mode, setMode] = useState<Mode>({ kind: 'hidden' });

  useEffect(() => {
    const nav = navigator as Navigator & { standalone?: boolean };
    const standalone = window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
    if (standalone || dismissed()) return;

    if (isIOS({ userAgent: navigator.userAgent, maxTouchPoints: navigator.maxTouchPoints ?? 0 })) {
      // Browser-only detection, so it can only run after mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMode({ kind: 'ios' });
      return;
    }

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setMode({ kind: 'native', event: event as BeforeInstallPromptEvent });
    };
    const onInstalled = () => setMode({ kind: 'hidden' });
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (mode.kind === 'hidden') return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Private mode: it just comes back next visit.
    }
    setMode({ kind: 'hidden' });
  }

  async function install() {
    if (mode.kind !== 'native') return;
    await mode.event.prompt();
    const choice = await mode.event.userChoice;
    if (choice.outcome === 'accepted') setMode({ kind: 'hidden' });
  }

  return (
    <aside
      aria-label="Install Winter Arc"
      data-testid="install-prompt"
      className="relative space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4"
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute right-2 top-2 rounded p-1 text-muted-foreground hover:text-foreground"
      >
        <X className="size-4" />
      </button>

      {mode.kind === 'ios' ? (
        <IosInstallSteps />
      ) : (
        <>
          <div className="space-y-1 pr-6">
            <p className="text-sm font-medium">Install Winter Arc</p>
            <p className="text-xs text-muted-foreground">
              One tap from the home screen, works offline, and gets reminders.
            </p>
          </div>
          <Button onClick={install} size="sm">
            <Download />
            Install
          </Button>
        </>
      )}
      <p className="text-xs text-muted-foreground">
        Reminders are set in{' '}
        <Link href="/settings" className="text-primary underline-offset-4 hover:underline">
          Settings
        </Link>
        .
      </p>
    </aside>
  );
}
