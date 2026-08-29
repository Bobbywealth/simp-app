import { test, expect } from '@playwright/test';
import { MessagesPage } from './pages';

test.describe('Messaging Flow', () => {
  test.use({ baseURL: 'http://localhost:5173' });

  test('should have messages page accessible', async ({ page }) => {
    const response = await page.goto('/messages');
    expect(response?.status()).toBe(200);
  });

  test('should display messages page structure when authenticated', async ({ page }) => {
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

    await page.route('**/messages/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.goto('/messages');
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await expect(page.locator('h1, h2, [class*="heading"], [class*="title"]').first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Conversation Flow', () => {
  test.use({ baseURL: 'http://localhost:5173' });

  test('should have conversation page accessible', async ({ page }) => {
    const response = await page.goto('/messages/1');
    expect(response?.status()).toBe(200);
  });

  test('should display message input when authenticated', async ({ page }) => {
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

    await page.route('**/messages/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.goto('/messages/1');
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    const messageInput = page.locator('input[type="text"], textarea').first();
    await expect(messageInput).toBeVisible({ timeout: 5000 });
  });
});
