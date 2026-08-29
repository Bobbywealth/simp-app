import { test, expect } from '@playwright/test';
import { MessagesPage } from './pages';

async function login(page: any) {
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
}

test.describe('Messaging Flow', () => {
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

    await page.route('**/api/messages/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await login(page);
  });

  test('should display messages page', async ({ page }) => {
    await page.goto('/messages');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/messages/);
  });

  test('should show conversation list or empty state', async ({ page }) => {
    await page.goto('/messages');
    await page.waitForLoadState('networkidle');
    const messagesPage = new MessagesPage(page);
    const hasConversations = await messagesPage.conversationList.count() > 0;
    const emptyState = await page.locator('text=/no messages|empty|start matching/i').isVisible();
    expect(hasConversations || emptyState).toBeTruthy();
  });

  test('should navigate to messages page from bottom nav', async ({ page }) => {
    const messagesNav = page.locator('nav a[href*="messages"], [aria-label*="messages"]').first();
    if (await messagesNav.isVisible()) {
      await messagesNav.click();
      await expect(page).toHaveURL(/\/messages/);
    }
  });
});

test.describe('Conversation (Mocked API)', () => {
  test.use({ baseURL: 'http://localhost:5173' });

  test('should display message input', async ({ page }) => {
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

    await page.route('**/api/messages/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await login(page);
    await page.goto('/messages/1');
    await page.waitForLoadState('networkidle');

    const messageInput = page.locator('input[type="text"], textarea').first();
    await expect(messageInput).toBeVisible({ timeout: 10000 });
  });

  test('should send a message', async ({ page }) => {
    let messageReceived = false;

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

    await page.route('**/api/messages/**', async (route) => {
      if (route.request().method() === 'POST') {
        messageReceived = true;
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'msg-1',
            content: route.request().postData(),
            senderId: 'user-1',
            createdAt: new Date().toISOString(),
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      }
    });

    await login(page);
    await page.goto('/messages/1');
    await page.waitForLoadState('networkidle');

    const messageInput = page.locator('input[type="text"], textarea').first();
    await messageInput.waitFor({ state: 'visible', timeout: 10000 });
    await messageInput.fill('Hello, this is a test message!');

    const sendButton = page.getByRole('button', { name: /send/i }).first();
    await sendButton.click();

    await expect.poll(async () => messageReceived, { timeout: 5000 }).toBe(true);
  });
});
