import { test, expect } from '@playwright/test';
import { DiscoverPage } from './pages';

test.describe('Report Flow', () => {
  test.use({ baseURL: 'http://localhost:5173' });

  test.beforeEach(async ({ page }) => {
    await page.route('**/api/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ token: 'mock-token' }),
      });
    });

    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'user-1',
          email: 'kenji@simp-seed.demo',
          emailVerified: true,
          profile: { id: 'profile-1', displayName: 'Kenji' },
          onboardingCompletedAt: new Date().toISOString(),
        }),
      });
    });

    await page.route('**/api/profiles/discover*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'profile-2',
            userId: 'user-2',
            displayName: 'Yuki',
            age: 25,
            photos: [],
            bio: 'Test bio',
          },
        ]),
      });
    });

    await page.route('**/api/users/preferences', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ minAge: 18, maxAge: 99 }),
      });
    });

    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    const emailInput = page.getByRole('textbox').filter({ hasText: /email/i }).first();
    const passwordInput = page.locator('input[type="password"]').first();
    await emailInput.waitFor({ state: 'visible', timeout: 10000 });
    await passwordInput.waitFor({ state: 'visible', timeout: 10000 });
    await emailInput.fill('kenji@simp-seed.demo');
    await passwordInput.fill('Demo123!');
    await page.getByRole('button', { name: /log in/i }).click();
    await page.waitForURL(/\/(home|profile-setup|verify-email|profile-edit)/, { timeout: 15000 });
    await page.waitForLoadState('networkidle');

    await page.goto('/discover');
    await page.waitForLoadState('networkidle');
  });

  test('should open report modal when clicking report button', async ({ page }) => {
    const discoverPage = new DiscoverPage(page);
    await discoverPage.profileCard.waitFor({ state: 'visible', timeout: 10000 });
    await discoverPage.reportButton.click();

    const dialog = page.locator('[role="dialog"], [class*="modal"]').first();
    await expect(dialog).toBeVisible({ timeout: 5000 });
  });

  test('should have report reasons in modal', async ({ page }) => {
    const discoverPage = new DiscoverPage(page);
    await discoverPage.profileCard.waitFor({ state: 'visible', timeout: 10000 });
    await discoverPage.reportButton.click();

    const dialog = page.locator('[role="dialog"], [class*="modal"]').first();
    await expect(dialog).toBeVisible({ timeout: 5000 });

    const reasonSelect = page.locator('select, [role="combobox"]').first();
    await expect(reasonSelect).toBeVisible();
  });

  test('should submit report successfully', async ({ page }) => {
    let reportSubmitted = false;

    await page.route('**/api/moderation/report*', async (route) => {
      if (route.request().method() === 'POST') {
        reportSubmitted = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      }
    });

    const discoverPage = new DiscoverPage(page);
    await discoverPage.profileCard.waitFor({ state: 'visible', timeout: 10000 });
    await discoverPage.reportButton.click();

    const dialog = page.locator('[role="dialog"], [class*="modal"]').first();
    await expect(dialog).toBeVisible({ timeout: 5000 });

    const submitButton = page.getByRole('button', { name: /submit|report/i }).first();
    await submitButton.waitFor({ state: 'visible', timeout: 5000 });
    await submitButton.click();

    await expect.poll(async () => reportSubmitted, { timeout: 5000 }).toBe(true);
  });
});
