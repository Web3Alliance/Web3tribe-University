import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/contexts/auth-context";
import { Toaster } from "@/components/ui/sonner";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.web3tribe.university";
const DEFAULT_TITLE = "Web3tribe University — Learn. Build. Earn.";
const DEFAULT_DESCRIPTION =
  "Web3tribe University empowers Nigerians with digital skills in AI, cybersecurity, data science, and more — rewarding learners, instructors, and contributors with W3TR as they learn, teach, and build.";

export const metadata: Metadata = {
  // Without this, relative Open Graph/Twitter image URLs below can't resolve
  // to an absolute URL — social platforms and crawlers need an absolute URL
  // to actually fetch the preview image, not a relative path.
  metadataBase: new URL(SITE_URL),
  title: {
    default: DEFAULT_TITLE,
    template: "%s | Web3tribe University",
  },
  description: DEFAULT_DESCRIPTION,
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  // Previously missing entirely — meant every link shared on WhatsApp,
  // Twitter/X, LinkedIn, etc. showed no preview card at all (just a bare
  // URL), which matters a lot in a market where WhatsApp sharing is a
  // primary discovery channel.
  openGraph: {
    type: "website",
    siteName: "Web3tribe University",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    url: SITE_URL,
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Web3tribe University — Learn. Build. Earn." }],
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: ["/og-image.png"],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#072B14" },
    { media: "(prefers-color-scheme: dark)", color: "#051f0e" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            <AuthProvider>
              {children}
              <Toaster position="top-right" richColors closeButton />
              <ServiceWorkerRegistration />
            </AuthProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}