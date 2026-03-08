/**
 * Web3Tribe University - App Metadata
 * 
 * This file contains public metadata about the application that can be
 * accessed by ecosystem platforms and external services.
 */

export const APP_METADATA = {
  name: "Web3Tribe University",
  shortName: "W3T Uni",
  description: "Learn & Earn with W3TR tokens - A Web3 education platform by Web3Alliance",
  version: "1.0.0",
  
  // Developer Information
  developer: {
    name: "Skiibiidarsh",
    github: "https://github.com/Skiibiidarsh",
    username: "@Skiibiidarsh",
    profile: "https://profiles.pinet.com/profiles/skiibiidarsh",
  },
  
  // Organization
  organization: {
    name: "Web3Alliance",
    website: "https://www.tribe.theweb3alliance.org/",
  },
  
  // Repository Information
  repository: {
    type: "git" as const,
    url: "https://github.com/Web3Alliance/Web3tribe-University.git",
    issues: "https://github.com/Web3Alliance/Web3tribe-University/issues",
  },
  
  // Contact & Support
  links: {
    website: "https://www.tribe.theweb3alliance.org/",
    github: "https://github.com/Web3Alliance/Web3tribe-University",
    issues: "https://github.com/Web3Alliance/Web3tribe-University/issues",
  },
  
  // App Features
  features: [
    "Learn Web3 and earn W3TR tokens",
    "1 W3TR token per module completed",
    "NFT certificates on Pi Blockchain",
    "Classroom forum for students",
    "Tutor dashboard for course creation",
    "Token swap with Pi Network",
    "Fiat payment integration",
  ],
  
  // Token Economics
  tokenomics: {
    symbol: "W3TR",
    name: "Web3Tribe Token",
    totalSupply: 1_000_000_000,
    distribution: {
      learning: 0.60, // 60% for learners and tutors
      team: 0.20,     // 20% for team
      investors: 0.10, // 10% for investors
      charity: 0.05,   // 5% for charity
      research: 0.05,  // 5% for R&D
    },
  },
  
  // Categories
  categories: ["education", "blockchain", "web3", "defi", "learning"],
  
  // Keywords for discovery
  keywords: [
    "web3",
    "learning",
    "blockchain",
    "tokens",
    "education",
    "pi-network",
    "nft-certificates",
    "earn-to-learn",
    "crypto-education",
  ],
} as const

export type AppMetadata = typeof APP_METADATA
