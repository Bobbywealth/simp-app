// LiveKit Cloud usage monitoring. Hits the LiveKit Cloud REST API once a
// day, snapshots participant-minute + storage + egress usage into
// `livekitUsageSnapshots`, and surfaces the headroom on
// /health/ready.degradedFeatures so the admin page can flag it.
//
// Requires LIVEKIT_API_KEY + LIVEKIT_API_SECRET (same creds as the
// server SDK uses). If those aren't set, this module is a no-op.

import type { LivekitConfig } from './livekit.service.js';
import { prisma } from '../config/db.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import jwt from 'jsonwebtoken';

export interface LivekitUsageSummary {
  participantMinutes: number;
  participantMinutesLimit: number;
  recordingStorageGb: number;
  recordingStorageLimitGb: number;
  egressGb: number;
  egressLimitGb: number;
  planName: string | null;
  fetchedAt: string;
}

export const LIVEKIT_FREE_TIER = {
  participantMinutes: 10_000,
  recordingStorageGb: 50,
  egressGb: 100,
} as const;

interface CloudUsagePayload {
  participantMinutes?: number | { used: number; limit: number };
  storageGb?: number | { used: number; limit: number };
  egressGb?: number | { used: number; limit: number };
  plan?: { name?: string } | string;
}

function unwrap(value: unknown): { used: number; limit: number } {
  if (typeof value === 'number') return { used: value, limit: 0 };
  if (value && typeof value === 'object') {
    const v = value as { used?: number; limit?: number };
    return { used: Number(v.used ?? 0), limit: Number(v.limit ?? 0) };
  }
  return { used: 0, limit: 0 };
}

/**
 * Mint a short-lived JWT for LiveKit Cloud REST APIs. Same shape as the
 * server SDK uses (ES256, issuer = API key id, audience = 'livekit-cloud'
 * or 'cloud', 5-minute expiry).
 */
function mintLivekitCloudToken(): string {
  const key = env.LIVEKIT_API_KEY!;
  const secret = env.LIVEKIT_API_SECRET!;
  return jwt.sign({}, secret, {
    algorithm: 'ES256',
    issuer: key,
    audience: 'livekit-cloud',
    expiresIn: '5m',
    keyid: key,
    header: { alg: 'ES256', typ: 'JWT', kid: key },
  });
}

/**
 * LiveKit Cloud exposes a private API for usage that requires a JWT
 * signed with the same API key/secret used for rooms. We mint a short-lived
 * bearer token and hit /usage. Returns null when LiveKit isn't configured
 * or the request fails (e.g. self-hosted server returns 404 — handled
 * gracefully).
 */
export async function fetchLivekitUsage(
  config: LivekitConfig,
): Promise<LivekitUsageSummary | null> {
  if (!env.LIVEKIT_API_KEY || !env.LIVEKIT_API_SECRET) return null;
  try {
    const httpHost = config.url
      .replace(/^wss:\/\//, 'https://')
      .replace(/\/+$/, '');
    const token = mintLivekitCloudToken();
    const response = await fetch(`${httpHost}/usage`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      logger.warn({
        event: 'livekit_usage_unavailable',
        status: response.status,
        host: httpHost,
      });
      return null;
    }
    const body = (await response.json()) as CloudUsagePayload;
    const participant = unwrap(body.participantMinutes);
    const storage = unwrap(body.storageGb);
    const egress = unwrap(body.egressGb);
    return {
      participantMinutes: participant.used,
      participantMinutesLimit: participant.limit,
      recordingStorageGb: storage.used,
      recordingStorageLimitGb: storage.limit,
      egressGb: egress.used,
      egressLimitGb: egress.limit,
      planName: typeof body.plan === 'string' ? body.plan : body.plan?.name ?? null,
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.warn({
      event: 'livekit_usage_fetch_failed',
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Run a daily snapshot. Persists to livekitUsageSnapshots so we can plot
 * usage over time; writes the latest reading into a process-wide cache
 * that /health/ready consumes for degradedFeatures.
 */
let lastSummary: LivekitUsageSummary | null = null;
export function lastLivekitUsage(): LivekitUsageSummary | null {
  return lastSummary;
}

export async function snapshotLivekitUsage(): Promise<LivekitUsageSummary | null> {
  const config = await import('./livekit.service.js').then((m) => m.livekitPublicConfig());
  if (!config) return null;
  const summary = await fetchLivekitUsage(config);
  if (!summary) return null;
  lastSummary = summary;
  try {
    await prisma.livekitUsageSnapshot.create({
      data: {
        participantMinutes: summary.participantMinutes,
        participantMinutesLimit: summary.participantMinutesLimit,
        recordingStorageGb: summary.recordingStorageGb,
        recordingStorageLimitGb: summary.recordingStorageLimitGb,
        egressGb: summary.egressGb,
        egressLimitGb: summary.egressLimitGb,
        planName: summary.planName,
      },
    });
  } catch (error) {
    logger.warn({
      event: 'livekit_usage_snapshot_failed',
      message: error instanceof Error ? error.message : String(error),
    });
  }
  return summary;
}

/**
 * Returns the highest tier we hit against the free tier thresholds.
 * 0 = under 50%, 1 = 50-80%, 2 = 80-95%, 3 = over 95% (or over any single
 * metric). Used by /health/ready and the admin page.
 */
export type UsageBand = 0 | 1 | 2 | 3;

export function bandFor(summary: LivekitUsageSummary): UsageBand {
  const ratios = [
    summary.participantMinutesLimit > 0
      ? summary.participantMinutes / summary.participantMinutesLimit
      : 0,
    summary.recordingStorageLimitGb > 0
      ? summary.recordingStorageGb / summary.recordingStorageLimitGb
      : 0,
    summary.egressLimitGb > 0 ? summary.egressGb / summary.egressLimitGb : 0,
  ];
  const peak = ratios.reduce((max, ratio) => (ratio > max ? ratio : max), 0);
  if (peak >= 0.95) return 3;
  if (peak >= 0.8) return 2;
  if (peak >= 0.5) return 1;
  return 0;
}

/**
 * 1-line human label of how close we are to the LiveKit Cloud free tier.
 * Used by /health/ready.degradedFeatures and the admin page.
 */
export function summarizeBand(summary: LivekitUsageSummary): string {
  const parts: string[] = [];
  const push = (label: string, used: number, limit: number) => {
    if (limit <= 0) return;
    const pct = Math.round((used / limit) * 100);
    parts.push(`${label} ${used}/${limit} (${pct}%)`);
  };
  push('participant-minutes', summary.participantMinutes, summary.participantMinutesLimit);
  push('recording-GB', summary.recordingStorageGb, summary.recordingStorageLimitGb);
  push('egress-GB', summary.egressGb, summary.egressLimitGb);
  if (parts.length === 0) return 'livekit: usage summary not available';
  return `livekit ${summary.planName ?? 'free tier'} usage — ${parts.join(', ')}`;
}

/**
 * Start the daily LiveKit usage cron. Runs ~15s after server boot to
 * catch the first deploy, then once a day.
 */
export function startLivekitUsageWorker() {
  const run = () => void snapshotLivekitUsage().catch((error: unknown) => {
    logger.error({
      event: 'livekit_usage_worker_failed',
      message: error instanceof Error ? error.message : String(error),
    });
  });
  const first = setTimeout(run, 15_000);
  first.unref();
  const interval = setInterval(run, 24 * 60 * 60_000);
  interval.unref();
}
