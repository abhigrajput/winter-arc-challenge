import type { Metadata } from 'next';
import Link from 'next/link';
import { ContactLine, GrievanceOfficer, LegalPage, Section } from '@/components/legal/legal-page';

export const metadata: Metadata = {
  title: 'Privacy policy',
  description: 'What Winter Arc stores, who processes it, what is public, and how to export or delete it.',
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy">
      <p>
        Winter Arc is a 90-day habit and fitness tracker. This page says plainly what it stores, who else handles it,
        what anyone else can see, and how you take it with you or delete it.
      </p>

      <Section title="What we store">
        <ul className="list-disc space-y-1.5 pl-5">
          <li><strong className="text-foreground">Account:</strong> email, password (hashed by our auth provider, never readable by us), name, username.</li>
          <li><strong className="text-foreground">Profile:</strong> sex, age, height, weight, target weight, goal, training setup, diet type and notes, timezone, calorie and macro targets.</li>
          <li><strong className="text-foreground">What you log:</strong> daily tasks, workouts and sets, food, water, sleep, skin log, body measurements, check-ins, timers, posts, AI plans.</li>
          <li><strong className="text-foreground">Progress photos:</strong> in a private storage bucket, only ever shown to you through links that expire after 60 seconds.</li>
          <li><strong className="text-foreground">Notifications:</strong> your device&apos;s push subscription and your reminder times, if you turn reminders on.</li>
          <li><strong className="text-foreground">Abuse protection:</strong> a one-way hash of your IP address when you sign up (never the address itself), kept for at most a day to limit signups per network.</li>
        </ul>
        <p>No ads, no analytics trackers, no selling or sharing data for marketing. Cookies are used only to keep you signed in.</p>
      </Section>

      <Section title="Who processes it">
        <ul className="list-disc space-y-1.5 pl-5">
          <li><strong className="text-foreground">Supabase</strong> — database, sign-in and photo storage.</li>
          <li><strong className="text-foreground">Vercel</strong> — hosting. Keeps short-lived request logs.</li>
          <li>
            <strong className="text-foreground">DeepSeek</strong> — the AI coach. When you generate a plan, submit a weekly check-in or
            ask for a meal estimate, we send it: your profile metrics (sex, age, height, weight, goal, training setup, diet
            and targets), summaries of your recent logs, and any text you typed for that request (check-in and pain notes,
            workout notes, the meal description).
            <span className="mt-1 block">
              <strong className="text-foreground">Never sent to DeepSeek:</strong> photos, your username, your name, your email.
            </span>
          </li>
          <li><strong className="text-foreground">Push services</strong> (Google, Mozilla, Apple — whichever your browser uses) — deliver reminder notifications to your device.</li>
        </ul>
      </Section>

      <Section title="What is public">
        <p>
          If your profile is public (the default), anyone can see your username, display name, day count, streak, points,
          badges and completion heatmap — on the leaderboard and on your profile page. Nothing else. Weight, measurements,
          food, photos and every other body metric are never public and never ranked.
        </p>
        <p>Switch your profile to private any time in Settings; it then disappears from the leaderboard and your profile page.</p>
      </Section>

      <Section title="Your control">
        <ul className="list-disc space-y-1.5 pl-5">
          <li><strong className="text-foreground">Export:</strong> Settings → Export my data downloads everything as a JSON file.</li>
          <li>
            <strong className="text-foreground">Delete:</strong> Settings → Delete account permanently removes your account, every log and every progress
            photo, immediately. Copies may persist in our providers&apos; encrypted backups for a limited period before they
            expire.
          </li>
          <li><strong className="text-foreground">Correct:</strong> edit your profile, targets and logs in the app.</li>
        </ul>
      </Section>

      <Section title="Grievances (India)">
        <p>
          Under the Digital Personal Data Protection Act, 2023 you can ask for a summary of the data we hold about you,
          have it corrected or erased, nominate someone to exercise these rights for you, and raise a grievance about
          how it is handled. Export and deletion are instant in Settings; for anything else, write to the grievance
          officer.
        </p>
        <GrievanceOfficer />
        <p>
          If you are not satisfied with the response, you can complain to the Data Protection Board of India.
        </p>
      </Section>

      <Section title="Age">
        <p>Winter Arc is for people aged 13 and over. Under-18 accounts get conservative calorie targets and no supplement advice.</p>
      </Section>

      <Section title="Changes">
        <p>
          If this policy changes, the date at the top changes with it. Read the <Link href="/terms" className="text-primary underline-offset-4 hover:underline">terms</Link> too.
        </p>
        <ContactLine />
      </Section>
    </LegalPage>
  );
}
