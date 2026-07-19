import Link from "next/link";
import { Logo } from "@/components/logo";

export const metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-12">
      <Link href="/" className="flex items-center gap-2 text-lg font-bold text-primary">
        <Logo size={36} />
        Web3tribe University
      </Link>

      <div className="space-y-1">
        <h1 className="text-3xl font-bold">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground">Last updated: July 2026</p>
      </div>

      <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
        <p>
          This Privacy Policy explains what information Web3.0 Alliance Ltd (&quot;we,&quot; &quot;us&quot;)
          collects through Web3tribe University, how we use it, and the rights you have over it. We aim to
          handle personal data in line with Nigeria&apos;s Data Protection Act 2023 and the Nigeria Data
          Protection Regulation (NDPR).
        </p>

        <section>
          <h2>1. Information we collect</h2>
          <ul>
            <li><strong>Account information:</strong> full name, email, password (stored securely, never in plain text), role, and profile details you add such as bio, country, and state.</li>
            <li>
              <strong>Student biodata:</strong> for students, institutional information including date of birth,
              gender, nationality, state of origin, LGA, home address, next-of-kin details, and education/
              occupation background, collected once before your first course enrollment.
            </li>
            <li><strong>Learning activity:</strong> course enrollments, lesson and quiz progress, certificates earned, W3TR transaction history, and discussion posts.</li>
            <li><strong>Location:</strong> your state, used to show you hybrid or in-person cohorts happening near you. This is never required for fully online courses.</li>
            <li><strong>Technical data:</strong> device/browser information and usage logs, collected automatically for security and to improve the Platform.</li>
          </ul>
        </section>

        <section>
          <h2>2. How we use your information</h2>
          <ul>
            <li>To create and manage your account and deliver course content you&apos;ve enrolled in</li>
            <li>To track learning progress, issue certificates, and calculate W3TR rewards</li>
            <li>To show relevant hybrid/in-person cohorts based on your state</li>
            <li>To communicate with you about your account, courses, and platform updates</li>
            <li>To maintain institutional records that organizations, instructors, or (where applicable) regulatory bodies require</li>
            <li>To detect and prevent fraud, abuse, and violations of our Terms of Service</li>
          </ul>
        </section>

        <section>
          <h2>3. Who we share information with</h2>
          <p>
            Instructors and cohort leaders can see the name and relevant progress of students enrolled in their
            courses. Organizations can see the enrollment and completion status of learners they&apos;ve
            invited into their programs. We do not sell personal information to third parties. We may disclose
            information where required by Nigerian law or a valid legal process.
          </p>
        </section>

        <section>
          <h2>4. Data retention</h2>
          <p>
            We retain account and learning records for as long as your account is active, and for a reasonable
            period afterward for legitimate administrative, legal, or academic-record purposes (such as
            certificate verification continuing to work after you stop actively using the Platform).
          </p>
        </section>

        <section>
          <h2>5. Your rights</h2>
          <p>
            You can review and update most of your profile information, including your location, directly in
            Settings. You may request access to, correction of, or deletion of your personal data by contacting
            us, subject to our legitimate need to retain certain records (such as issued certificates and
            transaction history) for administrative and legal purposes.
          </p>
        </section>

        <section>
          <h2>6. Security</h2>
          <p>
            We use industry-standard measures — including encrypted storage and access controls enforced at the
            database level — to protect your information. No system is completely secure, and we encourage you
            to use a strong, unique password.
          </p>
        </section>

        <section>
          <h2>7. Children&apos;s privacy</h2>
          <p>
            Web3tribe University is intended for learners capable of providing informed consent under
            applicable Nigerian law. If you believe a minor has provided us personal data without appropriate
            consent, please contact us so we can address it.
          </p>
        </section>

        <section>
          <h2>8. Changes to this Policy</h2>
          <p>We may update this Privacy Policy from time to time. Material changes will be reflected by updating the date above.</p>
        </section>

        <section>
          <h2>9. Contact</h2>
          <p>Questions about this Policy or your data can be sent to Web3.0 Alliance Ltd through the Platform&apos;s support channels.</p>
        </section>
      </div>
    </main>
  );
}