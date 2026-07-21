/**
 * Transactional email sending via the Resend HTTP API.
 *
 * Uses the RESEND_API_KEY / EMAIL_FROM env vars that ENV_SETUP.md already
 * documents as placeholders for "additional transactional email you build
 * directly beyond what Supabase Auth sends natively" — this file is that.
 *
 * Degrades gracefully: if RESEND_API_KEY is missing, sends are logged and
 * skipped rather than throwing, so in-app notifications (which don't depend
 * on email at all) keep working and callers never crash a user flow because
 * email isn't configured yet.
 *
 * Server-only: never import this from a "use client" file.
 */

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailOptions): Promise<{ sent: boolean; error: string | null }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "Web3tribe University <onboarding@resend.dev>";

  if (!apiKey) {
    console.warn(`[email] RESEND_API_KEY not set — skipped sending "${subject}" to ${to}. In-app notification still delivered.`);
    return { sent: false, error: "Email provider not configured." };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[email] Failed to send "${subject}" to ${to}: ${res.status} ${body}`);
      return { sent: false, error: `Email provider returned ${res.status}.` };
    }
    return { sent: true, error: null };
  } catch (err) {
    console.error(`[email] Network error sending "${subject}" to ${to}:`, err);
    return { sent: false, error: "Network error sending email." };
  }
}

/**
 * Shared minimal HTML wrapper so every transactional email looks consistent
 * without pulling in a templating dependency.
 */
export function emailLayout(title: string, bodyHtml: string, ctaUrl?: string, ctaLabel?: string): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://web3tribe.university";
  return `
  <div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
    <h2 style="margin: 0 0 16px; font-size: 20px;">${title}</h2>
    <div style="font-size: 14px; line-height: 1.6; color: #333;">${bodyHtml}</div>
    ${
      ctaUrl
        ? `<p style="margin: 24px 0;"><a href="${ctaUrl}" style="display: inline-block; background: #16a34a; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 600;">${ctaLabel ?? "Open Web3tribe University"}</a></p>`
        : ""
    }
    <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />
    <p style="font-size: 12px; color: #888;">Sent by <a href="${siteUrl}" style="color: #16a34a;">Web3tribe University</a>. You received this because of activity on your account.</p>
  </div>`;
}
