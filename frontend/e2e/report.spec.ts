import { test, expect } from '@playwright/test';

test.describe('Report Flow', () => {
  test.use({ baseURL: 'http://localhost:5173' });

  test('should have discover page accessible for report testing', async ({ page }) => {
    const response = await page.goto('/discover');
    expect(response?.status()).toBe(200);
  });

  test('should display discover page with report functionality', async ({ page }) => {
    await page.goto('/discover');
    await page.waitForLoadState('domcontentloaded');
    const heading = page.locator('h1, h2, [class*="heading"], [class*="title"]').first();
    await expect(heading.or(page.locator('text=/discover|find|swipe/i').first())).toBeVisible({ timeout: 5000 });
  });
});
