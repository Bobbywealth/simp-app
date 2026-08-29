import { type Page, type Locator, expect } from '@playwright/test';

export class BasePage {
  readonly page: Page;
  readonly url: string;

  constructor(page: Page, url = '/') {
    this.page = page;
    this.url = url;
  }

  async goto(path = '') {
    await this.page.goto(`${this.url}${path}`);
  }

  async waitForLoadState(state: 'load' | 'domcontentloaded' | 'networkidle' = 'load') {
    await this.page.waitForLoadState(state);
  }

  async expectToBeVisible(selector: string | Locator) {
    const locator = typeof selector === 'string' ? this.page.locator(selector) : selector;
    await expect(locator).toBeVisible();
  }

  async expectToHaveURL(url: string | URL) {
    await expect(this.page).toHaveURL(url);
  }
}

export class NavHeader extends BasePage {
  get backButton() {
    return this.page.locator('[aria-label="Go back"], button:has-text("Back")').first();
  }

  get title() {
    return this.page.locator('h1').first();
  }
}

export class InputField {
  readonly locator: Locator;

  constructor(page: Page, label: string) {
    this.locator = page.getByRole('textbox', { name: new RegExp(label, 'i') });
  }

  async fill(value: string) {
    await this.locator.first().fill(value);
  }

  async getError() {
    const id = await this.locator.first().getAttribute('id');
    if (id) {
      return this.page.locator(`[aria-describedby="${id}"]`).textContent();
    }
    return null;
  }
}

export class Button {
  readonly locator: Locator;

  constructor(page: Page, text: string) {
    this.locator = page.getByRole('button', { name: text, exact: false });
  }

  async click() {
    await this.locator.click();
  }

  async isLoading() {
    return this.locator.isDisabled();
  }
}

export function generateTestEmail(): string {
  const timestamp = Date.now();
  return `testuser${timestamp}@simp-test.demo`;
}

export function generateTestPassword(): string {
  return `TestPass${Date.now()}!`;
}

export function generateDisplayName(): string {
  return `TestUser${Date.now()}`;
}