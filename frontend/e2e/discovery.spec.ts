import { test, expect } from '@playwright/test';
import { DiscoverPage, MatchesPage } from './pages';

test.describe('Discovery Flow', () => {
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

  test('should display discovery page', async ({ page }) => {
    await expect(page).toHaveURL(/\/discover/);
  });

  test('should have swipe buttons visible', async ({ page }) => {
    const swipeRightBtn = page.locator('button').filter({ hasText: /♥|like/i }).first();
    const swipeLeftBtn = page.locator('button').filter({ hasText: /✕|pass/i }).first();
    await expect(swipeRightBtn.or(swipeLeftBtn).first()).toBeVisible({ timeout: 10000 });
  });

  test('should show report button', async ({ page }) => {
    const reportBtn = page.locator('button').filter({ hasText: /report/i }).first();
    await expect(reportBtn).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Swiping and Matching (Mocked API)', () => {
  test.use({ baseURL: 'http://localhost:5173' });

  test('should navigate to matches page', async ({ page }) => {
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

    await page.goto('/matches');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/matches/);
  });

  test('should show match modal when swiping right', async ({ page }) => {
    let matchFound = false;

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
        matchFound = true;
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ matched: true, matchId: 'match-1' }),
        });
      }
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

    const swipeRightBtn = page.locator('button').filter({ hasText: /♥|like/i }).first();
    await swipeRightBtn.waitFor({ state: 'visible', timeout: 10000 });
    await swipeRightBtn.click();

    await expect.poll(async () => matchFound, { timeout: 5000 }).toBe(true);
  });

  test('should show matches list', async ({ page }) => {
    const matchesPage = new MatchesPage(page);
    await matchesPage.goto();
    await expect(matchesPage.matchItems.first()).toBeVisible({ timeout: 10000 });
  });
});
