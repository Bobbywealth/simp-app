import { afterEach, describe, expect, it, vi } from 'vitest';

const originalEnv = { ...process.env };

function applyBaseEnv(overrides: Record<string, string | undefined> = {}) {
  process.env = {
    ...originalEnv,
    NODE_ENV: 'production',
    PORT: '4000',
    APP_VERSION: 'test',
    ALLOWED_ORIGINS: 'https://mysimp.com',
    DATABASE_URL: 'postgresql://simp_user:secret@localhost:5432/simp_test',
    JWT_ACCESS_SECRET: 'a'.repeat(32),
    JWT_REFRESH_SECRET: 'b'.repeat(32),
    IP_HASH_SECRET: 'c'.repeat(16),
    PUBLIC_BASE_URL: 'https://api.mysimp.com',
    FRONTEND_URL: 'https://mysimp.com',
    STORAGE_PROVIDER: 'local',
    EMAIL_PROVIDER: 'console',
    PUSH_PROVIDER: 'disabled',
    ...overrides,
  };
  delete process.env.__SIMP_PROD_WARNINGS__;
}

afterEach(() => {
  process.env = { ...originalEnv };
  delete process.env.__SIMP_PROD_WARNINGS__;
  vi.resetModules();
});

describe('production environment validation', () => {
  it('surfaces degraded feature warnings when optional providers are not configured', async () => {
    applyBaseEnv();

    const mod = await import('../src/config/env.js');

    expect(mod.env.NODE_ENV).toBe('production');
    expect(mod.productionWarnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('photo_storage'),
        expect.stringContaining('email'),
        expect.stringContaining('live_streaming'),
        expect.stringContaining('push'),
      ]),
    );
  });

  it('stays warning-free when all optional production providers are configured', async () => {
    applyBaseEnv({
      STORAGE_PROVIDER: 'cloudinary',
      CLOUDINARY_CLOUD_NAME: 'simp-cloud',
      CLOUDINARY_API_KEY: 'cloudinary-key',
      CLOUDINARY_API_SECRET: 'cloudinary-secret',
      EMAIL_PROVIDER: 'resend',
      EMAIL_FROM: 'hello@mysimp.com',
      RESEND_API_KEY: 'resend-key',
      PUSH_PROVIDER: 'firebase',
      FIREBASE_SERVICE_ACCOUNT_JSON: '{"project_id":"simp"}',
      TURN_PROVIDER: 'manual',
      TURN_URLS: 'turn:turn.mysimp.com:3478?transport=udp',
      TURN_USERNAME: 'simp-turn',
      TURN_CREDENTIAL: 'turn-secret',
    });

    const mod = await import('../src/config/env.js');

    expect(mod.productionWarnings).toEqual([]);
  });
});
