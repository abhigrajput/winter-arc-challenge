'use client';

import { useActionState, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { AUTH_FEATURES } from '@/lib/auth/features';
import { HONEYPOT_FIELD, MIN_PASSWORD } from '@/lib/auth/messages';
import { signIn, signUp, signInWithGoogle, type AuthActionState } from './actions';

export type AuthTab = 'signin' | 'signup';

const TABS: { id: AuthTab; label: string }[] = [
  { id: 'signin', label: 'Sign in' },
  { id: 'signup', label: 'Create account' },
];

export function LoginForm({
  next,
  initialTab,
  initialError,
}: {
  next: string;
  initialTab: AuthTab;
  initialError?: string;
}) {
  const [tab, setTab] = useState<AuthTab>(initialTab);

  return (
    <div className="space-y-6">
      <div role="tablist" aria-label="Account" className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => setTab(t.id)}
            className={cn(
              'bg-card py-3 text-xs font-medium uppercase tracking-wider transition-colors',
              tab === t.id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Keyed so switching tabs starts each form clean. */}
      {tab === 'signin' ? (
        <SignInForm key="signin" next={next} initialError={initialError} />
      ) : (
        <SignUpForm key="signup" />
      )}

      {AUTH_FEATURES.google ? (
        <>
          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="label-xs">or</span>
            <span className="h-px flex-1 bg-border" />
          </div>
          <form action={signInWithGoogle}>
            <input type="hidden" name="next" value={next} />
            <Button type="submit" variant="outline" className="w-full" size="lg">
              Continue with Google
            </Button>
          </form>
        </>
      ) : null}
    </div>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-xs text-destructive">
      {message}
    </p>
  );
}

function SignInForm({ next, initialError }: { next: string; initialError?: string }) {
  const [state, action, pending] = useActionState<AuthActionState, FormData>(signIn, { error: initialError });
  const errors = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-4" role="tabpanel" id="panel-signin" aria-labelledby="tab-signin">
      <input type="hidden" name="next" value={next} />

      <div className="space-y-2">
        <Label htmlFor="signin-email">Email</Label>
        <Input
          id="signin-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          defaultValue={state.values?.email}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? 'signin-email-error' : undefined}
          placeholder="you@example.com"
        />
        <FieldError id="signin-email-error" message={errors.email} />
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <Label htmlFor="signin-password">Password</Label>
          {AUTH_FEATURES.passwordReset ? (
            <a href="/auth/reset" className="text-xs text-muted-foreground hover:text-foreground">
              Forgot password?
            </a>
          ) : null}
        </div>
        <PasswordInput id="signin-password" name="password" autoComplete="current-password" required />
        <FieldError id="signin-password-error" message={errors.password} />
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : null}
        Sign in
      </Button>
    </form>
  );
}

function SignUpForm() {
  const [state, action, pending] = useActionState<AuthActionState, FormData>(signUp, {});
  const errors = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-4" role="tabpanel" id="panel-signup" aria-labelledby="tab-signup">
      {/* Honeypot: off-screen, unfocusable, ignored by password managers. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor={HONEYPOT_FIELD}>Company</label>
        <input id={HONEYPOT_FIELD} name={HONEYPOT_FIELD} type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="signup-name">Name</Label>
        <Input
          id="signup-name"
          name="name"
          autoComplete="name"
          required
          maxLength={40}
          defaultValue={state.values?.name}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? 'signup-name-error' : undefined}
          placeholder="Rana"
        />
        <FieldError id="signup-name-error" message={errors.name} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="signup-email">Email</Label>
        <Input
          id="signup-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          defaultValue={state.values?.email}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? 'signup-email-error' : undefined}
          placeholder="you@example.com"
        />
        <FieldError id="signup-email-error" message={errors.email} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="signup-password">Password</Label>
        <PasswordInput
          id="signup-password"
          name="password"
          autoComplete="new-password"
          required
          aria-invalid={Boolean(errors.password)}
          aria-describedby="signup-password-hint"
          placeholder={`At least ${MIN_PASSWORD} characters`}
        />
        {errors.password ? (
          <FieldError id="signup-password-hint" message={errors.password} />
        ) : (
          <p id="signup-password-hint" className="text-xs text-muted-foreground">
            At least {MIN_PASSWORD} characters.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="signup-confirm">Confirm password</Label>
        <PasswordInput
          id="signup-confirm"
          name="confirm"
          autoComplete="new-password"
          required
          aria-invalid={Boolean(errors.confirm)}
          aria-describedby={errors.confirm ? 'signup-confirm-error' : undefined}
        />
        <FieldError id="signup-confirm-error" message={errors.confirm} />
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : null}
        Create account
      </Button>
    </form>
  );
}
