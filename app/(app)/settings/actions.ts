'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import {
  REMINDER_KINDS,
  TIMED_KINDS,
  reminderSettingsSchema,
  type ReminderSettings,
} from '@/lib/reminders/settings';

export interface ReminderSettingsState {
  error?: string;
  saved?: boolean;
}

/** Saves the per-reminder toggles and times (§8.13). One row per user. */
export async function saveReminderSettings(
  _prev: ReminderSettingsState,
  formData: FormData,
): Promise<ReminderSettingsState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not signed in.' };

  const draft: Record<string, unknown> = {};
  for (const kind of REMINDER_KINDS) {
    const enabled = formData.get(`${kind}_enabled`) === 'on';
    draft[kind] = (TIMED_KINDS as readonly string[]).includes(kind)
      ? { enabled, time: String(formData.get(`${kind}_time`) ?? '').slice(0, 5) }
      : { enabled };
  }

  const parsed = reminderSettingsSchema.safeParse(draft);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue ? `${String(issue.path[0]).replace('_', ' ')}: ${issue.message}` : 'Check the times.' };
  }

  const settings: ReminderSettings = parsed.data;
  const { error } = await supabase
    .from('reminder_settings')
    .upsert({ user_id: user.id, settings, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });

  if (error) return { error: 'Could not save. Try again.' };

  revalidatePath('/settings');
  return { saved: true };
}
