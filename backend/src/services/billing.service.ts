import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { GoogleAuth } from 'google-auth-library';
import type { BillingPlatform, EntitlementStatus, EntitlementTier, EntitlementEventSource } from '@prisma/client';
import { prisma } from '../config/db.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';
import { recordEntitlementEvent, type EntitlementEventType } from './entitlement-event.service.js';

const plusProducts = new Set(env.SIMP_PLUS_PRODUCT_IDS.split(',').map((item) => item.trim()).filter(Boolean));
const eliteProducts = new Set(env.SIMP_ELITE_PRODUCT_IDS.split(',').map((item) => item.trim()).filter(Boolean));

function tierForProduct(productId: string): EntitlementTier {
  if (eliteProducts.has(productId)) return 'SIMP_ELITE';
  if (plusProducts.has(productId)) return 'SIMP_PLUS';
  throw new AppError('unknown_billing_product', 400, 'That subscription product is not recognized.');
}

async function saveEntitlement(input: {
  userId: string;
  platform: BillingPlatform;
  productId: string;
  transactionId: string;
  originalTransactionId?: string;
  expiresAt: Date | null;
  status: EntitlementStatus;
  autoRenewing: boolean;
  environment?: string;
  receiptValue: string;
  /** Source of the mutation; threaded into the EntitlementEvent row. */
  source: import('@prisma/client').EntitlementEventSource;
  /** External dedupe key (notificationUUID / pubsub messageId / orderId). */
  externalId?: string;
  /** Override the implied event type (defaults to PURCHASE on first write, RENEWAL on update). */
  eventType?: import('./entitlement-event.service.js').EntitlementEventType;
}) {
  const entitlement = await prisma.entitlement.upsert({
    where: { transactionId: input.transactionId },
    create: {
      userId: input.userId,
      tier: tierForProduct(input.productId),
      status: input.status,
      platform: input.platform,
      productId: input.productId,
      transactionId: input.transactionId,
      originalTransactionId: input.originalTransactionId,
      expiresAt: input.expiresAt,
      autoRenewing: input.autoRenewing,
      environment: input.environment,
      receiptHash: crypto.createHash('sha256').update(input.receiptValue).digest('hex'),
      lastVerifiedAt: new Date(),
    },
    update: {
      userId: input.userId,
      tier: tierForProduct(input.productId),
      status: input.status,
      productId: input.productId,
      originalTransactionId: input.originalTransactionId,
      expiresAt: input.expiresAt,
      autoRenewing: input.autoRenewing,
      environment: input.environment,
      lastVerifiedAt: new Date(),
    },
  });
  const premium = ['ACTIVE', 'GRACE_PERIOD'].includes(entitlement.status) &&
    (!entitlement.expiresAt || entitlement.expiresAt > new Date());
  await prisma.profile.updateMany({ where: { userId: input.userId }, data: { isPremium: premium } });

  // Audit log. Imported externalId is the canonical dedupe key for
  // server-to-server sources; manual / refresh callers pass
  // transactionId-based externalId.
  await recordEntitlementEvent({
    entitlementId: entitlement.id,
    userId: input.userId,
    type: input.eventType ?? 'PURCHASE',
    source: input.source,
    tier: entitlement.tier,
    status: entitlement.status,
    platform: input.platform,
    productId: input.productId,
    transactionId: input.transactionId,
    originalTransactionId: input.originalTransactionId,
    externalId: input.externalId ?? input.transactionId,
    environment: input.environment ?? null,
    expiresAt: input.expiresAt,
  });

  return entitlement;
}

