import { test, expect } from "@playwright/test";

// These tests only exercise publicly reachable pages that don't require a live
// Supabase session, so they can run against any deployed environment.

test.describe("Public pages", () => {
  test("landing page loads and shows the core value proposition", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /learn\. build\. earn\./i })).toBeVisible();
    await expect(page.getByRole("link", { name: /start learning free/i })).toBeVisible();
  });

  test("navigating to login from the landing page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Log in" }).first().click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
  });

  test("navigating to register from the landing page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Get started" }).first().click();
    await expect(page).toHaveURL(/\/register/);
    await expect(page.getByRole("heading", { name: /create your account/i })).toBeVisible();
  });

  test("registration form validates required fields", async ({ page }) => {
    await page.goto("/register");
    await page.getByRole("button", { name: /create account/i }).click();
    // Native HTML5 validation should block submission; full name field should
    // still be present/focused since the form did not navigate away.
    await expect(page).toHaveURL(/\/register/);
  });

  test("forgot password page is reachable from login", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: /forgot password/i }).click();
    await expect(page).toHaveURL(/\/forgot-password/);
  });
});
