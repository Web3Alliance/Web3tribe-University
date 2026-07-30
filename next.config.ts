import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
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