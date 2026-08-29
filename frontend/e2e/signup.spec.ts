import { test, expect } from './fixtures';
import { SignupPage, VerifyEmailPendingPage, ProfileSetupPage, HomePage, generateTestEmail, generateTestPassword, generateDisplayName } from './pages';

test.describe('Signup Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/signup');
  });

  test('should display signup form with all required fields', async ({ page }) => {
    const signupPage = new SignupPage(page);

    await expect(signupPage.displayNameInput.locator).toBeVisible();
    await expect(signupPage.emailInput.locator).toBeVisible();
    await expect(signupPage.passwordInput.locator).toBeVisible();
    await expect(signupPage.submitButton).toBeVisible();
  });

  test('should navigate to login page when clicking login link', async ({ page }) => {
    const signupPage = new SignupPage(page);

    await signupPage.loginLink.click();
    await expect(page).toHaveURL('/login');
  });

  test('should show error for invalid email format', async ({ page }) => {
    const signupPage = new SignupPage(page);

    await signupPage.displayNameInput.fill('Test User');
    await signupPage.emailInput.fill('invalid-email');
    await signupPage.passwordInput.fill('TestPass123!');
    await signupPage.submitButton.click();

    await expect(page.locator('text=valid email')).toBeVisible({ timeout: 5000 });
  });

  test('should show error for weak password', async ({ page }) => {
    const signupPage = new SignupPage(page);

    await signupPage.displayNameInput.fill('Test User');
    await signupPage.emailInput.fill('test@example.com');
    await signupPage.passwordInput.fill('weak');
    await signupPage.submitButton.click();

    await expect(page.locator('text=10 characters')).toBeVisible({ timeout: 5000 });
  });

  test('should show password strength meter when typing password', async ({ page }) => {
    const signupPage = new SignupPage(page);

    await signupPage.passwordInput.fill('TestPass123!');
    await expect(page.locator('.text-emerald-300, .text-gold-300, .text-amber-300, .text-red-300').first()).toBeVisible({ timeout: 3000 });
  });
});

test.describe('Signup API Mock Tests', () => {
  test.use({ baseURL: 'http://localhost:5173' });

  test('should navigate to verify email page after signup with mocked API', async ({ page }) => {
    await page.route('**/auth/signup', async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'test-id', email: 'test@example.com' },
          accessToken: 'mock-token',
          refreshToken: 'mock-refresh',
        }),
      });
    });

    await page.route('**/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-id',
          email: 'test@example.com',
          emailVerified: false,
          profile: null,
          onboardingCompletedAt: null,
        }),
      });
    });

    await page.goto('/signup');
    await page.waitForLoadState('domcontentloaded');

    const email = generateTestEmail();
    const password = generateTestPassword();
    const displayName = generateDisplayName();

    const signupPage = new SignupPage(page);
    await signupPage.displayNameInput.locator.waitFor({ state: 'visible', timeout: 5000 });
    await signupPage.emailInput.locator.waitFor({ state: 'visible', timeout: 5000 });
    await signupPage.passwordInput.locator.waitFor({ state: 'visible', timeout: 5000 });
    await signupPage.fillSignupForm({ email, password, displayName });
    await signupPage.submit();

    await expect(page).toHaveURL(/\/verify-email-pending/, { timeout: 10000 });

    const pendingPage = new VerifyEmailPendingPage(page);
    await expect(pendingPage.heading).toBeVisible();
  });
});
