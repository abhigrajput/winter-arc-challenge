import { notFound, redirect } from 'next/navigation';
import { requireUser } from '@/lib/profile';
import { loadOnboardingState, canEnter } from '@/lib/onboarding/state';
import {
  STEP_TITLES,
  isStep,
  previousStep,
  type Step,
} from '@/lib/onboarding/schema';
import { stepNumber, TOTAL_STEPS } from '@/lib/onboarding/progress';
import {
  BaselineStep,
  BodyStep,
  DietStep,
  GoalStep,
  IdentityStep,
  ModulesStep,
  RoutineStep,
  ScheduleStep,
  TrainingStep,
} from '@/components/onboarding/steps';
import { ResultStep } from '@/components/onboarding/result';

export default async function OnboardingStepPage({
  params,
}: {
  params: Promise<{ step: string }>;
}) {
  const { step: raw } = await params;
  if (!isStep(raw)) notFound();
  const step: Step = raw;

  const { userId } = await requireUser();
  const state = await loadOnboardingState(userId);
  if (!state) redirect('/login');

  if (state.profile.onboarded && step !== 'result') redirect('/today');

  // No skipping ahead: bounce back to the furthest step actually reached.
  if (!canEnter(step, state)) redirect(`/onboarding/${state.resume}`);

  const prev = previousStep(step);
  const back = prev ? `/onboarding/${prev}` : null;

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">{STEP_TITLES[step]}</h1>
          <span className="font-mono text-xs text-muted-foreground">
            {stepNumber(step)}/{TOTAL_STEPS}
          </span>
        </div>
        <div
          className="h-1 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={stepNumber(step)}
          aria-valuemin={1}
          aria-valuemax={TOTAL_STEPS}
          aria-label="Setup progress"
        >
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${(stepNumber(step) / TOTAL_STEPS) * 100}%` }}
          />
        </div>
      </header>

      {step === 'identity' ? <IdentityStep profile={state.profile} back={back} /> : null}
      {step === 'body' ? <BodyStep profile={state.profile} back={back} /> : null}
      {step === 'goal' ? <GoalStep profile={state.profile} back={back} /> : null}
      {step === 'modules' ? <ModulesStep profile={state.profile} back={back} /> : null}
      {step === 'training' ? <TrainingStep profile={state.profile} back={back} /> : null}
      {step === 'schedule' ? <ScheduleStep profile={state.profile} back={back} /> : null}
      {step === 'diet' ? <DietStep profile={state.profile} back={back} /> : null}
      {step === 'routine' ? <RoutineStep profile={state.profile} back={back} /> : null}
      {step === 'baseline' ? (
        <BaselineStep profile={state.profile} back={back} baseline={state.baseline} />
      ) : null}
      {step === 'result' ? (
        <ResultStep profile={state.profile} baseline={state.baseline} back={back} />
      ) : null}
    </div>
  );
}
