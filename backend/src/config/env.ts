import 'dotenv/config';
import { z } from 'zod';

const booleanFromString = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true');

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    APP_VERSION: z.string().default('0.3.0-rc.1'),
    ALLOWED_ORIGINS: z.string().default('http://localhost:5173'),
    DATABASE_URL: z.string().url('DATABASE_URL must be a PostgreSQL URL'),
    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 chars'),
    JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 chars'),
    JWT_ACCESS_TTL: z.string().regex(/^\d+[smhd]$/).default('15m'),
    JWT_REFRESH_TTL: z.string().regex(/^\d+[smhd]$/).default('30d'),
    IP_HASH_SECRET: z.string().min(16).optional(),
    PUBLIC_BASE_URL: z.string().url().default('http://localhost:4000'),
    FRONTEND_URL: z.string().url().default('http://localhost:5173'),

    STORAGE_PROVIDER: z.enum(['local', 'cloudinary']).default('local'),
    UPLOAD_DIR: z.string().default('./uploads'),
    CLOUDINARY_CLOUD_NAME: z.string().min(1).optional(),
    CLOUDINARY_API_KEY: z.string().min(1).optional(),
    CLOUDINARY_API_SECRET: z.string().min(1).optional(),
    CLOUDINARY_FOLDER: z.string().default('simp/profile-photos'),

    EMAIL_PROVIDER: z.enum(['disabled', 'console', 'resend', 'webhook']).default('disabled'),
    EMAIL_FROM: z.string().email().optional(),
    RESEND_API_KEY: z.string().min(1).optional(),
    EMAIL_WEBHOOK_URL: z.string().url().optional(),

    PUSH_PROVIDER: z.enum(['disabled', 'firebase']).default('disabled'),
    FIREBASE_SERVICE_ACCOUNT_JSON: z.string().min(1).optional(),

    STUN_URLS: z
      .string()
      .default('stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302'),
    TURN_URLS: z.string().optional(),
    TURN_USERNAME: z.string().optional(),
    TURN_CREDENTIAL: z.string().optional(),
    TURN_PROVIDER: z.string().optional(),

    FREE_DAILY_LIKES: z.coerce.number().int().min(1).max(500).default(25),
    FREE_DAILY_SUPER_LIKES: z.coerce.number().int().min(0).max(50).default(1),
    SIMP_PLUS_PRODUCT_IDS: z.string().default('app.simp.plus.monthly,app.simp.plus.yearly'),
    SIMP_ELITE_PRODUCT_IDS: z.string().default('app.simp.elite.monthly,app.simp.elite.yearly'),
    APPLE_BUNDLE_ID: z.string().default('app.simp.client'),
    APPLE_IAP_ISSUER_ID: z.string().optional(),
    APPLE_IAP_KEY_ID: z.string().optional(),
    APPLE_IAP_PRIVATE_KEY: z.string().optional(),
    GOOGLE_PLAY_PACKAGE_NAME: z.string().default('app.simp.client'),
    GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: z.string().optional(),

    FEATURE_EXPERIENCES: booleanFromString.default('false'),
    SENTRY_DSN: z.string().url().optional(),
    ANALYTICS_ENDPOINT: z.string().url().optional(),
    ANALYTICS_WRITE_KEY: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV !== 'production') return;

    const add = (path: keyof typeof value, message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });

    // Hard-fail security-critical config so a misconfigured deploy never
    // accidentally serves traffic over plain HTTP or with wildcard CORS.
    const origins = value.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim());
    if (origins.includes('*')) add('ALLOWED_ORIGINS', 'Wildcard CORS is forbidden in production');
    if (origins.some((origin) => !origin.startsWith('https://'))) {
      add('ALLOWED_ORIGINS', 'Production CORS origins must use HTTPS');
    }
    if (!value.PUBLIC_BASE_URL.startsWith('https://')) {
      add('PUBLIC_BASE_URL', 'Production public URL must use HTTPS');
    }
    if (!value.FRONTEND_URL.startsWith('https://')) {
      add('FRONTEND_URL', 'Production frontend URL must use HTTPS');
    }

    // Soft warnings for third-party integrations. The service still boots
    // even when these are missing; the affected feature is reported as
    // degraded on /health/degraded. This lets the app come up for smoke
    // tests before any paid service is connected.
    const warnings: string[] = [];
    if (value.STORAGE_PROVIDER !== 'cloudinary') {
      warnings.push('photo_storage: Cloudinary is not configured — uploads will fail until STORAGE_PROVIDER=cloudinary and CLOUDINARY_* are set');
    } else {
      for (const key of ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'] as const) {
        if (!value[key]) warnings.push(`photo_storage: ${key} is required when STORAGE_PROVIDER=cloudinary`);
      }
    }
    if (value.EMAIL_PROVIDER === 'disabled' || value.EMAIL_PROVIDER === 'console') {
      warnings.push(`email: EMAIL_PROVIDER=${value.EMAIL_PROVIDER} — verification and reset links will not be sent`);
    } else if (value.EMAIL_PROVIDER === 'resend' && !value.RESEND_API_KEY) {
      warnings.push('email: RESEND_API_KEY is required when EMAIL_PROVIDER=resend');
    } else if (value.EMAIL_PROVIDER === 'webhook' && !value.EMAIL_WEBHOOK_URL) {
      warnings.push('email: EMAIL_WEBHOOK_URL is required when EMAIL_PROVIDER=webhook');
    } else if (!value.EMAIL_FROM) {
      warnings.push('email: EMAIL_FROM is required for production email delivery');
    }
    if (!value.TURN_URLS || !value.TURN_USERNAME || !value.TURN_CREDENTIAL) {
      warnings.push('live_streaming: TURN credentials are missing — cross-network live stream viewers may see black screens');
    }
    if (value.PUSH_PROVIDER !== 'firebase' || !value.FIREBASE_SERVICE_ACCOUNT_JSON) {
      warnings.push('push: PUSH_PROVIDER is disabled — native push notifications will not be delivered');
    }
    if (warnings.length) {
      // Persist warnings on the parsed result so /health/degraded can
      // surface them. We attach them via a side-channel because Zod
      // superRefine does not allow returning values.
      process.env.__SIMP_PROD_WARNINGS__ = JSON.stringify(warnings);
    }
  });

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // Values are intentionally omitted so secrets can never leak into logs.
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const allowedOrigins = env.ALLOWED_ORIGINS.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

export const productionWarnings: string[] = (() => {
  try {
    const raw = process.env.__SIMP_PROD_WARNINGS__;
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
})();

if (env.NODE_ENV === 'production' && productionWarnings.length) {
  console.warn('[env] Production started with degraded features:');
  for (const warning of productionWarnings) console.warn('  -', warning);
}
