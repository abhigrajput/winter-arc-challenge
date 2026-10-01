import 'server-only';
import { createClient } from '@/lib/supabase/server';
import {
  PHOTO_BUCKET,
  SIGNED_URL_TTL_SECONDS,
  isPhotoAngle,
  type PhotoAngle,
  type PhotoRecord,
} from '@/lib/body/angles';

/**
 * Progress photo reads (§8.6, §11).
 *
 * The `progress` bucket is private. Files live at {user_id}/{date}-{angle}.jpg
 * and are only ever served through a short-lived signed URL — verified against
 * the live project: an unsigned fetch is refused, and storage RLS blocks a
 * write into another user's folder.
 *
 * The pure pieces live in lib/body/angles.ts so client components can use them.
 */

/**
 * Signs a batch of photos in one call. A path that fails to sign comes back
 * with a null url rather than breaking the whole page.
 */
export async function signPhotos(
  rows: { id: string; log_date: string; angle: string; storage_path: string }[],
): Promise<PhotoRecord[]> {
  if (rows.length === 0) return [];

  const supabase = await createClient();
  const { data: signed } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrls(
      rows.map((r) => r.storage_path),
      SIGNED_URL_TTL_SECONDS,
    );

  const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));

  return rows.map((row) => ({
    id: row.id,
    logDate: row.log_date,
    angle: (isPhotoAngle(row.angle) ? row.angle : 'front') as PhotoAngle,
    storagePath: row.storage_path,
    signedUrl: urlByPath.get(row.storage_path) ?? null,
  }));
}

/** All of a user's photos, newest first, with signed URLs attached. */
export async function loadPhotos(userId: string): Promise<PhotoRecord[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('progress_photos')
    .select('id, log_date, angle, storage_path')
    .eq('user_id', userId)
    .order('log_date', { ascending: false });

  return signPhotos(data ?? []);
}
