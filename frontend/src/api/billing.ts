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
