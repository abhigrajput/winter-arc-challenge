/**
 * Every table holding a user's rows, and how each is keyed to them.
 * Shared by "Export my data" and "Delete account", so neither can drift from
 * the other. Deleting the auth user cascades through all of these; storage
 * (progress photos) does not cascade and is removed separately.
 */
export const USER_TABLES = [
  { table: 'profiles', key: 'id' },
  { table: 'user_tasks', key: 'user_id' },
  { table: 'daily_logs', key: 'user_id' },
  { table: 'workout_sessions', key: 'user_id' },
  { table: 'workout_sets', key: 'user_id' },
  { table: 'food_entries', key: 'user_id' },
  { table: 'water_logs', key: 'user_id' },
  { table: 'body_measurements', key: 'user_id' },
  { table: 'progress_photos', key: 'user_id' },
  { table: 'skin_logs', key: 'user_id' },
  { table: 'sleep_logs', key: 'user_id' },
  { table: 'gita_progress', key: 'user_id' },
  { table: 'content_posts', key: 'user_id' },
  { table: 'checkins', key: 'user_id' },
  { table: 'ai_plans', key: 'user_id' },
  { table: 'ai_usage', key: 'user_id' },
  { table: 'achievements', key: 'user_id' },
  { table: 'reminder_settings', key: 'user_id' },
  { table: 'reminder_log', key: 'user_id' },
  { table: 'push_subscriptions', key: 'user_id' },
] as const;

export type UserTable = (typeof USER_TABLES)[number]['table'];

/**
 * Columns never included in an export: push-subscription keys are credentials
 * for sending to the device, not data about the user.
 */
const REDACTED: Partial<Record<UserTable, readonly string[]>> = {
  push_subscriptions: ['p256dh', 'auth'],
};

export function redactRows(table: UserTable, rows: Record<string, unknown>[]): Record<string, unknown>[] {
  const hidden = REDACTED[table];
  if (!hidden) return rows;
  return rows.map((row) => Object.fromEntries(Object.entries(row).filter(([key]) => !hidden.includes(key))));
}

export interface AccountExport {
  exported_at: string;
  format: 'winter-arc-export/v1';
  account: { id: string; email: string | null; created_at: string | null };
  tables: Partial<Record<UserTable, Record<string, unknown>[]>>;
  /** Storage paths of progress photos (files are private; download in the app). */
  photo_files: string[];
}

export function exportFilename(now: Date = new Date()): string {
  return `winter-arc-export-${now.toISOString().slice(0, 10)}.json`;
}

/** The exact phrase a user types to confirm account deletion. */
export const DELETE_CONFIRMATION = 'DELETE';

export function isDeleteConfirmed(typed: unknown): boolean {
  return typeof typed === 'string' && typed.trim() === DELETE_CONFIRMATION;
}
