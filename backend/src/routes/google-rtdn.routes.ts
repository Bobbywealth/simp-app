// Google Play Real-Time Developer Notifications (RTDN) webhook.
//
// Setup (Play Console):
//   Monetize → Monetization setup → Real-time developer notifications
//   URL: https://api.mysimp.com/billing/google/notifications
//   Pub/Sub topic: projects/<project>/topics/play-rrn-events (recommended)
// Or use a per-package topic. Google POSTs the pub/sub message to the
// endpoint as a JSON body of shape { message: { data: "<base64>", ... } }.
//
// Reference:
//   https://developer.android.com/google/play/billing/getting-started#rtdeveloper-notifications

import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { GoogleAuth } from 'google-auth-library';
import { prisma } from '../config/db.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';
import { recordEntitlementEvent } from '../services/entitlement-event.service.js';

export const googleRtdnRouter = Router();

type RtdnNotification = {
  version?: string;
  packageName?: string;
  eventTimeMillis?: string;
  subscriptionNotification?: {
    version?: string;
    notificationType?: number;
    purchaseToken?: string;
    subscriptionId?: string;
  };
  voidedPurchaseNotification?: {
    purchaseToken?: string;
    orderId?: string;
    productType?: number;
  };
  oneTimeProductNotification?: {
    purchaseToken?: string;
    sku?: string;
  };
};

const RTDN_NOTIFICATION_TYPE = {
  SUBSCRIPTION_RECOVERED: 1,
  SUBSCRIPTION_RENEWED: 2,
  SUBSCRIPTION_CANCELED: 3,
  SUBSCRIPTION_PURCHASED: 4,
  SUBSCRIPTION_ON_HOLD: 5,
  SUBSCRIPTION_IN_GRACE_PERIOD: 6,
  SUBSCRIPTION_RESTARTED: 7,
  SUBSCRIPTION_PRICE_CHANGE_CONFIRMED: 8,
  SUBSCRIPTION_DEFERRED: 9,
  SUBSCRIPTION_PAUSED: 10,
  SUBSCRIPTION_PAUSE_SCHEDULE_CHANGED: 11,
  SUBSCRIPTION_REVOKED: 12,
  SUBSCRIPTION_EXPIRED: 13,
  SUBSCRIPTION_PENDING_PURCHASE_CANCELED: 20,
} as const;

function classifyGoogleRtdn(type: number | undefined): {
  eventType: 'PURCHASE' | 'RENEWAL' | 'CANCEL' | 'REFUND' | 'RECOVER' | 'PAUSE' | 'EXPIRE';
} {
  switch (type) {
    case RTDN_NOTIFICATION_TYPE.SUBSCRIPTION_RECOVERED:
      return { eventType: 'RECOVER' };
    case RTDN_NOTIFICATION_TYPE.SUBSCRIPTION_RENEWED:
    case RTDN_NOTIFICATION_TYPE.SUBSCRIPTION_RESTARTED:
      return { eventType: 'RENEWAL' };
    case RTDN_NOTIFICATION_TYPE.SUBSCRIPTION_CANCELED:
    case RTDN_NOTIFICATION_TYPE.SUBSCRIPTION_REVOKED:
    case RTDN_NOTIFICATION_TYPE.SUBSCRIPTION_PENDING_PURCHASE_CANCELED:
      return { eventType: 'CANCEL' };
    case RTDN_NOTIFICATION_TYPE.SUBSCRIPTION_PURCHASED:
      return { eventType: 'PURCHASE' };
    case RTDN_NOTIFICATION_TYPE.SUBSCRIPTION_ON_HOLD:
    case RTDN_NOTIFICATION_TYPE.SUBSCRIPTION_PAUSED:
    case RTDN_NOTIFICATION_TYPE.SUBSCRIPTION_PAUSE_SCHEDULE_CHANGED:
      return { eventType: 'PAUSE' };
    case RTDN_NOTIFICATION_TYPE.SUBSCRIPTION_EXPIRED:
      return { eventType: 'EXPIRE' };
    case RTDN_NOTIFICATION_TYPE.SUBSCRIPTION_IN_GRACE_PERIOD:
      // We treat grace-period transitions as a recoverable event; the
      // entitlement row stays ACTIVE → GRACE_PERIOD via the manual
      // refresh path. Record so the timeline shows the grace window.
      return { eventType: 'PURCHASE' };
    default:
      return { eventType: 'PURCHASE' };
  }
}

