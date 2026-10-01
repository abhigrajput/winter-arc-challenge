/**
 * Pure photo helpers (§8.6, §11).
 *
 * Kept separate from lib/body/photos.ts because the client components need the
 * angles and labels, and that module is server-only.
 */

export const PHOTO_BUCKET = 'progress';

/** Matches the live progress_photos angle CHECK constraint. */
export const PHOTO_ANGLES = ['front', 'side', 'back', 'face'] as const;
export type PhotoAngle = (typeof PHOTO_ANGLES)[number];

export function isPhotoAngle(value: string): value is PhotoAngle {
  return (PHOTO_ANGLES as readonly string[]).includes(value);
}

/** §11: {user_id}/{date}-{angle}.jpg */
export function photoPath(userId: string, logDate: string, angle: PhotoAngle): string {
  return `${userId}/${logDate}-${angle}.jpg`;
}

/** §11: signed URLs, 60 seconds. */
export const SIGNED_URL_TTL_SECONDS = 60;

export interface PhotoRecord {
  id: string;
  logDate: string;
  angle: PhotoAngle;
  storagePath: string;
  /** Short-lived; never persisted or logged. */
  signedUrl: string | null;
}

/**
 * Groups photos by angle so the UI can show a ghost overlay of the previous
 * shot and a before/after pair without re-querying. Newest first.
 */
export function groupByAngle(photos: PhotoRecord[]): Record<PhotoAngle, PhotoRecord[]> {
  const grouped = { front: [], side: [], back: [], face: [] } as Record<PhotoAngle, PhotoRecord[]>;

  for (const photo of photos) {
    grouped[photo.angle].push(photo);
  }

  for (const angle of PHOTO_ANGLES) {
    grouped[angle].sort((a, b) => b.logDate.localeCompare(a.logDate));
  }

  return grouped;
}
