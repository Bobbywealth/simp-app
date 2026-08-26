// Premium / Paywall page. Lists SIMP+ and SIMP Elite subscription
// tiers, handles the purchase flow via the StoreKit bridge (native) or
// the App Store subscription management URL (web fallback), and
// provides a Restore Purchases button (required by App Store guideline
// 3.1.2 — every auto-renewable subscription must have a restore
// button reachable from the paywall / account settings).

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '../components/Button';
import { NavHeader } from '../components/NavHeader';
import { useAuth } from '../store/auth';
import { useSwipeBack } from '../hooks/useSwipeBack';
import { haptics } from '../lib/haptics';
import {
  appleSubscriptionManagementUrl,
  loadSubscriptionCatalog,
  purchaseSubscription,
  restorePurchases,
  type PurchaseProduct,
} from '../lib/storekit';
import {
  getMyEntitlement,
  refreshAppleEntitlement,
  restoreApplePurchases,
  verifyApplePurchase,
} from '../api/billing';
import { track } from '../api/analytics';

type CatalogState = 'loading' | 'ready' | 'error';

export default function Premium() {
  useSwipeBack(true);
  const { user, setUser } = useAuth();

  const [catalog, setCatalog] = useState<CatalogState>('loading');
  const [products, setProducts] = useState<{ plus: PurchaseProduct[]; elite: PurchaseProduct[] }>({
    plus: [],
    elite: [],
  });
  const [features, setFeatures] = useState<Record<'SIMP_PLUS' | 'SIMP_ELITE', string[]>>({
    SIMP_PLUS: [],
    SIMP_ELITE: [],
  });
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadSubscriptionCatalog()
      .then((c) => {
        if (cancelled) return;
        setProducts({ plus: c.plus, elite: c.elite });
        setFeatures(c.features);
        setCatalog('ready');
      })
      .catch((e) => {
        if (cancelled) return;
        setError((e as Error).message ?? 'Failed to load subscription options.');
        setCatalog('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handlePurchase(product: PurchaseProduct) {
    setError(null);
    setSuccess(null);
    setPurchasing(product.productId);
    haptics.medium();
    void track('purchase_started', { tier: product.tier, platform: 'native_or_web' });
    try {
      const result = await purchaseSubscription(product);
      await verifyApplePurchase(result.transactionId, result.environment === 'Sandbox' ? 'Sandbox' : 'Production');
      const me = await getMyEntitlement();
      setUser({
        ...user!,
        entitlement: {
          tier: (me.tier === 'SIMP_PLUS' || me.tier === 'SIMP_ELITE' ? me.tier : 'FREE') as 'FREE' | 'SIMP_PLUS' | 'SIMP_ELITE',
          status: (me.status === 'ACTIVE' || me.status === 'GRACE_PERIOD' || me.status === 'EXPIRED' || me.status === 'REVOKED' ? me.status : 'ACTIVE') as 'ACTIVE' | 'GRACE_PERIOD' | 'EXPIRED' | 'REVOKED',
          expiresAt: me.expiresAt,
        },
      });
      haptics.success();
      void track('purchase_completed', { tier: product.tier });
      setSuccess(`Welcome to ${product.displayName}! Your subscription is active.`);
    } catch (e) {
      haptics.heavy();
      void track('purchase_failed', { tier: product.tier, reason: (e as Error).message ?? 'unknown' });
      setError((e as Error).message ?? 'The purchase did not complete.');
    } finally {
      setPurchasing(null);
    }
  }

  async function handleRestore() {
    setError(null);
    setSuccess(null);
    setRestoring(true);
    try {
      const ids = await restorePurchases();
      if (ids.length === 0) {
        // Web fallback: open Apple subscription management. The user
        // can re-download / verify their subscription there, then come
        // back to SIMP.
        const url = appleSubscriptionManagementUrl();
        if (typeof window !== 'undefined') window.open(url, '_blank', 'noopener,noreferrer');
        setSuccess(
          "We didn't find any purchases on this device. If you subscribed on another device, open the App Store subscription page we just opened and confirm SIMP is listed there.",
        );
        return;
      }
      const restored = await restoreApplePurchases(ids);
      if (restored.restored > 0) {
        const me = await getMyEntitlement();
        setUser({
          ...user!,
          entitlement: {
            tier: (me.tier === 'SIMP_PLUS' || me.tier === 'SIMP_ELITE' ? me.tier : 'FREE') as 'FREE' | 'SIMP_PLUS' | 'SIMP_ELITE',
            status: (me.status === 'ACTIVE' || me.status === 'GRACE_PERIOD' || me.status === 'EXPIRED' || me.status === 'REVOKED' ? me.status : 'ACTIVE') as 'ACTIVE' | 'GRACE_PERIOD' | 'EXPIRED' | 'REVOKED',
            expiresAt: me.expiresAt,
          },
        });
        setSuccess(`Restored ${restored.restored} subscription${restored.restored === 1 ? '' : 's'}.`);
        void track('purchase_restored', { count: restored.restored });
      } else {
        setSuccess('No active subscriptions were found for this account.');
      }
    } catch (e) {
      setError((e as Error).message ?? 'Restore did not complete.');
    } finally {
      setRestoring(false);
    }
  }

  async function handleRefresh() {
    // Re-validate whatever entitlement is on file against the App Store.
    setError(null);
    try {
      const ent = await getMyEntitlement();
      // We don't have the originalTransactionId in the UI; the
      // entitlement row has it but our type is loose. Call refresh
      // via the typed API when we have it.
      if (ent.entitlements && ent.entitlements.length > 0) {
        const id = (ent.entitlements[0] as Record<string, unknown>).originalTransactionId as string | undefined;
        if (id) {
          await refreshAppleEntitlement({ originalTransactionId: id });
        }
      }
      const me = await getMyEntitlement();
      setUser({
        ...user!,
        entitlement: {
          tier: (me.tier === 'SIMP_PLUS' || me.tier === 'SIMP_ELITE' ? me.tier : 'FREE') as 'FREE' | 'SIMP_PLUS' | 'SIMP_ELITE',
          status: (me.status === 'ACTIVE' || me.status === 'GRACE_PERIOD' || me.status === 'EXPIRED' || me.status === 'REVOKED' ? me.status : 'ACTIVE') as 'ACTIVE' | 'GRACE_PERIOD' | 'EXPIRED' | 'REVOKED',
          expiresAt: me.expiresAt,
        },
      });
    } catch (e) {
      setError((e as Error).message ?? 'Refresh failed.');
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-ink-950 text-white">
      <div className="absolute inset-0 bg-ink-radial pointer-events-none" />
      <NavHeader title="SIMP+ &amp; Elite" alwaysCompact showBack />
      <main className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col px-6 pt-2 pb-safe">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="py-6"
        >
          <h1 className="display-heading text-3xl font-light">Take it further</h1>
          <div className="gold-divider mt-4 !mx-0" />
          <p className="mt-4 text-sm text-white/70">
            {user?.entitlement?.tier === 'FREE'
              ? 'You\'re on the free plan. Upgrade for unlimited likes, advanced filters, and priority placement.'
              : `You're on ${user?.entitlement?.tier ?? 'FREE'}. Manage your subscription below.`}
          </p>

          {error && (
            <p className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300" role="alert">
              {error}
            </p>
          )}
          {success && (
            <p className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200" role="status">
              {success}
            </p>
          )}

          {catalog === 'loading' && (
            <div className="mt-10 space-y-4">
              <div className="h-40 animate-pulse rounded-2xl bg-white/[0.04]" />
              <div className="h-40 animate-pulse rounded-2xl bg-white/[0.04]" />
            </div>
          )}

          {catalog === 'ready' && (
            <div className="mt-10 space-y-6">
              <ProductCard
                tier="SIMP_PLUS"
                product={products.plus[0]}
                bullets={features.SIMP_PLUS}
                purchasing={purchasing === products.plus[0]?.productId}
                onPurchase={() => handlePurchase(products.plus[0]!)}
                current={user?.entitlement?.tier === 'SIMP_PLUS'}
              />
              <ProductCard
                tier="SIMP_ELITE"
                product={products.elite[0]}
                bullets={features.SIMP_ELITE}
                purchasing={purchasing === products.elite[0]?.productId}
                onPurchase={() => handlePurchase(products.elite[0]!)}
                current={user?.entitlement?.tier === 'SIMP_ELITE'}
              />
            </div>
          )}

          {catalog === 'error' && (
            <p className="mt-10 text-sm text-white/60">
              We couldn't load subscription options. Check your connection and try again.
            </p>
          )}

          <div className="mt-10 rounded-2xl border border-white/10 bg-ink-900/40 p-5">
            <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-gold-300">
              Manage subscription
            </h2>
            <p className="mt-2 text-xs text-white/60">
              Cancel, change plan, or update payment in the App Store. SIMP doesn't store your payment info.
            </p>
            <div className="mt-4 grid gap-2">
              <Button variant="gold-outline" onClick={handleRestore} loading={restoring}>
                Restore purchases
              </Button>
              <Button variant="ghost" onClick={handleRefresh}>
                Refresh status
              </Button>
              <a
                href={appleSubscriptionManagementUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="text-center text-xs text-white/60 underline-offset-4 hover:text-gold-200 hover:underline"
              >
                Manage in App Store ↗
              </a>
            </div>
          </div>

          <p className="mt-6 text-center text-[10px] text-white/40">
            Payment processed by Apple's App Store. Auto-renews unless cancelled at least 24 hours before
            the end of the current period. Manage subscriptions in App Store Settings.
          </p>
        </motion.div>
      </main>
    </div>
  );
}

function ProductCard({
  tier,
  product,
  bullets,
  purchasing,
  onPurchase,
  current,
}: {
  tier: 'SIMP_PLUS' | 'SIMP_ELITE';
  product: PurchaseProduct | undefined;
  bullets: string[];
  purchasing: boolean;
  onPurchase: () => void;
  current: boolean;
}) {
  if (!product) return null;
  const isElite = tier === 'SIMP_ELITE';
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: isElite ? 0.1 : 0 }}
      className={`relative overflow-hidden rounded-2xl border p-5 ${
        isElite
          ? "border-gold-400/45 bg-gradient-to-br from-gold-500/18 via-gold-400/10 to-transparent shadow-glow"
          : "border-white/15 bg-ink-900/40"
      }`}
    >
      {isElite && (
        <>
          <div className="absolute right-4 top-4 rounded-full bg-gold-400 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-950">
            Best value
          </div>
          <div className="absolute -right-10 -top-12 h-40 w-40 rounded-full bg-gold-400/15 blur-3xl" />
        </>
      )}
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-300">
        {isElite ? "SIMP ELITE" : "SIMP+"}
      </p>
      <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-white/45">{product.displayName}</p>
      <h3 className="display-heading mt-3 text-2xl font-light text-white">
        {isElite ? "Be the one they meet first." : "Show up more often."}
      </h3>
      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-3xl font-light">${product.displayPriceUsd.toFixed(2)}</span>
        <span className="text-sm text-white/60">{product.displayPeriod}</span>
      </div>
      <ul className="mt-4 space-y-1.5">
        {bullets.map((bullet, idx) => (
          <li key={idx} className="flex items-start gap-2 text-sm text-white/80">
            <span className={`mt-1 inline-block h-1.5 w-1.5 flex-none rounded-full ${isElite ? "bg-gold-300" : "bg-gold-400"}`} />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
      <div className="mt-5">
        {current ? (
          <div className="rounded-xl bg-emerald-500/15 px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">
            Current plan
          </div>
        ) : (
          <Button onClick={onPurchase} loading={purchasing} className="w-full">
            {purchasing ? 'Opening App Store…' : `Subscribe — ${product.displayName}`}
          </Button>
        )}
      </div>
    </motion.div>
  );
}
