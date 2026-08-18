import type { Server } from 'socket.io';

let realtimeServer: Server | null = null;

export function setRealtimeServer(server: Server) {
  realtimeServer = server;
}

export function getRealtimeServer() {
  return realtimeServer;
}
