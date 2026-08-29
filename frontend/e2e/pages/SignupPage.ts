import { type Page, type Locator } from '@playwright/test';
import { BasePage, InputField, Button } from './BasePage';

export class SignupPage extends BasePage {
  readonly emailInput: InputField;
  readonly passwordInput: InputField;
  readonly displayNameInput: InputField;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;
  readonly loginLink: Locator;

  constructor(page: Page) {
    super(page, '/signup');
    this.emailInput = new InputField(page, 'email');
    this.passwordInput = new InputField(page, 'password');
    this.displayNameInput = new InputField(page, 'display name');
    this.submitButton = page.getByRole('button', { name: /create (my )?account/i });
    this.errorMessage = page.locator('[role="alert"]');
    this.loginLink = page.getByRole('link', { name: /log in/i });
  }

  async fillSignupForm(data: { email: string; password: string; displayName: string }) {
    await this.displayNameInput.fill(data.displayName);
    await this.emailInput.fill(data.email);
    await this.passwordInput.fill(data.password);
  }

  async submit() {
    await this.submitButton.click();
  }
}

export class VerifyEmailPendingPage extends BasePage {
  readonly heading: Locator;

  constructor(page: Page) {
    super(page, '/verify-email-pending');
    this.heading = page.locator('h1');
  }
}

export class ProfileSetupPage extends BasePage {
  readonly continueButton: Locator;

  constructor(page: Page) {
    super(page, '/profile-setup');
    this.continueButton = page.getByRole('button', { name: /continue/i });
  }
}

export class HomePage extends BasePage {
  readonly heading: Locator;

  constructor(page: Page) {
    super(page, '/home');
    this.heading = page.locator('h1');
  }
}