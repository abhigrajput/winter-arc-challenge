'use client';

import { useActionState, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Camera, Eye, EyeOff, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { PHOTO_ANGLES, type PhotoAngle } from '@/lib/body/angles';
import { deletePhoto, uploadPhoto, type BodyResult } from '@/app/(app)/body/actions';

export interface ClientPhoto {
  id: string;
  logDate: string;
  angle: PhotoAngle;
  signedUrl: string | null;
}

/**
 * §11 signs photo URLs for 60 seconds. That is deliberately short, which means
 * a page left open outlives its links. Rather than lengthen the TTL, a failed
 * load offers a refresh that re-renders the page with freshly signed URLs.
 */
function SignedImage({
  src,
  alt,
  className,
  style,
}: {
  src: string | null;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [expired, setExpired] = useState(false);
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (!src || expired) {
    return (
      <button
        type="button"
        onClick={() => startTransition(() => router.refresh())}
        className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-muted p-2 text-center text-[0.6rem] text-muted-foreground hover:text-foreground"
      >
        {pending ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
        Link expired
      </button>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      unoptimized
      // Eager, not lazy: these URLs are signed for 60 seconds (§11), so a photo
      // that only loads once scrolled into view would often fetch an already
      // expired link.
      loading="eager"
      onError={() => setExpired(true)}
      className={className}
      style={style}
    />
  );
}

const ANGLE_LABELS: Record<PhotoAngle, string> = {
  front: 'Front',
  side: 'Side',
  back: 'Back',
  face: 'Face',
};

export function PhotoPanel({ photos }: { photos: Record<PhotoAngle, ClientPhoto[]> }) {
  const [angle, setAngle] = useState<PhotoAngle>('front');
  const forAngle = photos[angle];
  const latest = forAngle[0] ?? null;
  const earliest = forAngle[forAngle.length - 1] ?? null;

  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label="Photo angle"
        className="grid grid-cols-4 gap-px overflow-hidden rounded-lg border border-border bg-border"
      >
        {PHOTO_ANGLES.map((option) => (
          <button
            key={option}
            role="tab"
            aria-selected={angle === option}
            onClick={() => setAngle(option)}
            className={cn(
              'bg-card py-2.5 text-xs font-medium uppercase tracking-wider transition-colors',
              angle === option
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {ANGLE_LABELS[option]}
            {photos[option].length > 0 ? (
              <span className="ml-1 font-mono text-[0.6rem]">{photos[option].length}</span>
            ) : null}
          </button>
        ))}
      </div>

      <UploadForm angle={angle} ghost={latest} />

      {earliest && latest && earliest.id !== latest.id ? (
        <BeforeAfter before={earliest} after={latest} />
      ) : null}

      {forAngle.length > 0 ? (
        <section className="space-y-2">
          <h3 className="label-xs">All {ANGLE_LABELS[angle].toLowerCase()} shots</h3>
          <ul className="grid grid-cols-3 gap-2">
            {forAngle.map((photo) => (
              <PhotoTile key={photo.id} photo={photo} />
            ))}
          </ul>
        </section>
      ) : (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No {ANGLE_LABELS[angle].toLowerCase()} photos yet.
        </p>
      )}
    </div>
  );
}

/**
 * §8.6 ghost overlay: the previous shot sits semi-transparent behind the
 * camera preview so the next one lines up.
 */
function UploadForm({ angle, ghost }: { angle: PhotoAngle; ghost: ClientPhoto | null }) {
  const [state, action, pending] = useActionState<BodyResult, FormData>(uploadPhoto, {});
  const [preview, setPreview] = useState<string | null>(null);
  const [showGhost, setShowGhost] = useState(true);

  return (
    <form action={action} className="space-y-3 rounded-lg border border-border bg-card p-4">
      <input type="hidden" name="angle" value={angle} />

      <div className="flex items-center justify-between">
        <p className="label-xs">New {ANGLE_LABELS[angle].toLowerCase()} photo</p>
        {ghost?.signedUrl ? (
          <button
            type="button"
            onClick={() => setShowGhost((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            {showGhost ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
            Ghost
          </button>
        ) : null}
      </div>

      {preview || (showGhost && ghost?.signedUrl) ? (
        <div className="relative mx-auto aspect-[3/4] w-full max-w-56 overflow-hidden rounded-md bg-muted">
          {showGhost && ghost?.signedUrl ? (
            <SignedImage
              src={ghost.signedUrl}
              alt={`Previous ${angle} photo, for alignment`}
              className={cn('object-cover', preview ? 'opacity-40' : 'opacity-70')}
            />
          ) : null}
          {preview ? (
            <Image
              src={preview}
              alt="Selected photo"
              fill
              unoptimized
              className="object-cover mix-blend-normal"
              style={{ opacity: ghost?.signedUrl && showGhost ? 0.7 : 1 }}
            />
          ) : null}
        </div>
      ) : null}

      {ghost ? (
        <p className="text-center text-xs text-muted-foreground">
          Match the last shot: same spot, same light, same time of day.
        </p>
      ) : null}

      <input
        type="file"
        name="photo"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        onChange={(event) => {
          const file = event.target.files?.[0];
          setPreview(file ? URL.createObjectURL(file) : null);
        }}
        className="block w-full text-xs text-muted-foreground file:mr-3 file:rounded-md file:border file:border-input file:bg-transparent file:px-3 file:py-2 file:text-xs file:text-foreground"
      />

      {state.error ? (
        <p role="alert" className="text-xs text-destructive">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? <Loader2 className="animate-spin" /> : <Camera />}
        Save photo
      </Button>

      <p className="text-center text-[0.65rem] text-muted-foreground">
        Private. Stored in a locked bucket and never shown on your public profile.
      </p>
    </form>
  );
}

/** §8.6 before/after slider. */
function BeforeAfter({ before, after }: { before: ClientPhoto; after: ClientPhoto }) {
  const [position, setPosition] = useState(50);

  if (!before.signedUrl || !after.signedUrl) return null;

  return (
    <section className="space-y-2">
      <h3 className="label-xs">
        {before.logDate} to {after.logDate}
      </h3>

      <div className="relative mx-auto aspect-[3/4] w-full max-w-64 overflow-hidden rounded-lg border border-border bg-muted">
        <SignedImage
          src={before.signedUrl}
          alt={`Before, ${before.logDate}`}
          className="object-cover"
        />
        {/* clip-path rather than a width-constrained wrapper: the image keeps
            its own size, so dragging reveals it instead of squashing it. */}
        <SignedImage
          src={after.signedUrl}
          alt={`After, ${after.logDate}`}
          className="object-cover"
          style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
        />
        <div
          aria-hidden
          className="absolute inset-y-0 w-0.5 bg-primary"
          style={{ left: `${position}%` }}
        />
      </div>

      <input
        type="range"
        min={0}
        max={100}
        value={position}
        onChange={(event) => setPosition(Number(event.target.value))}
        aria-label="Before and after slider"
        className="w-full accent-primary"
      />
    </section>
  );
}

function PhotoTile({ photo }: { photo: ClientPhoto }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <li className="space-y-1">
      <div className="relative aspect-[3/4] overflow-hidden rounded-md border border-border bg-muted">
        <SignedImage
          src={photo.signedUrl}
          alt={`${photo.angle} photo from ${photo.logDate}`}
          className="object-cover"
        />
      </div>
      <div className="flex items-center justify-between">
        <span className="font-mono text-[0.6rem] text-muted-foreground">{photo.logDate}</span>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await deletePhoto({ photoId: photo.id });
              setError(result.error ?? null);
            })
          }
          aria-label={`Delete ${photo.angle} photo from ${photo.logDate}`}
          className="text-muted-foreground transition-colors hover:text-destructive"
        >
          <Trash2 className="size-3" />
        </button>
      </div>
      {error ? <p className="text-[0.6rem] text-destructive">{error}</p> : null}
    </li>
  );
}
