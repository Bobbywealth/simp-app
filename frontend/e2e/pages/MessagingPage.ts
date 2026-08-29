import { type Page, type Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export class MessagesPage extends BasePage {
  readonly conversationList: Locator;

  constructor(page: Page) {
    super(page, '/messages');
    this.conversationList = page.locator('[class*="conversation"], [class*="message_item"]');
  }

  async clickFirstConversation() {
    await this.conversationList.first().click();
  }
}

export class ConversationPage extends BasePage {
  readonly messageInput: Locator;
  readonly sendButton: Locator;
  readonly messages: Locator;

  constructor(page: Page) {
    super(page);
    this.messageInput = page.locator('input[type="text"], textarea').first();
    this.sendButton = page.getByRole('button', { name: /send/i }).first();
    this.messages = page.locator('[class*="message"]');
  }

  async sendMessage(text: string) {
    await this.messageInput.fill(text);
    await this.sendButton.click();
  }

  async getLastMessage() {
    return this.messages.last().textContent();
  }
}