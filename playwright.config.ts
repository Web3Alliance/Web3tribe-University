import { defineConfig, devices } from "@playwright/test";

/**
 * E2E test configuration. These tests require a running dev server AND a real
 * Supabase project with the schema/migrations applied (see supabase/migrations
 * and docs/DEPLOYMENT_GUIDE.md) — they are not run as part of this project's
 * automated build validation, since no live Supabase instance is available in
 * a fresh clone until you configure your own .env.local.
 *
 * Run locally with: npm run test:e2e
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
