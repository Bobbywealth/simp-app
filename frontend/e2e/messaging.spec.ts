import { test, expect } from '@playwright/test';
import { MessagesPage } from './pages';

test.describe('Messaging Flow', () => {
  test.use({ baseURL: 'http://localhost:5173' });

  test('should have messages page accessible', async ({ page }) => {
    const response = await page.goto('/messages');
    expect(response?.status()).toBe(200);
  });

  test('should display messages page structure', async ({ page }) => {
    await page.goto('/messages');
    await page.waitForLoadState('domcontentloaded');
    const heading = page.locator('h1, h2, [class*="heading"], [class*="title"]').first();
    await expect(heading.or(page.locator('text=/messages?|inbox/i').first())).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Conversation Flow', () => {
  test.use({ baseURL: 'http://localhost:5173' });

  test('should have conversation page accessible', async ({ page }) => {
    const response = await page.goto('/messages/1');
    expect(response?.status()).toBe(200);
  });
});
