'use client';

import { useActionState, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signIn, signUp, signInWithGoogle, type AuthActionState } from './actions';

type Mode = 'signin' | 'signup';

export function LoginForm({ next, initialError }: { next: string; initialError?: string }) {
  const [mode, setMode] = useState<Mode>('signin');
  const [state, action, pending] = useActionState<AuthActionState, FormData>(
    mode === 'signin' ? signIn : signUp,
    { error: initialError },
  );

  return (
    <div className="space-y-6">
      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next} />
        <Button type="submit" variant="outline" className="w-full" size="lg">
          Continue with Google
        </Button>
      </form>

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="label-xs">or</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <form action={action} className="space-y-4">
        <input type="hidden" name="next" value={next} />

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            minLength={8}
            required
            placeholder="At least 8 characters"
          />
        </div>

        {state.error ? (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        ) : null}
        {state.notice ? (
          <p role="status" className="text-sm text-primary">
            {state.notice}
          </p>
        ) : null}

        <Button type="submit" className="w-full" size="lg" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          {mode === 'signin' ? 'Sign in' : 'Create account'}
        </Button>
      </form>

      <button
        type="button"
        onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
        className="w-full text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        {mode === 'signin' ? 'No account? Create one.' : 'Already have an account? Sign in.'}
      </button>
    </div>
  );
}
