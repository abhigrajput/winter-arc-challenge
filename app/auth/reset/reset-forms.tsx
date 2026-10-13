'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { MIN_PASSWORD } from '@/lib/auth/messages';
import { requestPasswordReset, setNewPassword, type ResetState } from './actions';

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} role="alert" className="text-xs text-destructive">
      {message}
    </p>
  ) : null;
}

export function RequestResetForm() {
  const [state, action, pending] = useActionState<ResetState, FormData>(requestPasswordReset, {});

  if (state.sent) {
    return (
      <div role="status" className="space-y-4 rounded-lg border border-border bg-card p-4 text-sm">
        <p>
          If an account exists for <span className="font-mono">{state.email}</span>, a reset link is on its way. It
          works once and expires in an hour.
        </p>
        <p className="text-muted-foreground">Nothing arrived? Check spam, wait a minute, then try again.</p>
        <Link href="/login" className="text-primary underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="reset-email">Email</Label>
        <Input
          id="reset-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          defaultValue={state.email}
          aria-invalid={Boolean(state.fieldErrors?.email)}
          aria-describedby={state.fieldErrors?.email ? 'reset-email-error' : undefined}
          placeholder="you@example.com"
        />
        <FieldError id="reset-email-error" message={state.fieldErrors?.email} />
      </div>
      {state.error ? <FieldError id="reset-error" message={state.error} /> : null}
      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : null}
        Send reset link
      </Button>
    </form>
  );
}

export function NewPasswordForm({ email }: { email: string | null }) {
  const [state, action, pending] = useActionState<ResetState, FormData>(setNewPassword, {});
  const errors = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-4">
      {email ? (
        // Lets password managers attach the new password to the right account.
        <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="reset-password">New password</Label>
        <PasswordInput
          id="reset-password"
          name="password"
          autoComplete="new-password"
          required
          placeholder={`At least ${MIN_PASSWORD} characters`}
          aria-describedby={errors.password ? 'reset-password-error' : undefined}
        />
        <FieldError id="reset-password-error" message={errors.password} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="reset-confirm">Confirm new password</Label>
        <PasswordInput
          id="reset-confirm"
          name="confirm"
          autoComplete="new-password"
          required
          aria-describedby={errors.confirm ? 'reset-confirm-error' : undefined}
        />
        <FieldError id="reset-confirm-error" message={errors.confirm} />
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}{' '}
          {state.error.includes('expired') ? (
            <Link href="/auth/forgot" className="underline underline-offset-4">
              Request a new link
            </Link>
          ) : null}
        </p>
      ) : null}
      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : null}
        Set new password
      </Button>
    </form>
  );
}
