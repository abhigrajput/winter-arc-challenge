'use client';

import { useActionState, useState, useTransition } from 'react';
import { ExternalLink, Loader2, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  deleteContentPost,
  logContentPost,
  saveGitaProgress,
  type MindResult,
} from '@/app/(app)/today/mind-actions';

export const GITA_CHAPTERS = 18;

/** §8.8 Gita tracker: 18 chapters. */
export function GitaTracker({ completed }: { completed: number[] }) {
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const done = new Set(completed);

  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between">
        <h2 className="label-xs">Bhagavad Gita</h2>
        <span className="font-mono text-xs text-muted-foreground">
          {done.size}/{GITA_CHAPTERS}
        </span>
      </div>

      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}

      <div className="grid grid-cols-9 gap-1.5">
        {Array.from({ length: GITA_CHAPTERS }, (_, i) => i + 1).map((chapter) => (
          <button
            key={chapter}
            type="button"
            aria-pressed={done.has(chapter)}
            aria-label={`Chapter ${chapter}`}
            onClick={() =>
              startTransition(async () => {
                const result = await saveGitaProgress({
                  chapter,
                  verse: null,
                  done: !done.has(chapter),
                });
                setError(result.error ?? null);
              })
            }
            className={cn(
              'rounded border py-2 font-mono text-xs transition-colors',
              done.has(chapter)
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-input text-muted-foreground hover:bg-accent',
            )}
          >
            {chapter}
          </button>
        ))}
      </div>
    </section>
  );
}

export interface ContentPost {
  id: string;
  platform: string;
  title: string;
  url: string | null;
  logDate: string;
}

const PLATFORMS = [
  ['youtube', 'YouTube'],
  ['instagram', 'Instagram'],
  ['other', 'Other'],
] as const;

/** §8.8 content tracker: posts published, with an optional link. */
export function ContentTracker({
  posts,
  thisWeek,
}: {
  posts: ContentPost[];
  thisWeek: number;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<MindResult, FormData>(logContentPost, {});
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between">
        <h2 className="label-xs">Content published</h2>
        <span className="font-mono text-xs text-muted-foreground">{thisWeek} this week</span>
      </div>

      {posts.length > 0 ? (
        <ul className="overflow-hidden rounded-lg border border-border">
          {posts.map((post, index) => (
            <li
              key={post.id}
              className={cn('flex items-center gap-3 bg-card p-3 px-4', index > 0 && 'border-t border-border')}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{post.title}</p>
                <p className="font-mono text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                  {post.platform} · {post.logDate}
                </p>
              </div>
              {post.url ? (
                <a
                  href={post.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open ${post.title}`}
                  className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                >
                  <ExternalLink className="size-4" />
                </a>
              ) : null}
              <button
                type="button"
                onClick={() =>
                  startTransition(async () => {
                    const result = await deleteContentPost({ postId: post.id });
                    setError(result.error ?? null);
                  })
                }
                aria-label={`Remove ${post.title}`}
                className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}

      {open ? (
        <form action={action} className="space-y-3 rounded-lg border border-border bg-card p-4">
          <div className="space-y-2">
            <Label htmlFor="post-title">Title</Label>
            <Input id="post-title" name="title" placeholder="Week 3 progress update" required maxLength={120} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="post-platform">Platform</Label>
              <select
                id="post-platform"
                name="platform"
                defaultValue="instagram"
                className="flex h-11 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {PLATFORMS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="post-url">Link</Label>
              <Input id="post-url" name="url" type="url" placeholder="Optional" />
            </div>
          </div>

          {state.error ? (
            <p role="alert" className="text-xs text-destructive">
              {state.error}
            </p>
          ) : null}

          <div className="flex gap-2">
            <Button type="submit" disabled={pending} className="flex-1">
              {pending ? <Loader2 className="animate-spin" /> : null}
              Log post
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button variant="outline" className="w-full" onClick={() => setOpen(true)}>
          <Plus />
          Log a post
        </Button>
      )}
    </section>
  );
}
