'use client';

import { useActionState, useState } from 'react';
import { Download, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { MIN_PASSWORD } from '@/lib/auth/messages';
import { DELETE_CONFIRMATION } from '@/lib/account/tables';
import { changePassword, deleteMyAccount, setPublicProfile, type AccountState } from '@/app/(app)/settings/account-actions';

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p role="alert" className="text-xs text-destructive">
      {message}
    </p>
  ) : null;
}

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState<AccountState, FormData>(changePassword, {});
  const errors = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4 rounded-lg border border-border bg-card p-4" aria-labelledby="password-heading">
      <h3 id="password-heading" className="text-sm font-semibold">
        Change password
      </h3>
      <div className="space-y-2">
        <Label htmlFor="current-password">Current password</Label>
        <PasswordInput id="current-password" name="current" autoComplete="current-password" required />
        <FieldError message={errors.current} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="new-password">New password</Label>
        <PasswordInput id="new-password" name="next" autoComplete="new-password" required placeholder={`At least ${MIN_PASSWORD} characters`} />
        <FieldError message={errors.next} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm-password">Confirm new password</Label>
        <PasswordInput id="confirm-password" name="confirm" autoComplete="new-password" required />
        <FieldError message={errors.confirm} />
      </div>
      {state.error ? <FieldError message={state.error} /> : null}
      {state.done ? (
        <p role="status" className="text-sm text-primary">
          Password changed.
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? <Loader2 className="animate-spin" /> : null}
        Change password
      </Button>
    </form>
  );
}

export function ExportData() {
  return (
    <div className="space-y-2 rounded-lg border border-border bg-card p-4">
      <h3 className="text-sm font-semibold">Export my data</h3>
      <p className="text-xs text-muted-foreground">
        Everything you have logged, as one JSON file. Photos are listed by file name; download them from the Body page.
      </p>
      <a
        href="/api/account/export"
        download
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-border text-sm font-medium transition-colors hover:bg-accent"
      >
        <Download className="size-4" aria-hidden />
        Download JSON
      </a>
    </div>
  );
}

export function DeleteAccount() {
  const [state, action, pending] = useActionState<AccountState, FormData>(deleteMyAccount, {});
  const [typed, setTyped] = useState('');
  const armed = typed.trim() === DELETE_CONFIRMATION;

  return (
    <form action={action} className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4" aria-labelledby="delete-heading">
      <h3 id="delete-heading" className="text-sm font-semibold text-destructive">
        Delete account
      </h3>
      <p className="text-xs text-muted-foreground">
        Permanently deletes your profile, every log, plan, check-in and progress photo. This cannot be undone. Export
        your data first if you want a copy.
      </p>
      <div className="space-y-2">
        <Label htmlFor="delete-confirm">
          Type <span className="font-mono text-foreground">{DELETE_CONFIRMATION}</span> to confirm
        </Label>
        <Input
          id="delete-confirm"
          name="confirm"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
        />
        <FieldError message={state.fieldErrors?.confirm} />
      </div>
      {state.error ? <FieldError message={state.error} /> : null}
      <Button type="submit" variant="destructive" disabled={!armed || pending} className="w-full">
        {pending ? <Loader2 className="animate-spin" /> : <Trash2 />}
        Delete my account
      </Button>
    </form>
  );
}

export function PublicProfileToggle({ isPublic, username }: { isPublic: boolean; username: string | null }) {
  const [state, action, pending] = useActionState<AccountState, FormData>(setPublicProfile, {});
  return (
    <form action={action} className="space-y-3 rounded-lg border border-border bg-card p-4">
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          name="is_public"
          defaultChecked={isPublic}
          className="mt-0.5 size-5 shrink-0 accent-primary"
          aria-describedby="public-profile-note"
        />
        <span>
          <span className="block text-sm font-semibold">Public profile</span>
          <span id="public-profile-note" className="block text-xs text-muted-foreground">
            Shows your username, day count, streak, points, badges and completion heatmap on the leaderboard
            {username ? ` and at /u/${username}` : ''}. Body data and photos are never public. Off = hidden everywhere.
          </span>
        </span>
      </label>
      {state.error ? <FieldError message={state.error} /> : null}
      {state.done ? (
        <p role="status" className="text-sm text-primary">
          Saved.
        </p>
      ) : null}
      <Button type="submit" variant="outline" disabled={pending} className="w-full">
        {pending ? <Loader2 className="animate-spin" /> : null}
        Save visibility
      </Button>
    </form>
  );
}
