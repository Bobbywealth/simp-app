import { type Page, type Locator } from '@playwright/test';
import { BasePage, InputField } from './BasePage';

export class LoginPage extends BasePage {
  readonly emailInput: InputField;
  readonly passwordInput: InputField;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;
  readonly signupLink: Locator;
  readonly forgotPasswordLink: Locator;

  constructor(page: Page) {
    super(page, '/login');
    this.emailInput = new InputField(page, 'email');
    this.passwordInput = new InputField(page, 'password');
    this.submitButton = page.getByRole('button', { name: /log in/i });
    this.errorMessage = page.locator('[role="alert"]');
    this.signupLink = page.getByRole('link', { name: /create an account/i });
    this.forgotPasswordLink = page.getByRole('link', { name: /forgot password/i });
  }

  async login(data: { email: string; password: string }) {
    await this.emailInput.fill(data.email);
    await this.passwordInput.fill(data.password);
    await this.submitButton.click();
  }
}

export class HomePage extends BasePage {
  constructor(page: Page) {
    super(page, '/home');
  }

  async isOnPage() {
    return this.page.url().includes('/home');
  }
}