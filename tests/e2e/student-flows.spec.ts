import { test, expect } from "@playwright/test";

/**
 * These tests require a real, seeded Supabase project and a pre-created test
 * student account, since they exercise authenticated flows. Set the following
 * environment variables before running:
 *
 *   E2E_STUDENT_EMAIL=student@example.com
 *   E2E_STUDENT_PASSWORD=your-test-password
 *
 * They are skipped automatically if those variables are not present, so that
 * `npm run test:e2e` does not fail in environments without a live backend
 * configured (such as a fresh clone of this repository).
 */

const email = process.env.E2E_STUDENT_EMAIL;
const password = process.env.E2E_STUDENT_PASSWORD;

test.describe("Authenticated student flows", () => {
  test.skip(!email || !password, "E2E_STUDENT_EMAIL / E2E_STUDENT_PASSWORD not configured");

  test("student can log in and reach the dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: /log in/i }).click();

    await expect(page).toHaveURL(/\/student\/dashboard/);
    await expect(page.getByText(/welcome back/i)).toBeVisible();
  });

  test("student can browse courses and view a course detail page", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: /log in/i }).click();
    await page.waitForURL(/\/student\/dashboard/);

    await page.goto("/student/courses");
    await expect(page.getByRole("heading", { name: /browse courses/i })).toBeVisible();

    const firstCourseLink = page.locator('a[href^="/student/courses/"]').first();
    if (await firstCourseLink.count()) {
      await firstCourseLink.click();
      await expect(page.getByRole("button", { name: /enroll now|continue learning/i })).toBeVisible();
    }
  });

  test("student can view their W3TR wallet", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: /log in/i }).click();
    await page.waitForURL(/\/student\/dashboard/);

    await page.goto("/student/wallet");
    await expect(page.getByText(/current balance/i)).toBeVisible();
  });
});
