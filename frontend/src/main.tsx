import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { initNative } from './capacitor';
import { initSentry, SentryErrorBoundary, isSentryActive } from './lib/sentry';
import './styles/globals.css';

// Initialize Sentry before anything else so any errors during init
// get reported. No-op if VITE_SENTRY_DSN is unset.
initSentry();

// Initialize Capacitor native bridge before React mounts. No-op on web.
void initNative();

// Mobile keyboard handling: adjust viewport height when keyboard opens
if (typeof window !== 'undefined') {
  const setVh = () => {
    document.documentElement.style.setProperty('--vh', `${window.visualViewport?.height ?? window.innerHeight}px`);
  };
  window.visualViewport?.addEventListener('resize', setVh);
  setVh();
}

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

// Wrap App with Sentry's ErrorBoundary when Sentry is active; otherwise
// render App directly. Keeps a runtime check so we don't ship the
// boundary to sites without a DSN.
const AppTree = isSentryActive() ? (
  <SentryErrorBoundary fallback={<RootErrorFallback />}>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </SentryErrorBoundary>
) : (
  <BrowserRouter>
    <App />
  </BrowserRouter>
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{AppTree}</React.StrictMode>
);

function RootErrorFallback() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0a0a0a',
        color: '#f5f1ea',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", system-ui, sans-serif',
      }}
    >
      <h1 style={{ fontWeight: 300, fontSize: 28, margin: '0 0 12px' }}>Something went wrong.</h1>
      <p style={{ color: '#a59b87', margin: '0 0 24px', textAlign: 'center', maxWidth: 480 }}>
        We logged the crash and our team will look at it. Please reload the page to try again.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        style={{
          background: '#d4a93a',
          color: '#0a0a0a',
          border: 'none',
          padding: '12px 24px',
          fontSize: 15,
          fontWeight: 500,
          borderRadius: 6,
          cursor: 'pointer',
        }}
      >
        Reload SIMP
      </button>
    </div>
  );
}
