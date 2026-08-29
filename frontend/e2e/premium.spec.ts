import { test, expect } from '@playwright/test';
import { PremiumPage } from './pages';

async function login(page: any) {
  await page.goto('/login');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle');
  const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first();
  const passwordInput = page.locator('input[type="password"]').first();
  await emailInput.waitFor({ state: 'visible', timeout: 15000 });
  await passwordInput.waitFor({ state: 'visible', timeout: 10000 });
  await emailInput.fill('kenji@simp-seed.demo');
  await passwordInput.fill('Demo123!');
  await page.getByRole('button', { name: /log in/i }).click();
  await page.waitForURL(/\/(home|profile-setup|verify-email|profile-edit)/, { timeout: 15000 });
  await page.waitForLoadState('networkidle');
}

test.describe('Premium Flow', () => {
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

    await login(page);
  });

  test('should display premium page', async ({ page }) => {
    await page.goto('/premium');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/premium/);
  });

  test('should show subscription options', async ({ page }) => {
    await page.goto('/premium');
    await page.waitForLoadState('networkidle');
    const premiumPage = new PremiumPage(page);
    await expect(premiumPage.subscribeButton.or(premiumPage.restorePurchasesButton).first()).toBeVisible({ timeout: 10000 });
  });

  test('should click restore purchases button', async ({ page }) => {
    await page.route('**/api/billing/restore*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ restored: false }),
      });
    });

    await page.goto('/premium');
    await page.waitForLoadState('networkidle');
    const restoreButton = page.getByRole('button', { name: /restore purchases/i });
    await restoreButton.waitFor({ state: 'visible', timeout: 5000 });
    await restoreButton.click();
  });

  test('should navigate to premium page from settings', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    const premiumLink = page.getByRole('link', { name: /premium|upgrade/i }).first();
    await premiumLink.waitFor({ state: 'visible', timeout: 5000 });
    await premiumLink.click();
    await expect(page).toHaveURL(/\/premium/);
  });
});
