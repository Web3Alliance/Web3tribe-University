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
 * Shared HTML wrapper every transactional email is built from — this is the
 * one place to change to redesign every email at once, since all current
 * senders (opportunity/shortlist/invite emails) already funnel through it.
 *
 * Built with table-based layout and inline styles throughout, NOT the
 * flexbox/grid + <style> block approach normal web HTML uses. Email clients
 * are a much harsher rendering environment than browsers: Outlook (desktop)
 * uses Word's rendering engine and ignores most modern CSS, many clients
 * strip <style> tags entirely, and background-image/gradient tricks that
 * work fine on the web frequently don't render at all in an inbox. Tables
 * with inline styles are the actual, still-current standard for email HTML
 * because they're the one approach that degrades gracefully everywhere.
 */
export function emailLayout(title: string, bodyHtml: string, ctaUrl?: string, ctaLabel?: string): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.web3tribe.university";
  // Uses a dedicated, size-optimized copy (156x156px, ~42KB) rather than the
  // main app logo (1075x1075px, ~1.6MB) — displayed at only 52x52px here, so
  // the full-resolution file was making Gmail's image proxy fetch 39x more
  // data than the display size ever needed, a likely cause of the logo
  // failing to load on a recipient's first-ever email from this domain.
  const logoUrl = `${siteUrl}/logo-email.png`;

  const ctaBlock = ctaUrl
    ? `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 28px 0 4px;">
      <tr>
        <td style="border-radius: 8px; background-color: #0B5E3A;">
          <a href="${ctaUrl}" style="display: inline-block; padding: 12px 28px; font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; font-size: 14px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px;">
            ${ctaLabel ?? "Open Web3tribe University"}
          </a>
        </td>
      </tr>
    </table>`
    : "";

  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #F4F7F5; padding: 32px 16px;">
  <tr>
    <td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 12px; overflow: hidden; font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;">

        <!-- Header -->
        <tr>
          <td style="background-color: #083F27; padding: 28px 32px; text-align: center;">
            <img src="${logoUrl}" width="52" height="52" alt="Web3tribe University" style="display: block; margin: 0 auto 10px; border: 0;" />
            <div style="color: #ffffff; font-size: 14px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase;">Web3tribe University</div>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding: 32px;">
            <h1 style="margin: 0 0 16px; font-size: 20px; line-height: 1.3; color: #083F27; font-weight: 700;">${title}</h1>
            <div style="font-size: 14px; line-height: 1.65; color: #333333;">${bodyHtml}</div>
            ${ctaBlock}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background-color: #F4F7F5; padding: 20px 32px; text-align: center; border-top: 1px solid #E5E9E7;">
            <p style="margin: 0; font-size: 12px; color: #5A6472;">
              Sent by <a href="${siteUrl}" style="color: #0B5E3A; text-decoration: none; font-weight: 600;">Web3tribe University</a> \u2014 a Web3.0 Alliance Ltd platform.
            </p>
            <p style="margin: 8px 0 0; font-size: 11px; color: #9CA3AF;">
              You're receiving this because of activity related to your account.
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>`;
}
