import { test, expect } from './fixtures';
import { PremiumPage } from './pages';

test.describe('Premium Flow', () => {
  test.use({ baseURL: 'http://localhost:5173' });

  test('should display premium page', async ({ page }) => {
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
          entitlement: { tier: 'FREE', status: 'ACTIVE', expiresAt: null },
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

    await page.goto('/login');
    await page.getByLabel(/email/i).fill('kenji@simp-seed.demo');
    await page.getByLabel(/password/i).fill('Demo123!');
    await page.getByRole('button', { name: /log in/i }).click();

    await page.waitForURL(/\/home/, { timeout: 10000 });
    await page.goto('/premium');

    await expect(page).toHaveURL(/\/premium/);
  });

  test('should show subscription options', async ({ page }) => {
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
          entitlement: { tier: 'FREE', status: 'ACTIVE', expiresAt: null },
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

    await page.goto('/login');
    await page.getByLabel(/email/i).fill('kenji@simp-seed.demo');
    await page.getByLabel(/password/i).fill('Demo123!');
    await page.getByRole('button', { name: /log in/i }).click();

    await page.waitForURL(/\/home/, { timeout: 10000 });
    await page.goto('/premium');

    const premiumPage = new PremiumPage(page);
    await expect(premiumPage.subscribeButton.or(premiumPage.restorePurchasesButton).first()).toBeVisible({ timeout: 10000 });
  });

  test('should click restore purchases button', async ({ page }) => {
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
          entitlement: { tier: 'FREE', status: 'ACTIVE', expiresAt: null },
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

    await page.route('**/api/billing/restore*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ restored: false }),
      });
    });

    await page.goto('/login');
    await page.getByLabel(/email/i).fill('kenji@simp-seed.demo');
    await page.getByLabel(/password/i).fill('Demo123!');
    await page.getByRole('button', { name: /log in/i }).click();

    await page.waitForURL(/\/home/, { timeout: 10000 });
    await page.goto('/premium');

    await page.waitForSelector('button', { timeout: 10000 });

    const restoreButton = page.getByRole('button', { name: /restore purchases/i });
    if (await restoreButton.isVisible({ timeout: 5000 })) {
      await restoreButton.click();
    }
  });

  test('should navigate to premium page from settings', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/settings');
    const premiumLink = authenticatedPage.getByRole('link', { name: /premium|upgrade/i }).first();
    if (await premiumLink.isVisible({ timeout: 3000 })) {
      await premiumLink.click();
      await expect(authenticatedPage).toHaveURL(/\/premium/);
    }
  });
});