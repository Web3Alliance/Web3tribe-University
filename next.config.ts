import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

// Security headers for every response. These used to live in netlify.toml, which Vercel ignores.
// The Content-Security-Policy ships in REPORT-ONLY mode first: the browser logs violations in its
// console but blocks nothing, so a missed third-party (video embed, payment frame, analytics) cannot
// break a page. Once the console is clean on the real site, rename the header to
// "Content-Security-Policy" to start enforcing it.
const isDev = process.env.NODE_ENV !== "production";
const supabaseHost = "https://*.supabase.co";
const csp = [
  "default-src 'self'",
  // Next.js injects small inline scripts; a nonce-based policy is a later tightening step.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://js.paystack.co https://checkout.paystack.com`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabaseHost} https://lh3.googleusercontent.com https://i.ytimg.com`,
  `media-src 'self' blob: ${supabaseHost}`,
  `connect-src 'self' ${supabaseHost} wss://*.supabase.co https://api.paystack.co https://checkout.paystack.com`,
  "font-src 'self' data:",
  "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com https://drive.google.com https://checkout.paystack.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "Content-Security-Policy-Report-Only", value: csp },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  images: {
    // Course thumbnails, avatars, and other user-uploaded images all live in
    // Supabase Storage. Without this, next/image rejects every one of them
    // outright (a deliberate security default), which is why course cards
    // were using a plain <img> tag instead — that meant no automatic lazy
    // loading, no responsive sizing, no modern-format conversion, and no
    // explicit dimensions to prevent layout shift, on the exact page that's
    // now public and crawlable.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "qoyynhydporrqodbwkbl.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default withNextIntl(nextConfig);