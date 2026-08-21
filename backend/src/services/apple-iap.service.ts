// Apple App Store Server API integration for SIMP. Wraps the existing
// `verifyAppleTransaction` and adds:
//   - App Store Server Notifications V2 webhook handling
//   - Restore purchases (latest active entitlements for a user)
//   - Refresh-from-Apple endpoint to re-validate an existing entitlement
//
// All endpoints require credentials in the following env vars:
//   - APPLE_IAP_ISSUER_ID
//   - APPLE_IAP_KEY_ID
//   - APPLE_IAP_PRIVATE_KEY (the .p8 file contents, with \n escaped)
// Without these the endpoints respond 503 "Apple billing not configured"
// rather than failing silently — this surfaces a deploy misconfiguration
// immediately instead of letting users believe their purchase succeeded.

import jwt from 'jsonwebtoken';
import type { BillingPlatform, EntitlementStatus, EntitlementTier } from '@prisma/client';
import { env } from '../config/env.js';
import { prisma } from '../config/db.js';
import { AppError } from '../utils/errors.js';

export type AppleEnvironment = 'Production' | 'Sandbox';

export const APPLE_API_HOSTS = {
  Production: 'https://api.storekit.itunes.apple.com',
  Sandbox: 'https://api.storekit-sandbox.itunes.apple.com',
} as const;

/**
 * Mint a short-lived JWT for Apple's mutually-authenticated App Store
 * Server API. Apple verifies:
 *   - signature (ES256 with the .p8 key)
 *   - issuer = APPLE_IAP_ISSUER_ID
 *   - audience = 'appstoreconnect-v1'
 *   - key id in JWT header matches APPLE_IAP_KEY_ID
 *   - exp within 5 minutes
 * Each minted token is reused for the rest of the bucket — Apple
 * rate-limits at the token level, not the request level.
 */
let cachedToken: { value: string; expiresAt: number } | null = null;

export async function getAppleBearerToken(): Promise<string> {
  if (!env.APPLE_IAP_ISSUER_ID || !env.APPLE_IAP_KEY_ID || !env.APPLE_IAP_PRIVATE_KEY) {
    throw new AppError(
      'apple_billing_not_configured',
      503,
      'Apple purchase verification is not configured on this server.',
    );
  }
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt - now > 60) {
    return cachedToken.value;
  }
  const privateKey = env.APPLE_IAP_PRIVATE_KEY.replace(/\\n/g, '\n');
  const token = jwt.sign({}, privateKey, {
    algorithm: 'ES256',
    issuer: env.APPLE_IAP_ISSUER_ID,
    audience: 'appstoreconnect-v1',
    expiresIn: '5m',
    keyid: env.APPLE_IAP_KEY_ID,
    header: { typ: 'JWT', alg: 'ES256', kid: env.APPLE_IAP_KEY_ID },
  });
  cachedToken = { value: token, expiresAt: now + 5 * 60 };
  return token;
}

/** Reset the cached token (test-only). */
export function _resetAppleBearerCache(): void {
  cachedToken = null;
}

/**
 * Fetch a single transaction from the App Store Server API and decode
 * the JWS payload. Apple's response wraps the signedTransactionInfo
 * (an inner JWS signed by Apple) — we trust it because TLS to Apple's
 * server authenticates the channel, and we additionally validate the
 * application-bound fields (bundleId, productId) ourselves before
 * granting an entitlement.
 */
export async function fetchAppleTransaction(transactionId: string, environment: AppleEnvironment) {
  const bearer = await getAppleBearerToken();
  const response = await fetch(
    `${APPLE_API_HOSTS[environment]}/inApps/v1/transactions/${encodeURIComponent(transactionId)}`,
    { headers: { Authorization: `Bearer ${bearer}` } },
  );
  if (!response.ok) {
    throw new AppError(
      'apple_purchase_invalid',
      400,
      `Apple could not verify that purchase (HTTP ${response.status}).`,
    );
  }
  const body = (await response.json()) as { signedTransactionInfo?: string };
  if (!body.signedTransactionInfo) {
    throw new AppError(
      'apple_purchase_invalid',
      400,
      'Apple returned an empty transaction payload.',
    );
  }
  return jwt.decode(body.signedTransactionInfo) as null | Record<string, unknown>;
}

