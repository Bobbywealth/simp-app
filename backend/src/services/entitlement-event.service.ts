// EntitlementEvent audit-log writer. Every code path that mutates an
// Entitlement row (verify / refresh / restore / Apple webhook / Google
// RTDN / reconciliation cron) calls recordEntitlementEvent so we have
// a full immutable history per user per subscription. Idempotent on
// externalId: re-running the same Apple notification, Google pubsub
// message, or manual verify is a no-op.

import type { EntitlementTier, EntitlementStatus, BillingPlatform } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/db.js';

export type EntitlementEventType =
  | 'PURCHASE'
  | 'RENEWAL'
  | 'UPGRADE'
  | 'DOWNGRADE'
  | 'CANCEL'
  | 'REFUND'
  | 'GRACE_PERIOD'
  | 'RECOVER'
  | 'EXPIRE'
  | 'RESTORE'
  | 'PAUSE'
  | 'UNCANCEL';

export type EntitlementEventSource =
  | 'APPLE_VERIFY'
  | 'APPLE_WEBHOOK'
  | 'APPLE_REFRESH'
  | 'GOOGLE_VERIFY'
  | 'GOOGLE_RTDN'
  | 'GOOGLE_PUBSUB'
  | 'CLIENT_VERIFY'
  | 'CLIENT_RESTORE'
  | 'RECONCILE';

export interface RecordEntitlementEventInput {
  entitlementId: string;
  userId: string;
  type: EntitlementEventType;
  source: EntitlementEventSource;
  tier: EntitlementTier;
  status: EntitlementStatus;
  platform: BillingPlatform;
  productId: string;
  transactionId?: string | null;
  originalTransactionId?: string | null;
  externalId?: string | null;
  environment?: string | null;
  expiresAt?: Date | null;
  metadata?: Record<string, unknown>;
}

/**
 * Record an entitlement event. Returns true if a new row was inserted,
 * false if the externalId was already known (idempotent replay).
 *
 * Callers should always pass an externalId whenever the event originates
 * from a server-to-server source:
 *   - Apple App Store Server Notifications V2 → notificationUUID
 *   - Apple App Store Server API (refresh/history) → transactionId
 *   - Google Play RTDN → pubsub message id
 *   - Google Play Developer API (manual verify/refresh) → orderId
 *   - Manual /scripts/reconcile-apple → "reconcile:{userId}:{day}"
 */
export async function recordEntitlementEvent(
  input: RecordEntitlementEventInput,
): Promise<{ recorded: boolean; eventId: string }> {
  try {
    const event = await prisma.entitlementEvent.create({
      data: {
        entitlementId: input.entitlementId,
        userId: input.userId,
        type: input.type,
        source: input.source,
        tier: input.tier,
        status: input.status,
        platform: input.platform,
        productId: input.productId,
        transactionId: input.transactionId ?? null,
        originalTransactionId: input.originalTransactionId ?? null,
        externalId: input.externalId ?? null,
        environment: input.environment ?? null,
        expiresAt: input.expiresAt ?? null,
        metadata: input.metadata
          ? (input.metadata as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
      select: { id: true },
    });
    return { recorded: true, eventId: event.id };
  } catch (error) {
    // Unique violation on externalId means a duplicate write; treat as success.
    if (
      typeof error === 'object' &&
      error &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
    ) {
      const existing = await prisma.entitlementEvent.findFirst({
        where: { externalId: input.externalId ?? undefined },
        select: { id: true },
      });
      return { recorded: false, eventId: existing?.id ?? '' };
    }
    throw error;
  }
}

/**
 * Classify an Apple App Store Server Notification type into a
 * SIMP EntitlementEventType. Anything we don't recognise is recorded
 * as PURCHASE (the safe default) so the row is still in the audit log.
 */
export function classifyAppleNotificationType(type: string | undefined): EntitlementEventType {
  switch (type) {
    case 'INITIAL_BUY':
    case 'INITIAL_PURCHASE':
      return 'PURCHASE';
    case 'DID_RENEW':
    case 'OFFER_REDEEMED':
      return 'RENEWAL';
    case 'DID_CHANGE_RENEWAL_PREFERENCES':
      // Could be upgrade or downgrade; refinement requires comparing
      // previous vs new productId in the calling site.
      return 'PURCHASE';
    case 'DID_FAIL_TO_RENEW':
      return 'GRACE_PERIOD';
    case 'DID_RECOVER':
      return 'RECOVER';
    case 'EXPIRED':
    case 'GRACE_PERIOD_EXPIRED':
      return 'EXPIRE';
    case 'REFUND':
    case 'REFUND_DECLINED':
    case 'REFUND_REVERSED':
      return 'REFUND';
    case 'DID_CHANGE_RENEWAL_STATUS':
      return 'CANCEL';
    case 'SUBSCRIBER_PAUSED':
      return 'PAUSE';
    case 'UNCANCEL':
      return 'UNCANCEL';
    default:
      return 'PURCHASE';
  }
}
