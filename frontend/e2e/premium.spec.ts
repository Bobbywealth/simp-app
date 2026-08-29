import { test, expect } from '@playwright/test';
import { PremiumPage } from './pages';

test.describe('Premium Flow', () => {
  test.use({ baseURL: 'http://localhost:5173' });

  test('should have premium page accessible', async ({ page }) => {
    const response = await page.goto('/premium');
    expect(response?.status()).toBe(200);
  });

  test('should display premium page title when authenticated', async ({ page }) => {
    await page.route('**/auth/me', async (route) => {
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

    await page.goto('/premium');
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    const heading = page.locator('h1, h2, [class*="heading"], [class*="title"]').first();
    await expect(heading).toBeVisible({ timeout: 5000 });
  });
});
