import Link from "next/link";
import { Logo } from "@/components/logo";

export const metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-12">
      <Link href="/" className="flex items-center gap-2 text-lg font-bold text-primary">
        <Logo size={36} />
        Web3tribe University
      </Link>

      <div className="space-y-1">
        <h1 className="text-3xl font-bold">Terms of Service</h1>
        <p className="text-sm text-muted-foreground">Last updated: July 2026</p>
      </div>

      <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
        <p>
          These Terms of Service (&quot;Terms&quot;) govern your access to and use of Web3tribe University, a
          platform operated by Web3.0 Alliance Ltd (RC: 7919874), a company registered in Nigeria (&quot;we,&quot;
          &quot;us,&quot; or &quot;the Platform&quot;). By creating an account, you agree to these Terms.
        </p>

        <section>
          <h2>1. Eligibility and accounts</h2>
          <p>
            You must provide accurate information when creating an account, including the institutional biodata
            required for students. You&apos;re responsible for keeping your login credentials confidential and
            for all activity under your account. We may suspend or terminate accounts that provide false
            information, violate these Terms, or are used for fraudulent or abusive purposes.
          </p>
        </section>

        <section>
          <h2>2. Courses, cohorts, and enrollment</h2>
          <p>
            Students may enroll in one course at a time, whether directly or through a cohort. A course&apos;s
            delivery mode (online, hybrid, or in-person) is set by its original author and applies to every
            cohort taught from it. Once a cohort&apos;s start date has passed, it stops accepting new
            enrollments. Instructors may start a cohort to teach an existing, published course even if they did
            not originally author it.
          </p>
          <p>
            We do not currently verify professional accreditation for instructors starting cohorts. This is a
            temporary arrangement during the Platform&apos;s testing phase and may change without prior notice
            as verification requirements are introduced for regulated subject areas.
          </p>
        </section>

        <section>
          <h2>3. W3TR rewards and purchases</h2>
          <p>
            W3TR is an in-platform reward point awarded for completing lessons, passing quizzes and exams, and
            other learning activities, at fixed amounts set by the Platform. Students can also purchase W3TR
            directly with real money (via Paystack) as a top-up option, most commonly to afford a premium course
            they don&apos;t yet have enough W3TR for.
          </p>
          <p>
            <strong>
              W3TR is an in-app token economy, useful only on the Web3tribe University platform for now. It is
              not a security, cryptocurrency, or tradable asset, and cannot be exchanged, transferred, or
              redeemed for cash outside the Platform.
            </strong>{" "}
            If Web3.0 Alliance Ltd decides in the future to make W3TR tradable or transferable, or to deploy it
            on a blockchain, all necessary compliance certifications and regulatory requirements will be met
            first. W3TR balances, reward amounts, purchase pricing, and the activities that earn them may be
            changed at any time. Dropping a course does not remove W3TR you have already earned or purchased.
          </p>
        </section>

        <section>
          <h2>4. Certificates</h2>
          <p>
            Certificates are issued on completing a course&apos;s lessons and, where a course has one, passing
            its final exam. Certificates are verifiable through a public code but do not constitute an
            accredited academic qualification unless separately stated by the issuing instructor or institution.
          </p>
        </section>

        <section>
          <h2>5. Content and intellectual property</h2>
          <p>
            Course content belongs to the instructor who created it. By publishing a course, an instructor
            grants the Platform a license to host, display, and deliver that content to enrolled students. You
            may not copy, redistribute, or resell course content without the instructor&apos;s permission.
          </p>
        </section>

        <section>
          <h2>6. Acceptable use</h2>
          <p>
            You agree not to: misrepresent your identity or credentials; share your account with others;
            harass, threaten, or abuse other users in discussions; upload content that infringes on others&apos;
            rights or violates applicable law; or attempt to circumvent platform restrictions, including the
            one-course-at-a-time enrollment rule or cohort enrollment deadlines.
          </p>
        </section>

        <section>
          <h2>7. Organizations</h2>
          <p>
            Organizations may invite learners and bundle courses into programs. Assigning a learner to a program
            enrolls them in that program&apos;s courses on their behalf; organizations are responsible for
            obtaining any necessary consent from the learners they invite.
          </p>
        </section>

        <section>
          <h2>8. Termination</h2>
          <p>
            You may stop using the Platform at any time. We may suspend or terminate access for violation of
            these Terms, at our discretion, with or without notice depending on severity.
          </p>
        </section>

        <section>
          <h2>9. Disclaimers and limitation of liability</h2>
          <p>
            The Platform is provided &quot;as is&quot; without warranties of any kind. To the fullest extent
            permitted by Nigerian law, Web3.0 Alliance Ltd is not liable for indirect, incidental, or
            consequential damages arising from your use of the Platform.
          </p>
        </section>

        <section>
          <h2>10. Changes to these Terms</h2>
          <p>
            We may update these Terms from time to time. Continued use of the Platform after changes take effect
            constitutes acceptance of the revised Terms.
          </p>
        </section>

        <section>
          <h2>11. Governing law</h2>
          <p>These Terms are governed by the laws of the Federal Republic of Nigeria.</p>
        </section>

        <section>
          <h2>12. Contact</h2>
          <p>Questions about these Terms can be sent to Web3.0 Alliance Ltd through the Platform&apos;s support channels.</p>
        </section>
      </div>
    </main>
  );
}