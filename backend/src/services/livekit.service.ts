// LiveKit Cloud integration for SIMP live streaming.

import {
  AccessToken,
  EgressClient,
  EncodedFileOutput,
  EncodedFileType,
  RoomServiceClient,
  VideoCodec,
  VideoGrant,
  type EncodedOutputs,
} from 'livekit-server-sdk';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';
import { prisma } from '../config/db.js';
import { logger } from '../utils/logger.js';

const roomClient = new RoomServiceClient(
  env.LIVEKIT_URL ?? 'https://invalid.livekit.cloud',
  env.LIVEKIT_API_KEY ?? 'invalid',
  env.LIVEKIT_API_SECRET ?? 'invalid',
);
const egressClient = new EgressClient(
  env.LIVEKIT_URL ?? 'https://invalid.livekit.cloud',
  env.LIVEKIT_API_KEY ?? 'invalid',
  env.LIVEKIT_API_SECRET ?? 'invalid',
);

function assertConfigured() {
  if (!env.LIVEKIT_URL || !env.LIVEKIT_API_KEY || !env.LIVEKIT_API_SECRET) {
    throw new AppError('livekit_not_configured', 503, 'Live streaming is not configured on this server.');
  }
}

export interface LivekitConfig {
  url: string;
  recordingEnabled: boolean;
}

export function livekitPublicConfig(): LivekitConfig | null {
  if (!env.LIVEKIT_URL) return null;
  return {
    url: env.LIVEKIT_URL,
    recordingEnabled: env.LIVEKIT_RECORDING_ENABLED === 'true',
  };
}

export async function issueLiveToken(input: {
  userId: string;
  roomName: string;
  isBroadcaster: boolean;
  displayName: string;
  ttlSeconds?: number;
}): Promise<{ token: string; url: string }> {
  assertConfigured();
  const ttl = Math.min(Math.max(input.ttlSeconds ?? 60 * 60 * 4, 60), 60 * 60 * 8);
  const grant: VideoGrant = {
    room: input.roomName,
    roomJoin: true,
    canPublish: input.isBroadcaster,
    canSubscribe: true,
    canPublishData: true,
    canUpdateOwnMetadata: true,
  };
  const at = new AccessToken(env.LIVEKIT_API_KEY!, env.LIVEKIT_API_SECRET!, {
    identity: input.userId,
    name: input.displayName,
    ttl,
  });
  at.addGrant(grant);
  at.metadata = JSON.stringify({ userId: input.userId, isBroadcaster: input.isBroadcaster });
  const token = await at.toJwt();
  return { token, url: env.LIVEKIT_URL! };
}

export async function startRecording(streamId: string): Promise<string | null> {
  if (env.LIVEKIT_RECORDING_ENABLED !== 'true') return null;
  assertConfigured();
  try {
    // Always write to the default LiveKit Cloud storage. For custom S3
    // buckets, add `LIVEKIT_RECORDING_TEMPLATE` + an S3 EncodedFileOutput
    // — see docs/LIVEKIT_SETUP.md.
    const fileOutput = new EncodedFileOutput({
      fileType: EncodedFileType.MP4,
      filepath: `streams/${streamId}/`,
    });
    const output: EncodedOutputs = { file: fileOutput };
    // Use LiveKit's default 1080p H264 encoding. The deprecated overload
    // accepts the layout + audio/video toggles; we leave encoding preset
    // unset so LiveKit Cloud picks the right profile.
    const egress = await egressClient.startRoomCompositeEgress(
      streamId,
      output,
      'speaker',
      undefined,
      false,
      false,
    );
    await prisma.liveStream.update({
      where: { id: streamId },
      data: { recordingEgressId: egress.egressId, recordingUrl: null },
    });
    logger.info({ event: 'live_recording_started', streamId, egressId: egress.egressId });
    return egress.egressId;
  } catch (error) {
    logger.warn({
      event: 'live_recording_start_failed',
      streamId,
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function stopRecording(streamId: string, egressId?: string | null): Promise<string | null> {
  if (env.LIVEKIT_RECORDING_ENABLED !== 'true') return null;
  try {
    if (egressId) {
      await egressClient.stopEgress(egressId);
    } else {
      const list = await egressClient.listEgress({ roomName: streamId, active: true });
      await Promise.all(
        list.map(async (e) => {
          if (e.egressId) await egressClient.stopEgress(e.egressId).catch(() => undefined);
        }),
      );
    }
    return egressId ?? null;
  } catch (error) {
    logger.warn({
      event: 'live_recording_stop_failed',
      streamId,
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function listRecordings(streamId: string): Promise<Array<{ egressId: string; status: string; location?: string }>> {
  try {
    const egresses = await egressClient.listEgress({ roomName: streamId });
    return egresses
      .filter((e) => e.status === 2 /* COMPLETE */ || e.status === 3 /* FAILED */)
      .map((e) => ({
        egressId: e.egressId ?? '',
        status: e.status === 2 ? 'complete' : 'failed',
        location: (e as { location?: string }).location,
      }));
  } catch {
    return [];
  }
}

export async function deleteRoom(streamId: string): Promise<void> {
  try {
    await roomClient.deleteRoom(streamId);
  } catch {
    // Room may not exist yet; ignore.
  }
}
