import type { Metadata } from 'next';
import { requireUser } from '@/lib/profile';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Today' };

export default async function TodayPage() {
  const { profile, email } = await requireUser();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="label-xs">Day 0 / 90</p>
        <h1 className="text-3xl font-semibold tracking-tight">
          {profile?.display_name ?? profile?.username ?? email ?? 'Athlete'}
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Not set up yet</CardTitle>
          <CardDescription>
            Onboarding lands in Phase 2 — profile, goal, modules, calorie and macro targets. The
            daily checklist, streak and points arrive in Phase 3.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="label-xs">Timezone</dt>
              <dd className="font-mono">{profile?.timezone ?? '—'}</dd>
            </div>
            <div>
              <dt className="label-xs">Start date</dt>
              <dd className="font-mono">{profile?.challenge_start ?? '—'}</dd>
            </div>
            <div>
              <dt className="label-xs">Goal</dt>
              <dd className="font-mono">{profile?.goal ?? '—'}</dd>
            </div>
            <div>
              <dt className="label-xs">Onboarding</dt>
              <dd className="font-mono">{profile?.onboarded ? 'done' : 'pending'}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
