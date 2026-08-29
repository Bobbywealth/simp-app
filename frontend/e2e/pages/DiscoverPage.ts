import { type Page, type Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export class DiscoverPage extends BasePage {
  readonly swipeRightButton: Locator;
  readonly swipeLeftButton: Locator;
  readonly reportButton: Locator;
  readonly profileCard: Locator;

  constructor(page: Page) {
    super(page, '/discover');
    this.swipeRightButton = page.locator('button[aria-label="Like"], button:has-text("♥"), button:has-text("Like")').first();
    this.swipeLeftButton = page.locator('button[aria-label="Pass"], button:has-text("✕"), button:has-text("Pass")').first();
    this.reportButton = page.locator('button[aria-label="Report"], button:has-text("Report")').first();
    this.profileCard = page.locator('[class*="card"], [class*="profile"]').first();
  }

  async swipeRight() {
    await this.swipeRightButton.click();
  }

  async swipeLeft() {
    await this.swipeLeftButton.click();
  }

  async clickReport() {
    await this.reportButton.click();
  }
}

export class MatchModal {
  readonly page: Page;
  readonly modal: Locator;
  readonly sendMessageButton: Locator;
  readonly keepSwipingButton: Locator;
  readonly viewMatchButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.modal = page.locator('[role="dialog"], [class*="modal"]').first();
    this.sendMessageButton = page.getByRole('button', { name: /send message/i });
    this.keepSwipingButton = page.getByRole('button', { name: /keep swiping/i });
    this.viewMatchButton = page.getByRole('button', { name: /view match/i });
  }

  async isVisible() {
    return this.modal.isVisible();
  }

  async clickSendMessage() {
    await this.sendMessageButton.click();
  }

  async clickViewMatch() {
    await this.viewMatchButton.click();
  }
}

export class MatchesPage extends BasePage {
  readonly matchItems: Locator;

  constructor(page: Page) {
    super(page, '/matches');
    this.matchItems = page.locator('[class*="match-item"], [class*="match_card"]');
  }

  async clickFirstMatch() {
    await this.matchItems.first().click();
  }
}

export class ReportModal {
  readonly page: Page;
  readonly modal: Locator;
  readonly reasonSelect: Locator;
  readonly descriptionInput: Locator;
  readonly submitButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.modal = page.locator('[role="dialog"], [class*="modal"]').first();
    this.reasonSelect = page.locator('select, [role="combobox"]').first();
    this.descriptionInput = page.locator('textarea, input[type="text"]').first();
    this.submitButton = page.getByRole('button', { name: /submit|report/i });
    this.cancelButton = page.getByRole('button', { name: /cancel/i });
  }

  async isVisible() {
    return this.modal.isVisible();
  }

  async selectReason(reason: string) {
    await this.reasonSelect.selectOption(reason);
  }

  async fillDescription(description: string) {
    await this.descriptionInput.fill(description);
  }

  async submit() {
    await this.submitButton.click();
  }
}