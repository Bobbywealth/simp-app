import { type Page, type Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export class PremiumPage extends BasePage {
  readonly restorePurchasesButton: Locator;
  readonly subscribeButton: Locator;

  constructor(page: Page) {
    super(page, '/premium');
    this.restorePurchasesButton = page.getByRole('button', { name: /restore purchases/i });
    this.subscribeButton = page.getByRole('button', { name: /subscribe/i });
  }

  async clickRestorePurchases() {
    await this.restorePurchasesButton.click();
  }

  async clickSubscribe() {
    await this.subscribeButton.click();
  }
}