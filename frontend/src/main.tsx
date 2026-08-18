import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { initNative } from './capacitor';
import './styles/globals.css';

// Initialize Capacitor native bridge before React mounts. No-op on web.
void initNative();

// PWA: when a new service worker is waiting, dispatch a custom event the app can react to.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).then((reg) => {
      function tryUpdate() {
        if (reg.waiting) {
          window.dispatchEvent(new Event('pwa:update'));
        }
      }
      // Check on every page load
      tryUpdate();
      // Listen for new SWs
      reg.addEventListener('updatefound', () => {
        const newSw = reg.installing;
        if (!newSw) return;
        newSw.addEventListener('statechange', () => {
          if (newSw.state === 'installed' && navigator.serviceWorker.controller) {
            tryUpdate();
          }
        });
      });
      // Also poll periodically while the app is open
      setInterval(() => reg.update().catch(() => null), 60 * 60 * 1000);
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
