import { test, expect } from '@playwright/test';
import { DiscoverPage } from './pages';

test.describe('Report Flow', () => {
  test.use({ baseURL: 'http://localhost:5173' });

  test('should have discover page accessible for report testing', async ({ page }) => {
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
        }),
      });
    });

    await page.route('**/profiles/discover*', async (route) => {
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

    await page.goto('/discover');
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    const discoverPage = new DiscoverPage(page);
    await discoverPage.profileCard.waitFor({ state: 'visible', timeout: 5000 });
  });

  test('should show report button on profile', async ({ page }) => {
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
        }),
      });
    });

    await page.route('**/profiles/discover*', async (route) => {
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

    await page.goto('/discover');
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    const discoverPage = new DiscoverPage(page);
    await discoverPage.profileCard.waitFor({ state: 'visible', timeout: 5000 });
    await expect(discoverPage.reportButton).toBeVisible({ timeout: 3000 });
  });
});
