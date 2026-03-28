import { Toaster } from "@/components/ui/sonner"
import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { AppWrapper } from "@/components/app-wrapper"
import { AuthProvider } from "@/contexts/auth-context"
import { TopBar } from "@/components/top-bar"
import { MobileNav } from "@/components/mobile-nav"
import { ToasterClient } from "@/components/toaster-client"
import "./globals.css"

export const metadata: Metadata = {
  title: "Made with App Studio",
  description: "Web3Tribe Uni - Learn and Earn",
  applicationName: "Web3Tribe University",
  authors: [
    { name: "Skiibiidarsh", url: "https://profiles.pinet.com/profiles/skiibiidarsh" }
  ],
  keywords: ["web3", "learning", "blockchain", "tokens", "education", "pi-network", "nft-certificates"],
  creator: "Skiibiidarsh",
  publisher: "Web3Alliance",
  metadataBase: new URL("https://www.tribe.theweb3alliance.org"),
  openGraph: {
    type: "website",
    url: "https://www.tribe.theweb3alliance.org",
    title: "Web3Tribe University - Learn & Earn",
    description: "A mobile-first learning management system that rewards users with W3TR tokens for completing educational modules.",
    siteName: "Web3Tribe University",
  },
  twitter: {
    card: "summary_large_image",
    title: "Web3Tribe University - Learn & Earn",
    description: "Learn Web3 and earn W3TR tokens",
    creator: "@Skiibiidarsh",
  },
    generator: 'v0.app'
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="application-name" content="Web3Tribe University" />
        <meta name="author" content="Skiibiidarsh" />
        <meta name="developer" content="Skiibiidarsh" />
        <meta name="developer-url" content="https://github.com/Skiibiidarsh" />
        <meta name="repository" content="https://github.com/Web3Alliance/Web3tribe-University" />
        <meta name="repository-url" content="https://github.com/Web3Alliance/Web3tribe-University.git" />
        <meta name="homepage" content="https://www.tribe.theweb3alliance.org/" />
        <meta name="website" content="https://www.tribe.theweb3alliance.org/" />
        <meta property="og:site_name" content="Web3Tribe University" />
        <meta property="og:url" content="https://www.tribe.theweb3alliance.org/" />
        <meta name="twitter:site" content="@Skiibiidarsh" />
        <link rel="canonical" href="https://www.tribe.theweb3alliance.org/" />
        <link rel="manifest" href="/manifest.json" />
        <style>{`
html {
  font-family: ${GeistSans.style.fontFamily};
  --font-sans: ${GeistSans.variable};
  --font-mono: ${GeistMono.variable};
}
        `}</style>
      </head>
      <body>
        <AppWrapper>
          <AuthProvider>
            <TopBar />
            {children}
            <MobileNav />
            <ToasterClient />
          </AuthProvider>
        </AppWrapper>
      </body>
    </html>
  )
}