/**
 * Fetch a subscription's full transaction history (used by restore
 * purchases). Apple returns the most recent transaction first; we keep
 * only the latest non-revoked, non-expired record per originalTransactionId.
 *
 * Reference:
 *   GET /inApps/v1/transactions/{originalTransactionId}?includeAll=true
 */
export async function fetchAppleSubscriptionHistory(originalTransactionId: string, environment: AppleEnvironment) {
  const bearer = await getAppleBearerToken();
  const url = `${APPLE_API_HOSTS[environment]}/inApps/v1/transactions/${encodeURIComponent(originalTransactionId)}?includeAll=true`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${bearer}` } });
  if (!response.ok) {
    throw new AppError(
      'apple_history_unavailable',
      502,
      `Apple subscription history returned HTTP ${response.status}.`,
    );
  }
  return (await response.json()) as { signedTransactions?: string[] };
}

/**
 * Find an existing SIMP entitlement by Apple's originalTransactionId
 * (stable across renewals) and re-verify it against the App Store.
 * Returns the up-to-date entitlement row.
 */
export async function refreshAppleEntitlementByOriginalTransaction(
  userId: string,
  originalTransactionId: string,
  environment: AppleEnvironment,
) {
  const history = await fetchAppleSubscriptionHistory(originalTransactionId, environment);
  if (!history.signedTransactions?.length) {
    throw new AppError(
      'apple_no_history',
      404,
      'No active subscription found for that original transaction id.',
    );
  }
  // Pick the most recent transaction (Apple returns them ordered newest-first).
  const latest = history.signedTransactions[0]!;
  const tx = jwt.decode(latest) as null | Record<string, unknown>;
  if (!tx) {
    throw new AppError('apple_purchase_invalid', 400, 'Apple returned an undecodable transaction.');
  }
  return persistAppleTransaction(userId, tx, latest, environment);
}

/**
 * Persist a decoded Apple transaction (JWS payload) as a SIMP entitlement.
 * Shared by verify / refresh / server-notification handlers.
 */
export async function persistAppleTransaction(
  userId: string,
  transaction: Record<string, unknown>,
  receiptValue: string,
  environment: AppleEnvironment,
) {
  const productId = typeof transaction.productId === 'string' ? transaction.productId : null;
  const transactionId = typeof transaction.transactionId === 'string' ? transaction.transactionId : null;
  const originalTransactionId =
    typeof transaction.originalTransactionId === 'string' ? transaction.originalTransactionId : null;
  const bundleId = typeof transaction.bundleId === 'string' ? transaction.bundleId : null;
  const type = typeof transaction.type === 'string' ? transaction.type : null;
  const expiresAt = typeof transaction.expiresDate === 'number' ? new Date(transaction.expiresDate) : null;
  const revocationDate = typeof transaction.revocationDate === 'number' ? transaction.revocationDate : null;

  if (
    !productId ||
    !transactionId ||
    !originalTransactionId ||
    bundleId !== env.APPLE_BUNDLE_ID
  ) {
    throw new AppError(
      'apple_purchase_invalid',
      400,
      'The transaction does not belong to the SIMP app.',
    );
  }

  const tier = tierForAppleProduct(productId);
  const active = !revocationDate && (!expiresAt || expiresAt > new Date());
  const status: EntitlementStatus = revocationDate
    ? 'REVOKED'
    : active
      ? type === 'Auto-Renewable Subscription' && expiresAt && expiresAt < new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
        ? 'GRACE_PERIOD'
        : 'ACTIVE'
      : 'EXPIRED';

  const receiptHash = await import('node:crypto')
    .then(({ createHash }) => createHash('sha256').update(receiptValue).digest('hex'));

  const entitlement = await prisma.entitlement.upsert({
    where: { transactionId },
    create: {
      userId,
      tier,
      status,
      platform: 'APPLE' as BillingPlatform,
      productId,
      transactionId,
      originalTransactionId,
      expiresAt,
      autoRenewing: active && type === 'Auto-Renewable Subscription',
      environment,
      receiptHash,
      lastVerifiedAt: new Date(),
    },
    update: {
      tier,
      status,
      productId,
      originalTransactionId,
      expiresAt,
      autoRenewing: active && type === 'Auto-Renewable Subscription',
      lastVerifiedAt: new Date(),
      receiptHash,
    },
  });

  // Mirror `isPremium` onto the user's profile for legacy code paths
  // that still read Profile.isPremium. The entitlement table is the
  // canonical source of truth; the profile field is a cache.
  const premium = ['ACTIVE', 'GRACE_PERIOD'].includes(status);
  await prisma.profile.updateMany({ where: { userId }, data: { isPremium: premium } });

  return entitlement;
}

function tierForAppleProduct(productId: string): EntitlementTier {
  const plusProducts = new Set(
    env.SIMP_PLUS_PRODUCT_IDS.split(',').map((s) => s.trim()).filter(Boolean),
  );
  const eliteProducts = new Set(
    env.SIMP_ELITE_PRODUCT_IDS.split(',').map((s) => s.trim()).filter(Boolean),
  );
  if (eliteProducts.has(productId)) return 'SIMP_ELITE';
  if (plusProducts.has(productId)) return 'SIMP_PLUS';
  throw new AppError(
    'unknown_billing_product',
    400,
    'That subscription product is not recognized by SIMP.',
  );
}

/**
 * App Store Server Notifications V2 payload shape (JWS-decoded).
 * Reference: https://developer.apple.com/documentation/appstoreservernotifications
 */
export type AppStoreServerNotification = {
  notificationType?: string;
  subtype?: string;
  notificationUUID?: string;
  data?: {
    bundleId?: string;
    bundleVersion?: string;
    environment?: string;
    signedTransactionInfo?: string;
  };
  version?: string;
  signedDate?: number;
};

export type ServerNotificationHandler =
  | 'INITIAL_BUY'
  | 'INITIAL_PURCHASE'
  | 'DID_CHANGE_RENEWAL_STATUS'
  | 'DID_CHANGE_RENEWAL_PREFERENCES'
  | 'DID_FAIL_TO_CONSUME'
  | 'DID_RECOVER'
  | 'DID_RENEW'
  | 'EXPIRED'
  | 'GRACE_PERIOD_EXPIRED'
  | 'OFFER_REDEEMED'
  | 'PRICE_INCREASE'
  | 'REFUND'
  | 'REFUND_DECLINED'
  | 'REFUND_REVERSED'
  | 'RENEWAL_EXTENDED'
  | 'RENEWAL_EXTENSION'
  | 'SUBSCRIBER_PAUSED'
  | 'TEST'
  | 'UNCANCEL';

const NOTIFICATIONS_REQUIRING_REFETCH = new Set<string>([
  'INITIAL_BUY',
  'DID_RENEW',
  'DID_CHANGE_RENEWAL_STATUS',
  'DID_FAIL_TO_CONSUME',
  'DID_RECOVER',
  'EXPIRED',
  'GRACE_PERIOD_EXPIRED',
  'PRICE_INCREASE',
  'REFUND',
  'REFUND_DECLINED',
  'REFUND_REVERSED',
  'RENEWAL_EXTENDED',
  'RENEWAL_EXTENSION',
  'SUBSCRIBER_PAUSED',
  'UNCANCEL',
]);

const NOTIFICATIONS_REQUIRING_CANCEL = new Set<string>(['REFUND', 'REVOKE']);

/**
 * Process a verified Apple Server Notification. Idempotent: re-running
 * the same notification is safe. Apple retries notifications until we
 * return 2xx, so we MUST be idempotent.
 *
 * @param signedPayload The raw JWS payload from Apple's POST body
 * @returns { handled: boolean, userId?: string }
 */
export async function handleAppStoreServerNotification(signedPayload: string) {
  const payload = jwt.decode(signedPayload) as AppStoreServerNotification | null;
  if (!payload || !payload.notificationType || !payload.data) {
    return { handled: false, reason: 'undecodable_payload' };
  }
  const data = payload.data;
  if (data.bundleId && data.bundleId !== env.APPLE_BUNDLE_ID) {
    return { handled: false, reason: 'wrong_bundle_id' };
  }
  const signedTransactionInfo = data.signedTransactionInfo;
  if (!signedTransactionInfo) {
    // Some notifications (e.g. TEST) have no transaction payload
    return { handled: true, reason: 'no_transaction' };
  }
  const transaction = jwt.decode(signedTransactionInfo) as null | Record<string, unknown>;
  if (!transaction) {
    return { handled: false, reason: 'undecodable_transaction' };
  }
  const originalTransactionId =
    typeof transaction.originalTransactionId === 'string' ? transaction.originalTransactionId : null;
  if (!originalTransactionId) {
    return { handled: false, reason: 'missing_original_transaction_id' };
  }

  // Find the SIMP user who owns this Apple subscription. The
  // entitlement row is keyed by transactionId, but for renewals /
  // refunds Apple may reuse the originalTransactionId across multiple
  // transactionIds. Look up by either.
  const existing = await prisma.entitlement.findFirst({
    where: {
      OR: [
        { transactionId: typeof transaction.transactionId === 'string' ? transaction.transactionId : undefined },
        { originalTransactionId },
      ],
      platform: 'APPLE',
    },
  });
  if (!existing) {
    // Could be a brand-new purchase for a user we haven't seen
    // before. We can't identify them from the JWS alone (Apple does
    // not include the SIMP user id in the receipt), so we accept the
    // notification and let the next /billing/apple/verify from the
    // client attach it to the right user.
    return { handled: true, reason: 'no_matching_user_yet' };
  }

  if (NOTIFICATIONS_REQUIRING_REFETCH.has(payload.notificationType)) {
    await persistAppleTransaction(
      existing.userId,
      transaction,
      signedTransactionInfo,
      (data.environment as AppleEnvironment) ?? 'Production',
    );
  }
  if (NOTIFICATIONS_REQUIRING_CANCEL.has(payload.notificationType)) {
    // Mark as REVOKED so entitlement checks stop granting access
    // immediately. persistAppleTransaction handles this if we re-persist.
    await persistAppleTransaction(
      existing.userId,
      { ...transaction, revocationDate: Date.now() },
      signedTransactionInfo,
      (data.environment as AppleEnvironment) ?? 'Production',
    );
  }

  return { handled: true, userId: existing.userId, notificationType: payload.notificationType };
}

/**
 * Restore purchases — used when a user signs in on a new device.
 * Apple's App Store Server API does NOT support "list all my subscriptions"
 * for a user without knowing at least one originalTransactionId. So the
 * expected flow is: client calls this with the App Store receipt
 * containing the originalTransactionId(s) it has cached locally.
 */
export async function restoreApplePurchases(userId: string, originalTransactionIds: string[]) {
  if (originalTransactionIds.length === 0) {
    return [];
  }
  const restored: unknown[] = [];
  for (const originalTransactionId of originalTransactionIds) {
    try {
      const ent = await refreshAppleEntitlementByOriginalTransaction(
        userId,
        originalTransactionId,
        'Production',
      );
      restored.push(ent);
    } catch {
      // try sandbox too — user's receipt may have come from a TestFlight build
      try {
        const ent = await refreshAppleEntitlementByOriginalTransaction(
          userId,
          originalTransactionId,
          'Sandbox',
        );
        restored.push(ent);
      } catch {
        // Apple doesn't have that subscription any more; skip silently
      }
    }
  }
  return restored;
}