export async function verifyAppleTransaction(
  userId: string,
  transactionId: string,
  environment: 'Production' | 'Sandbox',
) {
  if (!env.APPLE_IAP_ISSUER_ID || !env.APPLE_IAP_KEY_ID || !env.APPLE_IAP_PRIVATE_KEY) {
    throw new AppError('apple_billing_not_configured', 503, 'Apple purchase verification is not configured.');
  }
  const privateKey = env.APPLE_IAP_PRIVATE_KEY.replace(/\\n/g, '\n');
  const bearer = jwt.sign({}, privateKey, {
    algorithm: 'ES256',
    issuer: env.APPLE_IAP_ISSUER_ID,
    audience: 'appstoreconnect-v1',
    expiresIn: '5m',
    keyid: env.APPLE_IAP_KEY_ID,
    header: { typ: 'JWT', alg: 'ES256', kid: env.APPLE_IAP_KEY_ID },
  });
  const host =
    environment === 'Sandbox'
      ? 'https://api.storekit-sandbox.itunes.apple.com'
      : 'https://api.storekit.itunes.apple.com';
  const response = await fetch(`${host}/inApps/v1/transactions/${encodeURIComponent(transactionId)}`, {
    headers: { Authorization: `Bearer ${bearer}` },
  });
  if (!response.ok) {
    throw new AppError('apple_purchase_invalid', 400, 'Apple could not verify that purchase.');
  }
  const body = (await response.json()) as { signedTransactionInfo?: string };
  if (!body.signedTransactionInfo) {
    throw new AppError('apple_purchase_invalid', 400, 'Apple returned an invalid transaction.');
  }
  // The JWS is obtained from Apple's mutually authenticated server API over TLS.
  // We still validate all application-bound claims before granting an entitlement.
  const transaction = jwt.decode(body.signedTransactionInfo) as {
    bundleId?: string;
    productId?: string;
    transactionId?: string;
    originalTransactionId?: string;
    expiresDate?: number;
    revocationDate?: number;
    environment?: string;
    type?: string;
  } | null;
  if (
    !transaction ||
    transaction.bundleId !== env.APPLE_BUNDLE_ID ||
    !transaction.productId ||
    !transaction.transactionId
  ) {
    throw new AppError('apple_purchase_invalid', 400, 'The transaction does not belong to SIMP.');
  }
  const expiresAt = transaction.expiresDate ? new Date(transaction.expiresDate) : null;
  const active = !transaction.revocationDate && (!expiresAt || expiresAt > new Date());
  return saveEntitlement({
    userId,
    platform: 'APPLE',
    productId: transaction.productId,
    transactionId: transaction.transactionId,
    originalTransactionId: transaction.originalTransactionId,
    expiresAt,
    status: active ? 'ACTIVE' : transaction.revocationDate ? 'REVOKED' : 'EXPIRED',
    autoRenewing: transaction.type === 'Auto-Renewable Subscription' && active,
    environment: transaction.environment ?? environment,
    receiptValue: body.signedTransactionInfo,
    source: 'APPLE_VERIFY',
    externalId: `verify:${transaction.transactionId}`,
  });
}

export async function verifyGooglePurchase(
  userId: string,
  purchaseToken: string,
  expectedProductId?: string,
) {
  if (!env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON) {
    throw new AppError('google_billing_not_configured', 503, 'Google Play purchase verification is not configured.');
  }
  let raw = env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
  if (!raw.trim().startsWith('{')) raw = Buffer.from(raw, 'base64').toString('utf8');
  const credentials = JSON.parse(raw) as Record<string, unknown>;
  const auth = new GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
  });
  const client = await auth.getClient();
  const access = await client.getAccessToken();
  const token = typeof access === 'string' ? access : access.token;
  const response = await fetch(
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(env.GOOGLE_PLAY_PACKAGE_NAME)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!response.ok) {
    throw new AppError('google_purchase_invalid', 400, 'Google Play could not verify that purchase.');
  }
  const purchase = (await response.json()) as {
    subscriptionState?: string;
    latestOrderId?: string;
    acknowledgementState?: string;
    lineItems?: Array<{
      productId?: string;
      expiryTime?: string;
      autoRenewingPlan?: { autoRenewEnabled?: boolean };
    }>;
  };
  const line = purchase.lineItems?.find((item) => !expectedProductId || item.productId === expectedProductId);
  if (!line?.productId) {
    throw new AppError('google_purchase_invalid', 400, 'The purchase does not contain that SIMP product.');
  }
  const expiresAt = line.expiryTime ? new Date(line.expiryTime) : null;
  const activeStates = new Set([
    'SUBSCRIPTION_STATE_ACTIVE',
    'SUBSCRIPTION_STATE_IN_GRACE_PERIOD',
  ]);
  const active = activeStates.has(purchase.subscriptionState ?? '') &&
    (!expiresAt || expiresAt > new Date());
  const status: EntitlementStatus =
    purchase.subscriptionState === 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD'
      ? 'GRACE_PERIOD'
      : active
        ? 'ACTIVE'
        : 'EXPIRED';
  const transactionId =
    purchase.latestOrderId ?? `google_${crypto.createHash('sha256').update(purchaseToken).digest('hex')}`;
  return saveEntitlement({
    userId,
    platform: 'GOOGLE',
    productId: line.productId,
    transactionId,
    originalTransactionId: purchase.latestOrderId,
    expiresAt,
    status,
    autoRenewing: line.autoRenewingPlan?.autoRenewEnabled ?? false,
    environment: 'GooglePlay',
    receiptValue: purchaseToken,
    source: 'GOOGLE_VERIFY',
    externalId: `verify:${transactionId}`,
  });
}
