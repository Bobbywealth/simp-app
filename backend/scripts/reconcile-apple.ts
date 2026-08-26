// Daily Apple subscription reconciliation.
//
// Compares each ACTIVE/GRACE_PERIOD Entitlement row against Apple's
// App Store Server API ("Get All Subscription Statuses") for the
// matching originalTransactionId. Discrepancies are surfaced as a
// JSON report and a structured log line. No DB mutations: the actual
// reconciliation happens through persistAppleTransaction (which is
// the same code path the webhook uses), so this script's output is
// the diff.
//
// Usage:
//   SIMP_BASE_URL=https://api.mysimp.com npx tsx scripts/reconcile-apple.ts
// Or via npm:
//   npm run reconcile:apple
//
// Requires APPLE_IAP_ISSUER_ID / APPLE_IAP_KEY_ID / APPLE_IAP_PRIVATE_KEY
// on the host (use the same Render env vars or a local `.env`).

import 'dotenv/config';
import jwt from 'jsonwebtoken';
import { prisma } from '../src/config/db.js';
import { env } from '../src/config/env.js';
import {
  APPLE_API_HOSTS,
  getAppleBearerToken,
  type AppleEnvironment,
} from '../src/services/apple-iap.service.js';

interface ReportRow {
  userId: string;
  originalTransactionId: string;
  status: string;
  expiresAt: string | null;
  reason: string;
  simPriceTier: string | null;
}

async function getAppleStatus(originalTransactionId: string, environment: AppleEnvironment) {
  const bearer = await getAppleBearerToken();
  const url = `${APPLE_API_HOSTS[environment]}/inApps/v1/subscriptions/${encodeURIComponent(originalTransactionId)}`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${bearer}` } });
  if (!response.ok) {
    return { error: `HTTP ${response.status}` };
  }
  const body = (await response.json()) as {
    data?: Array<{ lastTransactions?: Array<Record<string, unknown>> }>;
  };
  const latest = body.data?.[0]?.lastTransactions?.find?.((tx) => {
    return typeof tx === 'object' && tx && 'originalTransactionId' in tx;
  }) as Record<string, unknown> | undefined;
  return { latest };
}

async function main() {
  if (!env.APPLE_IAP_ISSUER_ID || !env.APPLE_IAP_KEY_ID || !env.APPLE_IAP_PRIVATE_KEY) {
    throw new Error('Apple IAP env vars are missing; cannot reconcile.');
  }
  // Mint a token up front so any key problems surface early.
  await jwt.decode(await getAppleBearerToken());

  const rows = await prisma.entitlement.findMany({
    where: { platform: 'APPLE', status: { in: ['ACTIVE', 'GRACE_PERIOD'] } },
    select: {
      id: true,
      userId: true,
      productId: true,
      originalTransactionId: true,
      status: true,
      expiresAt: true,
      environment: true,
    },
  });

  const report: ReportRow[] = [];
  for (const row of rows) {
    if (!row.originalTransactionId) continue;
    const environment = (row.environment === 'Sandbox' ? 'Sandbox' : 'Production') as AppleEnvironment;
    try {
      const apple = await getAppleStatus(row.originalTransactionId, environment);
      if ('error' in apple) {
        report.push({
          userId: row.userId,
          originalTransactionId: row.originalTransactionId,
          status: row.status,
          expiresAt: row.expiresAt?.toISOString() ?? null,
          reason: `apple_lookup_failed:${apple.error}`,
          simPriceTier: row.productId,
        });
        continue;
      }
      const tx = apple.latest;
      if (!tx) {
        report.push({
          userId: row.userId,
          originalTransactionId: row.originalTransactionId,
          status: row.status,
          expiresAt: row.expiresAt?.toISOString() ?? null,
          reason: 'apple_no_transactions',
          simPriceTier: row.productId,
        });
        continue;
      }
      const appleExpires = typeof tx.expiresDate === 'number' ? new Date(tx.expiresDate).toISOString() : null;
      const appleStatus = typeof tx.status === 'number' ? tx.status : null;
      if (appleStatus === 2 /* Apple EXPIRED */ && row.status === 'ACTIVE') {
        report.push({
          userId: row.userId,
          originalTransactionId: row.originalTransactionId,
          status: row.status,
          expiresAt: row.expiresAt?.toISOString() ?? null,
          reason: `mismatch: sim=active apple=expired`,
          simPriceTier: row.productId,
        });
      } else if (row.expiresAt && appleExpires && new Date(appleExpires).getTime() !== row.expiresAt.getTime()) {
        report.push({
          userId: row.userId,
          originalTransactionId: row.originalTransactionId,
          status: row.status,
          expiresAt: row.expiresAt.toISOString(),
          reason: `expires_mismatch: sim=${row.expiresAt.toISOString()} apple=${appleExpires}`,
          simPriceTier: row.productId,
        });
      }
    } catch (error) {
      report.push({
        userId: row.userId,
        originalTransactionId: row.originalTransactionId,
        status: row.status,
        expiresAt: row.expiresAt?.toISOString() ?? null,
        reason: `thrown:${(error as Error).message}`,
        simPriceTier: row.productId,
      });
    }
  }
  console.log(JSON.stringify({ scanned: rows.length, discrepancies: report.length, report }, null, 2));
  if (report.length) {
    process.exitCode = 1;
  }
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error('reconcile-apple failed:', error);
  await prisma.$disconnect().catch(() => undefined);
  process.exitCode = 2;
});
