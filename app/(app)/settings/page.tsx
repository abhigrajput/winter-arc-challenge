import type { Metadata } from 'next';
import { LogOut } from 'lucide-react';
import { requireUser } from '@/lib/profile';
import { createClient } from '@/lib/supabase/server';
import { parseReminderSettings } from '@/lib/reminders/settings';
import { Button } from '@/components/ui/button';
import { PushPanel } from '@/components/settings/push-panel';
import { ReminderForm } from '@/components/settings/reminder-form';
import { signOut } from '@/app/(auth)/login/actions';

export const metadata: Metadata = { title: 'Settings' };
export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const { userId, email, profile } = await requireUser();
  if (!profile) return null;

  const supabase = await createClient();
  const [{ data: row }, { count: devices }] = await Promise.all([
    supabase.from('reminder_settings').select('settings').eq('user_id', userId).maybeSingle(),
    supabase.from('push_subscriptions').select('id', { count: 'exact', head: true }).eq('user_id', userId),
  ]);

  const settings = parseReminderSettings(row?.settings, profile);

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="font-mono text-xs text-muted-foreground">{email}</p>
      </header>

      <section aria-labelledby="notifications-heading" className="space-y-3">
        <h2 id="notifications-heading" className="label-xs">
          Notifications
        </h2>
        <PushPanel vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''} devices={devices ?? 0} />
      </section>

      <section aria-labelledby="reminders-heading" className="space-y-3">
        <h2 id="reminders-heading" className="label-xs">
          Reminders
        </h2>
        <p className="text-sm text-muted-foreground">
          Times are local to {profile.timezone ?? 'Asia/Kolkata'}. Sent within 15 minutes of the time
          set, on every device with notifications on.
        </p>
        <ReminderForm settings={settings} />
      </section>

      <section aria-labelledby="account-heading" className="space-y-3">
        <h2 id="account-heading" className="label-xs">
          Account
        </h2>
        <form action={signOut}>
          <Button type="submit" variant="outline" className="w-full">
            <LogOut />
            Sign out
          </Button>
        </form>
      </section>
    </div>
  );
}
