import { test, expect } from './fixtures';
import { MessagesPage, ConversationPage } from './pages';

test.describe('Messaging Flow', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/messages');
  });

  test('should display messages page', async ({ authenticatedPage }) => {
    await expect(authenticatedPage).toHaveURL(/\/messages/);
  });

  test('should show conversation list or empty state', async ({ authenticatedPage }) => {
    const messagesPage = new MessagesPage(authenticatedPage);
    const hasConversations = await messagesPage.conversationList.count() > 0;
    const emptyState = await authenticatedPage.locator('text=/no messages|empty|start matching/i').isVisible();

    expect(hasConversations || emptyState).toBeTruthy();
  });

  test('should navigate to messages page from bottom nav', async ({ authenticatedPage }) => {
    const messagesNav = authenticatedPage.locator('nav a[href*="messages"], [aria-label*="messages"]').first();
    if (await messagesNav.isVisible()) {
      await messagesNav.click();
      await expect(authenticatedPage).toHaveURL(/\/messages/);
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

    await page.goto('/login');
    await page.getByLabel(/email/i).fill('kenji@simp-seed.demo');
    await page.getByLabel(/password/i).fill('Demo123!');
    await page.getByRole('button', { name: /log in/i }).click();

    await page.waitForURL(/\/home/, { timeout: 10000 });
    await page.goto('/messages/1');

    const messageInput = page.locator('input[type="text"], textarea').first();
    await expect(messageInput).toBeVisible({ timeout: 5000 });
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

    await page.goto('/login');
    await page.getByLabel(/email/i).fill('kenji@simp-seed.demo');
    await page.getByLabel(/password/i).fill('Demo123!');
    await page.getByRole('button', { name: /log in/i }).click();

    await page.waitForURL(/\/home/, { timeout: 10000 });
    await page.goto('/messages/1');

    const messageInput = page.locator('input[type="text"], textarea').first();
    await messageInput.waitFor({ state: 'visible', timeout: 5000 });
    await messageInput.fill('Hello, this is a test message!');

    const sendButton = page.getByRole('button', { name: /send/i }).first();
    await sendButton.click();

    expect(messageReceived).toBeTruthy();
  });
});