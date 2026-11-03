import { io, type Socket } from 'socket.io-client';
import { API_BASE_URL, getAccessToken, refreshAccessToken } from '../api/client';

let socket: Socket | null = null;
let tokenListenerInstalled = false;

export function isTokenExpired(token: string): boolean {
  try {
    const part = token.split('.')[1];
    if (!part) return true;
    const payload = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp !== 'number' || !Number.isFinite(payload.exp) || payload.exp * 1000 <= Date.now();
  } catch { return true; }
}

export function getRealtimeSocket(): Socket {
  const token = getAccessToken();
  if (!socket) {
    socket = io(API_BASE_URL, {
      path: '/socket.io',
      auth: { token },
      autoConnect: false,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 8,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5_000,
    });
    socket.io.on('reconnect_attempt', () => {
      if (socket) socket.auth = { token: getAccessToken() };
    });
    socket.on('connect_error', (err) => {
      const current = getAccessToken();
      if (current && isTokenExpired(current)) void refreshAccessToken();
      else console.error('[realtime] connect_error:', err.message);
    });
  }
  socket.auth = { token };
  if (!socket.connected) socket.connect();

  if (!tokenListenerInstalled) {
    tokenListenerInstalled = true;
    window.addEventListener('simp:token', ((event: CustomEvent<{ accessToken: string | null }>) => {
      if (!socket) return;
      const previous = (socket.auth as { token?: string | null }).token;
      socket.auth = { token: event.detail.accessToken };
      if (!event.detail.accessToken) socket.disconnect();
      else if (previous !== event.detail.accessToken || !socket.connected) {
        socket.disconnect();
        socket.connect();
      }
    }) as EventListener);
  }
  return socket;
}

export function disconnectRealtime() {
  socket?.disconnect();
  socket = null;
}
