import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.web3tribe.university";

/**
 * Previously no robots.txt existed at all. Dashboard routes are already
 * protected by auth (an unauthenticated crawler gets redirected to /login
 * rather than seeing real content), but explicitly disallowing them here is
 * still worth doing: it stops search engines from wasting crawl budget
 * repeatedly hitting redirect chains on pages that were never going to be
 * indexable anyway, and it's standard, expected practice rather than
 * relying only on the auth redirect as an implicit side effect.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/student/courses"],
      disallow: [
        "/api/",
        "/student/",
        "/instructor/",
        "/organization/",
        "/admin/",
        "/super-admin/",
        "/reset-password",
        "/verify/",
        "/verify-email",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
