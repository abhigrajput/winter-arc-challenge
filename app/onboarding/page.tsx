import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/profile';
import { loadOnboardingState } from '@/lib/onboarding/state';

/** Sends the user to wherever they left off. */
export default async function OnboardingIndex() {
  const { userId } = await requireUser();
  const state = await loadOnboardingState(userId);

  if (!state) redirect('/login');
  if (state.profile.onboarded) redirect('/today');

  redirect(`/onboarding/${state.resume}`);
}
