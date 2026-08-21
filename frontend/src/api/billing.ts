import type { EntitlementTier } from '../types';
import { apiFetch } from './client';

export const getBillingProducts = () =>
  apiFetch<{
    plus: string[];
    elite: string[];
    features: { SIMP_PLUS: string[]; SIMP_ELITE: string[] };
  }>('/billing/products', { auth: false });

export const getMyEntitlement = () =>
  apiFetch<{
    tier: EntitlementTier;
    status: string;
    expiresAt: string | null;
    entitlements: Array<Record<string, unknown>>;
  }>('/billing/entitlements/me');

export const verifyApplePurchase = (transactionId: string, environment: 'Production' | 'Sandbox') =>
  apiFetch<{ entitlement: Record<string, unknown> }>('/billing/apple/verify', {
    method: 'POST',
    body: JSON.stringify({ transactionId, environment }),
  });

export const verifyGooglePurchase = (purchaseToken: string, productId?: string) =>
  apiFetch<{ entitlement: Record<string, unknown> }>('/billing/google/verify', {
    method: 'POST',
    body: JSON.stringify({ purchaseToken, productId }),
  });

/** Re-validate an existing entitlement by originalTransactionId. */
export const refreshAppleEntitlement = (input: {
  originalTransactionId: string;
  environment?: 'Production' | 'Sandbox';
}) =>
  apiFetch<{ entitlement: Record<string, unknown> }>('/billing/apple/refresh', {
    method: 'POST',
    body: JSON.stringify({ environment: 'Production', ...input }),
  });

/** Restore purchases — pass every originalTransactionId we have cached. */
export const restoreApplePurchases = (originalTransactionIds: string[]) =>
  apiFetch<{ restored: number }>('/billing/apple/restore', {
    method: 'POST',
    body: JSON.stringify({ originalTransactionIds }),
  });
