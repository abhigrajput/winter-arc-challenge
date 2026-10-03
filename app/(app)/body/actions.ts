'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { localDate } from '@/lib/calc/day';
import { navyBodyFat } from '@/lib/calc/bodyfat';
import { normalizeDecimal } from '@/lib/decimal';
import { PHOTO_ANGLES, PHOTO_BUCKET, photoPath, type PhotoAngle } from '@/lib/body/angles';

/**
 * Body tracking writes (§8.6).
 *
 * body_measurements is keyed on (user_id, log_date), so a second entry on the
 * same day updates rather than duplicates. Body fat is recomputed from the
 * tape measurements on every write so it can never drift from them.
 */

export interface BodyResult {
  error?: string;
}

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

async function context() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) redirect('/login');
  return { supabase, profile };
}

// Accepts "80,5" as well as "80.5"; blank keeps the stored value.
const optionalDecimal = (min: number, max: number) =>
  z.preprocess(normalizeDecimal, z.coerce.number().min(min).max(max).optional()).transform(
    (v) => v ?? null,
  );

const optionalCm = optionalDecimal(10, 250);

const measurementInput = z.object({
  weight_kg: optionalDecimal(25, 300),
  waist_cm: optionalCm,
  chest_cm: optionalCm,
  arm_cm: optionalCm,
  thigh_cm: optionalCm,
  neck_cm: optionalCm,
  hip_cm: optionalCm,
});

/**
 * Saves whatever the user filled in for today. Fields left blank keep the
 * value already stored rather than wiping it.
 */
export async function saveMeasurements(_prev: BodyResult, formData: FormData): Promise<BodyResult> {
  const parsed = measurementInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check those numbers.' };
  }

  const { supabase, profile } = await context();
  const logDate = localDate(profile.timezone ?? '');

  const { data: existing } = await supabase
    .from('body_measurements')
    .select('*')
    .eq('user_id', profile.id)
    .eq('log_date', logDate)
    .maybeSingle();

  const merged = {
    weight_kg: parsed.data.weight_kg ?? existing?.weight_kg ?? null,
    waist_cm: parsed.data.waist_cm ?? existing?.waist_cm ?? null,
    chest_cm: parsed.data.chest_cm ?? existing?.chest_cm ?? null,
    arm_cm: parsed.data.arm_cm ?? existing?.arm_cm ?? null,
    thigh_cm: parsed.data.thigh_cm ?? existing?.thigh_cm ?? null,
    neck_cm: parsed.data.neck_cm ?? existing?.neck_cm ?? null,
    hip_cm: parsed.data.hip_cm ?? existing?.hip_cm ?? null,
  };

  if (Object.values(merged).every((v) => v === null)) {
    return { error: 'Fill in at least one measurement.' };
  }

  // §8.6: the body fat estimate always follows the tape, never the other way.
  const bodyFat =
    profile.sex && profile.height_cm && merged.waist_cm && merged.neck_cm
      ? navyBodyFat({
          sex: profile.sex,
          heightCm: profile.height_cm,
          waistCm: merged.waist_cm,
          neckCm: merged.neck_cm,
          hipCm: merged.hip_cm,
        })
      : null;

  const { error } = await supabase.from('body_measurements').upsert(
    { user_id: profile.id, log_date: logDate, ...merged, body_fat_pct: bodyFat },
    { onConflict: 'user_id,log_date' },
  );

  if (error) return { error: 'Could not save. Try again.' };

  // A new weight changes the profile's working figure for the calorie maths.
  if (merged.weight_kg) {
    await supabase
      .from('profiles')
      .update({ weight_kg: merged.weight_kg })
      .eq('id', profile.id);
  }

  revalidatePath('/body');
  return {};
}

/** Uploads one photo and records it. Replaces the same day/angle if present. */
export async function uploadPhoto(_prev: BodyResult, formData: FormData): Promise<BodyResult> {
  const angleRaw = formData.get('angle');
  const file = formData.get('photo');

  if (typeof angleRaw !== 'string' || !PHOTO_ANGLES.includes(angleRaw as PhotoAngle)) {
    return { error: 'Pick an angle.' };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Choose a photo.' };
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return { error: 'That photo is over 8 MB. Try a smaller one.' };
  }
  if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
    return { error: 'Use a JPEG, PNG or WebP image.' };
  }

  const angle = angleRaw as PhotoAngle;
  const { supabase, profile } = await context();
  const logDate = localDate(profile.timezone ?? '');
  const path = photoPath(profile.id, logDate, angle);

  const { error: uploadError } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) return { error: 'Upload failed. Try again.' };

  // The storage path is deterministic, so re-uploading the same day and angle
  // must not create a second row.
  const { data: existing } = await supabase
    .from('progress_photos')
    .select('id')
    .eq('user_id', profile.id)
    .eq('storage_path', path)
    .maybeSingle();

  if (!existing) {
    const { error } = await supabase.from('progress_photos').insert({
      user_id: profile.id,
      log_date: logDate,
      angle,
      storage_path: path,
    });
    if (error) return { error: 'Saved the file but could not record it. Try again.' };
  }

  revalidatePath('/body');
  return {};
}

const deletePhotoInput = z.object({ photoId: z.string().uuid() });

export async function deletePhoto(input: unknown): Promise<BodyResult> {
  const parsed = deletePhotoInput.safeParse(input);
  if (!parsed.success) return { error: 'Invalid request.' };

  const { supabase, profile } = await context();

  const { data: photo } = await supabase
    .from('progress_photos')
    .select('id, storage_path')
    .eq('id', parsed.data.photoId)
    .eq('user_id', profile.id)
    .maybeSingle();

  if (!photo) return { error: 'Photo not found.' };

  await supabase.storage.from(PHOTO_BUCKET).remove([photo.storage_path]);

  const { error } = await supabase
    .from('progress_photos')
    .delete()
    .eq('id', photo.id)
    .eq('user_id', profile.id);

  if (error) return { error: 'Could not delete. Try again.' };

  revalidatePath('/body');
  return {};
}
