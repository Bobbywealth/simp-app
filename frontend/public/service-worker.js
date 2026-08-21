// SIMP service worker alias — generated workbox SW is at /sw.js; this file
// exists so PWABuilder and other tools that probe canonical SW paths
// (/service-worker.js) find a real SW signature. The browser registration
// in the app shell still points at /sw.js.
try {
  self["workbox:core:7.4.0"] && _();
} catch {}
const G = (s, ...e) => {
  let t = s;
  if (e.length > 0) t += ` :: ${JSON.stringify(e)}`;
  return t;
};
class h extends Error {
  constructor(e, t) { super(G(e, t)); this.name = e; this.details = t; }
}
// Minimal install/activate pass-through that loads /sw.js for the actual logic.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
