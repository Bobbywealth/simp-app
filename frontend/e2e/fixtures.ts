import { test as base, type Page } from '@playwright/test';
import { expect } from '@playwright/test';

export interface TestUser {
  email: string;
  password: string;
  displayName: string;
}

const DEMO_USER = {
  email: 'kenji@simp-seed.demo',
  password: 'Demo123!',
};

export const test = base.extend<{
  authenticatedPage: Page;
  demoUser: TestUser;
}>({
  demoUser: DEMO_USER,

  authenticatedPage: async ({ page, demoUser }, use) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    const emailInput = page.getByRole('textbox').filter({ hasText: /email/i }).first();
    const passwordInput = page.getByRole('textbox', { name: /password/i });
    await emailInput.fill(demoUser.email);
    await passwordInput.fill(demoUser.password);
    await page.getByRole('button', { name: /log in/i }).click();
    await page.waitForURL(/\/(home|profile-setup|verify-email|profile-edit)/, { timeout: 15000 });
    await use(page);
  },
});

export { expect };