'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, BellOff, Loader2, Send, Share, SquarePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { pushSupport, urlBase64ToUint8Array, type PushSupport } from '@/lib/push/support';

type Status =
  | { kind: 'checking' }
  | { kind: 'support'; support: Exclude<PushSupport, 'supported'> }
  | { kind: 'denied' }
  | { kind: 'off' }
  | { kind: 'on'; endpoint: string };

function readSupport(): PushSupport {
  const nav = navigator as Navigator & { standalone?: boolean };
  return pushSupport({
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    standalone: window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true,
    hasServiceWorker: 'serviceWorker' in navigator,
    hasPushManager: 'PushManager' in window,
    hasNotification: 'Notification' in window,
  });
}

async function registration(): Promise<ServiceWorkerRegistration> {
  // Registering again is a no-op when the worker is already installed.
  await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
  return navigator.serviceWorker.ready;
}

/**
 * Turns push on or off for THIS device, and sends a test. Per-reminder
 * preferences live in ReminderForm and apply to every device.
 */
export function PushPanel({ vapidPublicKey, devices }: { vapidPublicKey: string; devices: number }) {
  const [status, setStatus] = useState<Status>({ kind: 'checking' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    const support = readSupport();
    if (support !== 'supported') {
      setStatus({ kind: 'support', support });
      return;
    }
    if (Notification.permission === 'denied') {
      setStatus({ kind: 'denied' });
      return;
    }
    try {
      const reg = await registration();
      const sub = await reg.pushManager.getSubscription();
      setStatus(sub ? { kind: 'on', endpoint: sub.endpoint } : { kind: 'off' });
    } catch {
      setStatus({ kind: 'off' });
    }
  }, []);

  useEffect(() => {
    // Reads browser-only APIs, so it has to run after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  async function run(task: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setMessage(null);
    try {
      await task();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const enable = () =>
    run(async () => {
      if (!vapidPublicKey) throw new Error('Push is not configured on the server.');
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? { kind: 'denied' } : { kind: 'off' });
        return;
      }
      const reg = await registration();
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        }));
      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!response.ok) {
        await sub.unsubscribe().catch(() => undefined);
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? 'Could not save this device.');
      }
      setStatus({ kind: 'on', endpoint: sub.endpoint });
      setMessage('Notifications on for this device.');
    });

  const disable = () =>
    run(async () => {
      const reg = await registration();
      const sub = await reg.pushManager.getSubscription();
      const endpoint = sub?.endpoint ?? (status.kind === 'on' ? status.endpoint : null);
      await sub?.unsubscribe();
      if (endpoint) {
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ endpoint }),
        });
      }
      setStatus({ kind: 'off' });
      setMessage('Notifications off for this device.');
    });

  const sendTest = () =>
    run(async () => {
      const response = await fetch('/api/push/test', { method: 'POST' });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error ?? 'Test failed.');
      setMessage(body?.sent > 0 ? `Sent to ${body.sent} device${body.sent === 1 ? '' : 's'}.` : 'No device accepted it.');
    });

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4" data-testid="push-panel" data-status={status.kind}>
      {status.kind === 'checking' ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Checking this device…
        </p>
      ) : null}

      {status.kind === 'support' && status.support === 'ios-install' ? <IosInstallSteps /> : null}

      {status.kind === 'support' && status.support === 'ios-too-old' ? (
        <p className="text-sm text-muted-foreground">
          Notifications need iOS 16.4 or later, with Winter Arc added to the Home Screen. Update iOS to turn them on.
        </p>
      ) : null}

      {status.kind === 'support' && status.support === 'unsupported' ? (
        <p className="text-sm text-muted-foreground">
          This browser cannot receive notifications. Try Chrome, Edge, Firefox or Safari.
        </p>
      ) : null}

      {status.kind === 'denied' ? (
        <p className="text-sm text-muted-foreground">
          Notifications are blocked for this site. Allow them in your browser&apos;s site settings, then reload.
        </p>
      ) : null}

      {status.kind === 'off' ? (
        <>
          <p className="text-sm text-muted-foreground">Off on this device.</p>
          <Button onClick={enable} disabled={busy} className="w-full" size="lg">
            {busy ? <Loader2 className="animate-spin" /> : <Bell />}
            Turn on notifications
          </Button>
        </>
      ) : null}

      {status.kind === 'on' ? (
        <>
          <p className="flex items-center gap-2 text-sm">
            <Bell className="size-4 text-primary" aria-hidden />
            On for this device.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={sendTest} disabled={busy} variant="outline">
              {busy ? <Loader2 className="animate-spin" /> : <Send />}
              Send test
            </Button>
            <Button onClick={disable} disabled={busy} variant="ghost">
              <BellOff />
              Turn off
            </Button>
          </div>
        </>
      ) : null}

      {message ? (
        <p role="status" className="text-xs text-muted-foreground">
          {message}
        </p>
      ) : null}
      <p className="text-[0.65rem] text-muted-foreground">
        {devices} device{devices === 1 ? '' : 's'} registered on this account.
      </p>
    </div>
  );
}

/** iOS Safari: push only exists once the app is on the Home Screen (16.4+). */
export function IosInstallSteps() {
  return (
    <div className="space-y-2 text-sm" data-testid="ios-install-steps">
      <p className="font-medium">Add Winter Arc to your Home Screen first.</p>
      <p className="text-muted-foreground">On iPhone and iPad, notifications only work from the installed app.</p>
      <ol className="space-y-1.5 text-muted-foreground">
        <li className="flex items-center gap-2">
          <span className="font-mono text-xs text-primary">1</span> Tap
          <Share className="size-4 text-foreground" aria-label="Share" /> in Safari&apos;s toolbar.
        </li>
        <li className="flex items-center gap-2">
          <span className="font-mono text-xs text-primary">2</span> Choose
          <SquarePlus className="size-4 text-foreground" aria-hidden /> Add to Home Screen.
        </li>
        <li className="flex items-center gap-2">
          <span className="font-mono text-xs text-primary">3</span> Open Winter Arc from the Home Screen, then come back here.
        </li>
      </ol>
    </div>
  );
}
