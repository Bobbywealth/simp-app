import { apiFetch } from './client';

export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface IceConfig {
  iceServers: IceServer[];
  /// `true` when at least one TURN entry is included. Lets the UI show
  /// a banner when not — most cross-network viewers will fail to connect
  /// without TURN.
  turnConfigured: boolean;
  /// Optional human-readable label (e.g. "twilio") for debugging.
  turnProvider: string | null;
  /// Human-readable warning when TURN is missing, ready to surface in UI.
  recommendation: string | null;
}

/// In-memory cache so we only fetch ICE config once per page load.
let cache: IceConfig | null = null;
let inflight: Promise<IceConfig> | null = null;

export async function getIceConfig(): Promise<IceConfig> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = apiFetch<IceConfig>('/config/ice-servers')
    .then((cfg) => {
      cache = cfg;
      inflight = null;
      return cfg;
    })
    .catch((e) => {
      inflight = null;
      throw e;
    });
  return inflight;
}
