import 'server-only';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { PHOTO_BUCKET } from '@/lib/body/angles';
import { USER_TABLES, redactRows, type AccountExport } from '@/lib/account/tables';

/**
 * Export reads through the user's own session, so RLS guarantees it can only
 * ever contain their rows. Delete needs the service role: storage objects and
 * the auth user are outside what a user session may remove.
 */

export async function buildExport(): Promise<AccountExport | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // The typed client cannot narrow .eq() across a union of table names, so the
  // loop goes through an untyped view of from(). RLS still scopes every read.
  const from = supabase.from.bind(supabase) as unknown as (table: string) => {
    select(columns: string): { eq(column: string, value: string): PromiseLike<{ data: unknown[] | null }> };
  };

  const tables: AccountExport['tables'] = {};
  for (const { table, key } of USER_TABLES) {
    const { data } = await from(table).select('*').eq(key, user.id);
    tables[table] = redactRows(table, (data ?? []) as Record<string, unknown>[]);
  }

  const photo_files = ((tables.progress_photos ?? []) as { storage_path?: string }[])
    .map((p) => p.storage_path)
    .filter((p): p is string => typeof p === 'string');

  return {
    exported_at: new Date().toISOString(),
    format: 'winter-arc-export/v1',
    account: { id: user.id, email: user.email ?? null, created_at: user.created_at ?? null },
    tables,
    photo_files,
  };
}

/** Every object under {userId}/ in the private progress bucket. */
async function listUserPhotos(userId: string): Promise<string[]> {
  const service = createServiceClient();
  const paths: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await service.storage.from(PHOTO_BUCKET).list(userId, { limit: 1000, offset });
    if (error) throw new Error(`list photos: ${error.message}`);
    paths.push(...(data ?? []).map((f) => `${userId}/${f.name}`));
    if (!data || data.length < 1000) break;
  }
  return paths;
}

export interface DeletionReport {
  photosRemoved: number;
}

/**
 * Permanently deletes an account: progress photos from storage first (they do
 * not cascade), then the auth user, which cascades through profiles to every
 * user-owned table.
 */
export async function deleteAccount(userId: string): Promise<DeletionReport> {
  const service = createServiceClient();
  const photos = await listUserPhotos(userId);
  for (let i = 0; i < photos.length; i += 100) {
    const { error } = await service.storage.from(PHOTO_BUCKET).remove(photos.slice(i, i + 100));
    if (error) throw new Error(`remove photos: ${error.message}`);
  }
  const { error } = await service.auth.admin.deleteUser(userId);
  if (error) throw new Error(`delete user: ${error.message}`);
  return { photosRemoved: photos.length };
}