async function getGoogleAccessToken(): Promise<string> {
  if (!env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON) {
    throw new AppError('google_billing_not_configured', 503, 'Google Play credentials not configured.');
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
  return typeof access === 'string' ? access : access?.token ?? '';
}

async function fetchGoogleSubscription(purchaseToken: string): Promise<{
  subscriptionState?: string;
  latestOrderId?: string;
  lineItems?: Array<{
    productId?: string;
    expiryTime?: string;
    autoRenewingPlan?: { autoRenewEnabled?: boolean };
  }>;
}> {
  const token = await getGoogleAccessToken();
  const response = await fetch(
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(env.GOOGLE_PLAY_PACKAGE_NAME)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!response.ok) {
    throw new AppError('google_lookup_failed', 502, `Google lookup returned HTTP ${response.status}.`);
  }
  return (await response.json()) as {
    subscriptionState?: string;
    latestOrderId?: string;
    lineItems?: Array<{
      productId?: string;
      expiryTime?: string;
      autoRenewingPlan?: { autoRenewEnabled?: boolean };
    }>;
  };
}

function asJson(body: unknown): RtdnNotification {
  // Two shapes arrive here:
  //   1) Pub/Sub push: { message: { data: '<base64 JSON>', messageId, publishTime }, subscription }
  //   2) Direct HTTP: { notificationType, purchaseToken, ... } (legacy / debug)
  let direct: RtdnNotification | null = null;
  if (body && typeof body === 'object' && 'message' in body && (body as { message?: { data?: string } }).message) {
    const data = (body as { message: { data: string } }).message.data;
    direct = JSON.parse(Buffer.from(data, 'base64').toString('utf8')) as RtdnNotification;
  } else if (body && typeof body === 'object') {
    direct = body as RtdnNotification;
  }
  if (!direct) {
    throw new AppError('google_rtdn_undecodable', 400, 'Empty Google RTDN payload.');
  }
  return direct;
}

googleRtdnRouter.post('/billing/google/notifications', async (req, res, next) => {
  try {
    const notification = asJson(req.body);
    const subscription = notification.subscriptionNotification;
    if (!subscription?.purchaseToken) {
      // voidedPurchaseNotification / oneTimeProductNotification — not
      // applicable to SIMP's subscription-only model. Acknowledge.
      return res.status(200).json({ ok: true, ignored: true });
    }
    const { eventType } = classifyGoogleRtdn(subscription.notificationType);
    const existing = await prisma.entitlement.findFirst({
      where: {
        platform: 'GOOGLE',
        OR: [
          { transactionId: subscription.purchaseToken },
          { originalTransactionId: subscription.purchaseToken },
        ],
      },
    });
    if (!existing) {
      // No SIMP entitlement linked to that purchaseToken yet. The
      // device should retry verify on next launch and pick it up.
      return res.status(200).json({ ok: true, pending: true });
    }
    const purchase = await fetchGoogleSubscription(subscription.purchaseToken);
    const line = purchase.lineItems?.find((item) => item.productId === subscription.subscriptionId) ?? purchase.lineItems?.[0];
    if (!line?.productId) {
      throw new AppError('google_no_line', 502, 'Google returned no line item.');
    }
    const expiresAt = line.expiryTime ? new Date(line.expiryTime) : null;
    const activeStates = new Set(['SUBSCRIPTION_STATE_ACTIVE', 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD']);
    const active = activeStates.has(purchase.subscriptionState ?? '') && (!expiresAt || expiresAt > new Date());
    const status = !active
      ? 'EXPIRED'
      : purchase.subscriptionState === 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD'
        ? 'GRACE_PERIOD'
        : 'ACTIVE';

    const updated = await prisma.entitlement.update({
      where: { id: existing.id },
      data: {
        status,
        expiresAt,
        autoRenewing: line.autoRenewingPlan?.autoRenewEnabled ?? false,
        lastVerifiedAt: new Date(),
      },
    });
    const premium = ['ACTIVE', 'GRACE_PERIOD'].includes(status);
    await prisma.profile.updateMany({ where: { userId: existing.userId }, data: { isPremium: premium } });

    const messageId = (req.body as { message?: { messageId?: string } })?.message?.messageId;
    await recordEntitlementEvent({
      entitlementId: updated.id,
      userId: existing.userId,
      type: eventType,
      source: 'GOOGLE_RTDN',
      tier: updated.tier,
      status,
      platform: 'GOOGLE',
      productId: updated.productId,
      transactionId: updated.transactionId,
      originalTransactionId: updated.originalTransactionId,
      externalId: messageId
        ? `rtdn:${messageId}`
        : `rtdn:${subscription.purchaseToken}:${subscription.notificationType ?? 'unknown'}`,
      environment: 'GooglePlay',
      expiresAt,
    });

    res.status(200).json({ ok: true, status });
  } catch (error) {
    // Reject unknown / malformed bodies with 5xx so Google retries.
    if ((error as AppError)?.status && (error as AppError).status! < 500) {
      return res.status(202).json({ ok: true, handled: false });
    }
    next(error);
  }
});

// Suppress unused-warning on jwt (used elsewhere) — keep type-checked
// import for the bundle size of tooling that lints unused-imports.
void jwt;
