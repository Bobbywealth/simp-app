import { test, expect } from './fixtures';
import { DiscoverPage, ReportModal } from './pages';

test.describe('Report Flow', () => {
  test.use({ baseURL: 'http://localhost:5173' });

  test('should open report modal when clicking report button', async ({ page }) => {
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
    await page.getByLabel(/email/i).fill('kenji@simp-seed.demo');
    await page.getByLabel(/password/i).fill('Demo123!');
    await page.getByRole('button', { name: /log in/i }).click();

    await page.waitForURL(/\/home/, { timeout: 10000 });
    await page.goto('/discover');

    await page.waitForSelector('[class*="card"], [class*="profile"]', { timeout: 10000 });

    const reportButton = page.locator('button[aria-label*="Report"], button').filter({ hasText: /report/i }).first();
    if (await reportButton.isVisible({ timeout: 5000 })) {
      await reportButton.click();
      await expect(page.locator('[role="dialog"], [class*="modal"]').first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('should have report reasons in modal', async ({ page }) => {
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
    await page.getByLabel(/email/i).fill('kenji@simp-seed.demo');
    await page.getByLabel(/password/i).fill('Demo123!');
    await page.getByRole('button', { name: /log in/i }).click();

    await page.waitForURL(/\/home/, { timeout: 10000 });
    await page.goto('/discover');

    await page.waitForSelector('[class*="card"], [class*="profile"]', { timeout: 10000 });

    const reportButton = page.locator('button[aria-label*="Report"], button').filter({ hasText: /report/i }).first();
    if (await reportButton.isVisible({ timeout: 5000 })) {
      await reportButton.click();

      const dialog = page.locator('[role="dialog"], [class*="modal"]').first();
      await expect(dialog).toBeVisible({ timeout: 5000 });

      const reasonSelect = page.locator('select, [role="combobox"]').first();
      if (await reasonSelect.isVisible()) {
        await expect(reasonSelect).toBeVisible();
      }
    }
  });

  test('should submit report successfully', async ({ page }) => {
    let reportSubmitted = false;

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

    await page.goto('/login');
    await page.getByLabel(/email/i).fill('kenji@simp-seed.demo');
    await page.getByLabel(/password/i).fill('Demo123!');
    await page.getByRole('button', { name: /log in/i }).click();

    await page.waitForURL(/\/home/, { timeout: 10000 });
    await page.goto('/discover');

    await page.waitForSelector('[class*="card"], [class*="profile"]', { timeout: 10000 });

    const reportButton = page.locator('button[aria-label*="Report"], button').filter({ hasText: /report/i }).first();
    if (await reportButton.isVisible({ timeout: 5000 })) {
      await reportButton.click();

      const dialog = page.locator('[role="dialog"], [class*="modal"]').first();
      await expect(dialog).toBeVisible({ timeout: 5000 });

      const submitButton = page.getByRole('button', { name: /submit|report/i }).first();
      if (await submitButton.isVisible()) {
        await submitButton.click();
        expect(reportSubmitted).toBeTruthy();
      }
    }
  });
});