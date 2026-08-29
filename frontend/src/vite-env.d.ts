/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_APP_VERSION: string;
  readonly VITE_SENTRY_DSN?: string;
  /**
   * App Store Connect "Services ID" or "App ID" used as the audience
   * claim for Sign in with Apple. Required for App Store compliance.
   * When this is unset the Apple button is hidden.
   */
  readonly VITE_APPLE_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
