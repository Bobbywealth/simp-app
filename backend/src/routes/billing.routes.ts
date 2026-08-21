import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { prisma } from '../config/db.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { verifyAppleTransaction, verifyGooglePurchase } from '../services/billing.service.js';
import {
  handleAppStoreServerNotification,
  refreshAppleEntitlementByOriginalTransaction,
  restoreApplePurchases,
} from '../services/apple-iap.service.js';

export const billingRouter = Router();

const products = () => ({
  plus: env.SIMP_PLUS_PRODUCT_IDS.split(',').map((id) => id.trim()).filter(Boolean),
  elite: env.SIMP_ELITE_PRODUCT_IDS.split(',').map((id) => id.trim()).filter(Boolean),
  features: {
    SIMP_PLUS: ['More daily likes', 'Advanced filters', 'Incoming likes', 'Rewind'],
    SIMP_ELITE: ['Everything in SIMP+', 'Priority placement', 'Boosts', 'Premium live features'],
  },
});

billingRouter.get('/billing/products', (_req, res) => res.json(products()));

billingRouter.get('/billing/entitlements/me', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const entitlements = await prisma.entitlement.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        tier: true,
        status: true,
        platform: true,
        productId: true,
        expiresAt: true,
        autoRenewing: true,
        lastVerifiedAt: true,
      },
    });
    const active = entitlements.find(
      (item) =>
        ['ACTIVE', 'GRACE_PERIOD'].includes(item.status) &&
        (!item.expiresAt || item.expiresAt > new Date()),
    );
    res.json({
      tier: active?.tier ?? 'FREE',
      status: active?.status ?? 'ACTIVE',
      expiresAt: active?.expiresAt ?? null,
      entitlements,
    });
  } catch (error) {
    next(error);
  }
});

billingRouter.post('/billing/apple/verify', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const input = z
      .object({
        transactionId: z.string().min(1).max(200),
        environment: z.enum(['Production', 'Sandbox']).default('Production'),
      })
      .parse(req.body);
    const entitlement = await verifyAppleTransaction(
      req.userId!,
      input.transactionId,
      input.environment,
    );
    res.json({ entitlement });
  } catch (error) {
    next(error);
  }
});

billingRouter.post('/billing/google/verify', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const input = z
      .object({
        purchaseToken: z.string().min(20).max(10_000),
        productId: z.string().min(1).max(200).optional(),
      })
      .parse(req.body);
    const entitlement = await verifyGooglePurchase(
      req.userId!,
      input.purchaseToken,
      input.productId,
    );
    res.json({ entitlement });
  } catch (error) {
    next(error);
  }
});

billingRouter.post('/billing/restore', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const input = z
      .discriminatedUnion('platform', [
        z.object({ platform: z.literal('APPLE'), transactionIds: z.array(z.string().min(1)).min(1).max(20), environment: z.enum(['Production', 'Sandbox']).default('Production') }),
        z.object({ platform: z.literal('GOOGLE'), purchases: z.array(z.object({ purchaseToken: z.string().min(20), productId: z.string().optional() })).min(1).max(20) }),
      ])
      .parse(req.body);
    const restored =
      input.platform === 'APPLE'
        ? await Promise.all(
            input.transactionIds.map((transactionId) =>
              verifyAppleTransaction(req.userId!, transactionId, input.environment),
            ),
          )
        : await Promise.all(
            input.purchases.map((purchase) =>
              verifyGooglePurchase(req.userId!, purchase.purchaseToken, purchase.productId),
            ),
          );
    res.json({ restored });
  } catch (error) {
    next(error);
  }
});

// Re-validate an existing Apple entitlement by its
// originalTransactionId. Use when the App Store Server Notification
// webhook is unreachable, or for periodic daily refresh.
billingRouter.post(
  '/billing/apple/refresh',
  requireAuth,
  async (req: AuthedRequest, res, next) => {
    try {
      const input = z
        .object({
          originalTransactionId: z.string().min(1).max(200),
          environment: z.enum(['Production', 'Sandbox']).default('Production'),
        })
        .parse(req.body);
      const entitlement = await refreshAppleEntitlementByOriginalTransaction(
        req.userId!,
        input.originalTransactionId,
        input.environment,
      );
      res.json({ entitlement });
    } catch (error) {
      next(error);
    }
  },
);

// Restore purchases — Apple does not expose a server-side "list all my
// subscriptions" API, so the client must pass the originalTransactionIds
// it has cached locally. The backend will refetch each from Apple and
// reconcile with our entitlement table.
billingRouter.post(
  '/billing/apple/restore',
  requireAuth,
  async (req: AuthedRequest, res, next) => {
    try {
      const input = z
        .object({
          originalTransactionIds: z
            .array(z.string().min(1).max(200))
            .min(1)
            .max(20),
        })
        .parse(req.body);
      const restored = await restoreApplePurchases(
        req.userId!,
        input.originalTransactionIds,
      );
      res.json({ restored: restored.length });
    } catch (error) {
      next(error);
    }
  },
);

// Apple App Store Server Notifications V2 webhook. Apple POSTs a JWS
// payload to this endpoint whenever a subscription event happens
// (initial purchase, renewal, refund, billing retry, expiry, etc.).
// Reference: https://developer.apple.com/documentation/appstoreservernotifications
//
// Apple requires us to respond 2xx once we've persisted the
// notification. The handler is idempotent: re-processing the same
// notification is safe. We DO NOT require auth on this route — Apple
// does not send Bearer tokens. We authenticate by verifying the JWS
// signature + checking notificationUUID against the database
// (de-duplication can be added with a NotificationEvent table).
billingRouter.post('/billing/apple/notifications', async (req, res, next) => {
  try {
    const signedPayload =
      typeof req.body === 'string'
        ? req.body
        : typeof req.body?.signedPayload === 'string'
          ? req.body.signedPayload
          : null;
    if (!signedPayload) {
      return res.status(400).json({ error: 'missing_signed_payload' });
    }
    const result = await handleAppStoreServerNotification(signedPayload);
    if (!result.handled) {
      // Apple treats non-2xx as a retry signal. We respond 202 so
      // Apple doesn't infinitely retry on a permanently bad payload.
      return res.status(202).json({ ok: true, handled: false, reason: result.reason });
    }
    res.status(200).json({ ok: true, handled: true });
  } catch (error) {
    next(error);
  }
});
