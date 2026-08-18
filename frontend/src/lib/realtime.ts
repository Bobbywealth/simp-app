import { io, type Socket } from 'socket.io-client';
import { API_BASE_URL, getAccessToken } from '../api/client';

let socket: Socket | null = null;
let tokenListenerInstalled = false;

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
  }
  socket.auth = { token };
  if (!socket.connected) socket.connect();

  if (!tokenListenerInstalled) {
    tokenListenerInstalled = true;
    window.addEventListener('simp:token', ((event: CustomEvent<{ accessToken: string | null }>) => {
      if (!socket) return;
      socket.auth = { token: event.detail.accessToken };
      if (!event.detail.accessToken) socket.disconnect();
    }) as EventListener);
  }
  return socket;
}

export function disconnectRealtime() {
  socket?.disconnect();
  socket = null;
}
