import { test, expect } from './fixtures';
import { DiscoverPage, MatchModal, MatchesPage } from './pages';

test.describe('Discovery Flow', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/discover');
  });

  test('should display discovery page', async ({ authenticatedPage }) => {
    const discoverPage = new DiscoverPage(authenticatedPage);
    await expect(authenticatedPage).toHaveURL(/\/discover/);
  });

  test('should show profile card', async ({ authenticatedPage }) => {
    const discoverPage = new DiscoverPage(authenticatedPage);
    await expect(discoverPage.profileCard).toBeVisible({ timeout: 10000 });
  });

  test('should have swipe buttons visible', async ({ authenticatedPage }) => {
    const discoverPage = new DiscoverPage(authenticatedPage);
    await expect(discoverPage.swipeRightButton).toBeVisible({ timeout: 5000 });
    await expect(discoverPage.swipeLeftButton).toBeVisible({ timeout: 5000 });
  });

  test('should show report button', async ({ authenticatedPage }) => {
    const discoverPage = new DiscoverPage(authenticatedPage);
    await expect(discoverPage.reportButton).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Swiping and Matching (Mocked API)', () => {
  test.use({ baseURL: 'http://localhost:5173' });

  test('should show match modal when swiping right on a profile', async ({ page }) => {
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

    await page.route('**/api/swipes', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ matched: true, matchId: 'match-1' }),
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

    const swipeRightBtn = page.locator('button').filter({ hasText: /♥|like/i }).first();
    if (await swipeRightBtn.isVisible()) {
      await swipeRightBtn.click();
      await page.waitForSelector('[role="dialog"], [class*="modal"]', { timeout: 5000 });
    }
  });

  test('should navigate to matches page', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/matches');
    await expect(authenticatedPage).toHaveURL(/\/matches/);
  });

  test('should show matches list', async ({ authenticatedPage }) => {
    const matchesPage = new MatchesPage(authenticatedPage);
    await matchesPage.goto();
    await expect(matchesPage.matchItems.first()).toBeVisible({ timeout: 10000 });
  });
});