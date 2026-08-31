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
  authedPage: Page;
  demoUser: TestUser;
}>({
  demoUser: DEMO_USER,

  authedPage: async ({ page, demoUser }, use) => { // eslint-disable-line react-hooks/rules-of-hooks
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    const emailInput = page.locator('input[name="email"], input[type="email"]').first();
    await emailInput.waitFor({ state: 'visible', timeout: 10000 });
    const passwordInput = page.locator('input[name="password"], input[type="password"]').first();
    await passwordInput.waitFor({ state: 'visible', timeout: 10000 });
    await emailInput.fill(demoUser.email);
    await passwordInput.fill(demoUser.password);
    await page.getByRole('button', { name: /log in/i }).click();
    await page.waitForURL(/\/(home|profile-setup|verify-email|profile-edit)/, { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    await use(page);
  },
});

export { expect };
