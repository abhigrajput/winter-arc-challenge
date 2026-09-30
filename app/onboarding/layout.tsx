import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Setup' };

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-8">
      <p className="label-xs">Winter Arc</p>
      <div className="flex-1 pt-6">{children}</div>
      <p className="pt-8 text-xs text-muted-foreground">
        General guidance, not medical advice.
      </p>
    </div>
  );
}
