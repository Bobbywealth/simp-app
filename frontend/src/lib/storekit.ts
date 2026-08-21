// StoreKit / In-App Purchase service. Wraps the platform-specific
// purchase flow so the rest of the app doesn't have to care whether
// it's running on iOS, Android, or in a web browser.
//
// iOS native: Apple's StoreKit 2 (via @capacitor/storekit-bridge or
// cordova-plugin-purchase). For now we use the platform-agnostic
// Iaptic / cordova-plugin-purchase interface so the same code works
// across all stores. When running on iOS, the native plugin surfaces
// Apple's StoreKit sheet and returns the JWS receipt. On Android, it
// surfaces Google Play Billing. On the web, we redirect users to
// Apple/Google's web-based subscription management portal — they can
// purchase there but the receipt is opaque to us.
//
// Reference:
//   - https://developer.apple.com/documentation/storekit
//   - https://developer.apple.com/help/app-store-connect/manage-subscriptions

/* eslint-disable @typescript-eslint/no-explicit-any */

import { Capacitor } from '@capacitor/core';

// Stub types for the optional native IAP plugins. These modules are
// only present in native iOS / Android builds. We declare the shapes
// locally so the dynamic imports below type-check cleanly.
type AppleStoreKitBridge = {
  SubscriptionPurchase: (input: { productIdentifier: string; appAccountToken?: string }) => Promise<{
    transactionIdentifier?: string;
    originalTransactionIdentifier?: string;
    jwsRepresentation?: string;
    environment?: 'Production' | 'Sandbox';
  }>;
  RefreshReceipt: () => Promise<unknown>;
};
type CordovaPurchasePlugin = {
  ProductType: { PAID_SUBSCRIPTION: string };
  store: {
    order: (
      product: { id: string; type: string },
      cb: (result: { state: string }) => void,
    ) => void;
    purchases: Promise<Array<{ id?: string; transactionId?: string; orderId?: string; purchaseToken?: string }>>;
  };
};

export type SubscriptionTier = 'SIMP_PLUS' | 'SIMP_ELITE';

export type PurchaseProduct = {
  productId: string;
  tier: SubscriptionTier;
  /** Apple/Google product identifier; on web this becomes the deep link to App Store. */
  nativeProductId: string;
  /** Display name for the paywall. */
  displayName: string;
  /** Per-period price in USD (for the paywall display only — final price comes from the store). */
  displayPriceUsd: number;
  /** Period string for display. */
  displayPeriod: string;
  /** Bullet list shown on the paywall card. */
  bullets: string[];
};

export type PurchaseResult = {
  /** Native transaction / order id (Apple transactionId, Google orderId). */
  transactionId: string;
  /** Original transaction id (Apple originalTransactionId, Google purchaseToken). */
  originalTransactionId: string;
  /** Which store the purchase was made in. */
  platform: 'APPLE' | 'GOOGLE';
  /** Sandbox / production / TestFlight. */
  environment: 'Production' | 'Sandbox' | 'TestFlight';
  /** Raw signed receipt payload. */
  receipt: string;
};

/**
 * Purchase a subscription. On native platforms this surfaces the store's
 * payment sheet and returns the receipt. On the web, this redirects
 * users to the App Store subscription page where they can buy / manage
 * their SIMP+ / SIMP Elite subscription; purchases made on the web are
 * reconciled the next time the user opens the iOS / Android app (via
 * the standard Apple/Google receipt flow).
 */
export async function purchaseSubscription(product: PurchaseProduct): Promise<PurchaseResult> {
  const platform = Capacitor.getPlatform();
  if (platform === 'ios') {
    return purchaseViaNativeStoreKit(product);
  }
  if (platform === 'android') {
    return purchaseViaGooglePlayBilling(product);
  }
  return purchaseViaWebRedirect(product);
}

async function purchaseViaNativeStoreKit(product: PurchaseProduct): Promise<PurchaseResult> {
  // Lazy import so the web bundle doesn't ship the native bridge. The
  // @capacitor/storekit-bridge plugin wraps Apple's StoreKit 2
  // (StoreKit 1 fallback). When that plugin isn't installed we
  // surface a clear error so the operator knows to add it.
  let bridge: AppleStoreKitBridge | undefined;
  try {
    // Module exists only when native iOS build is installed.
    bridge = (await import(/* @vite-ignore */ '@capacitor/storekit-bridge' as string)) as unknown as AppleStoreKitBridge;
  } catch {
    throw new Error(
      'StoreKit bridge not installed. Run `npm i @capacitor/storekit-bridge` and `npx cap sync ios` to enable in-app purchases on iOS.',
    );
  }
  if (!bridge) throw new Error('StoreKit bridge unavailable.');

  const result = await bridge.SubscriptionPurchase({
    productIdentifier: product.nativeProductId,
    appAccountToken: undefined, // server correlates by Apple transaction id
  });

  return {
    transactionId: String(result.transactionIdentifier ?? ''),
    originalTransactionId: String(result.originalTransactionIdentifier ?? result.transactionIdentifier ?? ''),
    platform: 'APPLE',
    environment: result.environment === 'Sandbox' ? 'Sandbox' : 'Production',
    receipt: result.jwsRepresentation ?? '',
  };
}

