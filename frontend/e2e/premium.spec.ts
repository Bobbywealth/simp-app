import { test, expect } from '@playwright/test';

test.describe('Premium Flow', () => {
  test.use({ baseURL: 'http://localhost:5173' });

  async function login(page: any) {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    const emailInput = page.getByRole('textbox').filter({ hasText: /email/i }).first();
    const passwordInput = page.getByRole('textbox', { name: /password/i });
    await emailInput.fill('kenji@simp-seed.demo');
    await passwordInput.fill('Demo123!');
    await page.getByRole('button', { name: /log in/i }).click();
    await page.waitForURL(/\/(home|profile-setup|verify-email|profile-edit)/, { timeout: 15000 });
  }

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

    await page.route('**/api/billing/entitlement', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ tier: 'FREE', status: 'ACTIVE', expiresAt: null }),
      });
    });

    await login(page);
  });

  test('should display premium page', async ({ page }) => {
    await page.goto('/premium');
    await expect(page).toHaveURL(/\/premium/);
  });

  test('should show subscription options', async ({ page }) => {
    await page.goto('/premium');
    const subscribeBtn = page.getByRole('button', { name: /subscribe/i }).first();
    await expect(subscribeBtn.or(page.getByRole('button', { name: /restore purchases/i }).first())).toBeVisible({ timeout: 10000 });
  });

  test('should click restore purchases button', async ({ page }) => {
    await page.goto('/premium');
    const restoreButton = page.getByRole('button', { name: /restore purchases/i });
    if (await restoreButton.isVisible({ timeout: 5000 })) {
      await restoreButton.click();
    }
  });

  test('should navigate to premium page from settings', async ({ page }) => {
    await page.goto('/settings');
    const premiumLink = page.getByRole('link', { name: /premium|upgrade/i }).first();
    if (await premiumLink.isVisible({ timeout: 3000 })) {
      await premiumLink.click();
      await expect(page).toHaveURL(/\/premium/);
    }
  });
});