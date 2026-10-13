import type { Metadata } from 'next';
import Link from 'next/link';
import { ContactLine, LegalPage, Section } from '@/components/legal/legal-page';

export const metadata: Metadata = {
  title: 'Terms',
  description: 'The rules for using Winter Arc: not medical advice, fair play on the leaderboard, and your responsibilities.',
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of use">
      <p>By creating an account you agree to these terms. They are short on purpose.</p>

      <Section title="Not medical advice">
        <p>
          Winter Arc gives general fitness, nutrition and skincare guidance, including AI-generated plans. It is not
          medical advice and does not replace a doctor, dietitian or dermatologist. Check with a professional before
          starting a new training or diet programme, especially with an injury or medical condition. Stop and seek help
          if something hurts. Body fat figures are estimates, accurate to a few points at best.
        </p>
      </Section>

      <Section title="Your account">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>You must be 13 or older.</li>
          <li>One account per person. Keep your password to yourself; you are responsible for activity on your account.</li>
          <li>Pick a username that is not offensive and does not impersonate someone else. We may change or remove one that is.</li>
        </ul>
      </Section>

      <Section title="Fair play">
        <p>The leaderboard ranks discipline. Do not:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>create multiple accounts or script requests to inflate points or streaks;</li>
          <li>probe, scrape or overload the service, or try to read anyone else&apos;s data;</li>
          <li>use the AI coach to generate anything harmful.</li>
        </ul>
        <p>We may remove leaderboard entries, reset points or close accounts that break these rules.</p>
      </Section>

      <Section title="Your content">
        <p>
          What you log and upload stays yours. You give us permission to store and process it only to run the app for
          you, as the <Link href="/privacy" className="text-primary underline-offset-4 hover:underline">privacy policy</Link> describes.
          Delete it any time from Settings.
        </p>
      </Section>

      <Section title="The service">
        <p>
          Winter Arc is provided as is, without warranties. It may change, pause or have outages, and features (the AI
          coach in particular) may be limited or removed. To the extent the law allows, we are not liable for indirect
          losses, or for decisions you make based on the app.
        </p>
      </Section>

      <Section title="Changes">
        <p>We may update these terms; the date at the top changes when we do. Continuing to use the app means you accept the update.</p>
        <ContactLine />
      </Section>
    </LegalPage>
  );
}
