'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { StepState } from '@/app/onboarding/actions';

export interface StepFormRenderProps {
  fieldErrors: Record<string, string>;
}

/**
 * Shared shell for every onboarding step: pending state, error surface, back
 * link and submit button. Each step supplies only its own fields.
 */
export function StepForm({
  action,
  back,
  submitLabel = 'Continue',
  secondary,
  children,
}: {
  action: (prev: StepState, formData: FormData) => Promise<StepState>;
  back: string | null;
  submitLabel?: string;
  /** Extra controls under the main button, inside the form (e.g. a skip submit). */
  secondary?: (props: { pending: boolean }) => React.ReactNode;
  children: (props: StepFormRenderProps) => React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState<StepState, FormData>(action, {});

  return (
    <form action={formAction} className="space-y-6">
      {children({ fieldErrors: state.fieldErrors ?? {} })}

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center gap-3 pt-2">
        {back ? (
          <Button asChild variant="ghost" size="icon" aria-label="Back">
            <Link href={back}>
              <ArrowLeft />
            </Link>
          </Button>
        ) : null}
        <Button type="submit" size="lg" className="flex-1" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          {submitLabel}
        </Button>
      </div>

      {secondary ? secondary({ pending }) : null}
    </form>
  );
}