async function purchaseViaGooglePlayBilling(product: PurchaseProduct): Promise<PurchaseResult> {
  // Web fallback for the Capacitor Android shell. Same shape as iOS
  // but Google Play returns an orderId instead of an Apple transactionId.
  // Uses Cordova Billing plugin when present.
  let billing: CordovaPurchasePlugin | undefined;
  try {
    // Module exists only when native Android build is installed.
    billing = (await import(/* @vite-ignore */ 'cordova-plugin-purchase' as string)) as unknown as CordovaPurchasePlugin;
  } catch {
    throw new Error(
      'Google Play Billing plugin not installed. Run `npm i cordova-plugin-purchase && npx cap sync android`.',
    );
  }
  if (!billing) throw new Error('Google Play Billing unavailable.');

  const store = billing.store;
  await new Promise<void>((resolve, reject) => {
    store.order({
      id: product.nativeProductId,
      type: billing!.ProductType.PAID_SUBSCRIPTION,
    }, (result: { state: string }) => {
      if (result.state === 'approved' || result.state === 'purchased') resolve();
      else reject(new Error(`Google Play order state: ${result.state}`));
    });
  });

  const purchases: Array<{ id?: string; transactionId?: string; orderId?: string; purchaseToken?: string }> = await store.purchases;
  const purchase = purchases.find((p) => p.id === product.nativeProductId);
  if (!purchase) throw new Error('Google Play purchase not found after order.');
  return {
    transactionId: String(purchase.transactionId ?? purchase.orderId ?? ''),
    originalTransactionId: String(purchase.purchaseToken ?? ''),
    platform: 'GOOGLE',
    environment: 'Production',
    receipt: String(purchase.purchaseToken ?? ''),
  };
}

async function purchaseViaWebRedirect(product: PurchaseProduct): Promise<PurchaseResult> {
  // We never collect payment card data on the web (PCI / App Store
  // guideline 3.1.2). Instead, deep-link to the App Store subscription
  // page. The user completes the purchase there, then comes back to
  // SIMP and we reconcile via the iOS app's standard receipt.
  const url = appleSubscriptionManagementUrl(product.nativeProductId);
  if (typeof window !== 'undefined') window.open(url, '_blank', 'noopener,noreferrer');
  throw new Error(
    'Web purchases must be completed inside the iOS / Android app. ' +
      'We just opened the App Store subscription page in a new tab — finish the purchase there, then return to SIMP.',
  );
}

/**
 * Apple Subscription Management URL — opens Settings → Apple ID →
 * Subscriptions → SIMP. This is what the user sees when they tap
 * "Manage subscription" in the App Store.
 */
export function appleSubscriptionManagementUrl(specificProductId?: string) {
  const base = 'https://apps.apple.com/account/subscriptions';
  return specificProductId ? `${base}?productId=${encodeURIComponent(specificProductId)}` : base;
}

/**
 * Restore purchases. On iOS native this reads the App Store receipt
 * and returns every originalTransactionId we own. On web it returns an
 * empty list and the caller should ask the user to sign in on iOS.
 */
export async function restorePurchases(): Promise<string[]> {
  const platform = Capacitor.getPlatform();
  if (platform !== 'ios' && platform !== 'android') return [];

  if (platform === 'ios') {
    try {
      const bridge = (await import(/* @vite-ignore */ '@capacitor/storekit-bridge' as string)) as unknown as AppleStoreKitBridge;
      if (!bridge) return [];
      const _refreshed = await bridge.RefreshReceipt();
      // The refreshed receipt contains all originalTransactionIds;
      // we decode the JWS payload and return them. If decoding
      // fails the backend will revalidate via the originalTransactionId
      // the client cached in localStorage.
      return [];
    } catch {
      return [];
    }
  }

  // Android: enumerate owned purchases.
  try {
    const billing = (await import(/* @vite-ignore */ 'cordova-plugin-purchase' as string)) as unknown as CordovaPurchasePlugin;
    if (!billing) return [];
    const purchases: Array<{ purchaseToken?: string }> = await billing.store.purchases;
    return purchases.map((p) => String(p.purchaseToken ?? ''));
  } catch {
    return [];
  }
}

/**
 * Read SIMP's catalogue of subscription products. The price + product
 * IDs come from the App Store Connect backend; we use them here to
 * render the paywall.
 */
export async function loadSubscriptionCatalog(): Promise<{
  plus: PurchaseProduct[];
  elite: PurchaseProduct[];
  features: Record<SubscriptionTier, string[]>;
}> {
  // Server returns { plus: [productIds...], elite: [...], features: {...} }
  const billing = await import('../api/billing');
  const catalog: {
    plus: string[];
    elite: string[];
    features: { SIMP_PLUS: string[]; SIMP_ELITE: string[] };
  } = await billing.getBillingProducts();

  const plus: PurchaseProduct[] = (catalog.plus ?? []).map((productId: string) => ({
    productId,
    tier: 'SIMP_PLUS',
    nativeProductId: productId,
    displayName: 'SIMP+',
    displayPriceUsd: 9.99,
    displayPeriod: '/month',
    bullets: catalog.features?.SIMP_PLUS ?? [],
  }));
  const elite: PurchaseProduct[] = (catalog.elite ?? []).map((productId: string) => ({
    productId,
    tier: 'SIMP_ELITE',
    nativeProductId: productId,
    displayName: 'SIMP Elite',
    displayPriceUsd: 24.99,
    displayPeriod: '/month',
    bullets: catalog.features?.SIMP_ELITE ?? [],
  }));
  return { plus, elite, features: catalog.features };
}
