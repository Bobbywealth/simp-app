/**
 * Idempotent seed for legal documents (ToS + Privacy Policy).
 *
 * On every startup, ensures that the configured versions exist in the
 * `TosVersion` table. New versions are inserted; existing versions are
 * untouched so we keep the historical record of what each user agreed to.
 *
 * To roll out a new version: append a row to `LEGAL_DOCUMENTS` with a
 * higher `version` string. Users who already accepted the old version
 * will be re-prompted for the new one on their next stream attempt
 * (enforced by `requireLegalCompliance` middleware).
 *
 * Defensive: if the legal tables don't yet exist (e.g. the migration
 * hasn't run yet — should not happen in prod once the build command
 * includes `prisma migrate deploy`, but a safety net during early
 * rollout), logs a warning and returns without crashing the server.
 * The `/legal/*` endpoints will still 500 until the migration runs,
 * but the rest of the app stays up.
 */
import { prisma } from '../config/db.js';
import { LEGAL_DOCUMENTS } from './legalContent.js';

export async function seedLegalDocuments(): Promise<void> {
  for (const doc of LEGAL_DOCUMENTS) {
    try {
      const existing = await prisma.tosVersion.findUnique({
        where: { type_version: { type: doc.type, version: doc.version } },
      });
      if (existing) continue;
      await prisma.tosVersion.create({
        data: {
          type: doc.type,
          version: doc.version,
          summary: doc.summary,
          content: doc.content,
          effectiveAt: doc.effectiveAt,
        },
      });
      console.log(`[legal] seeded ${doc.type} v${doc.version}`);
    } catch (e) {
      // P2021 = table does not exist (migration hasn't run yet).
      // Log and continue — don't crash the server on first boot.
      const err = e as { code?: string; meta?: { table?: string } };
      if (err.code === 'P2021' || /does not exist/i.test((e as Error).message)) {
        console.warn(
          `[legal] Skipping seed for ${doc.type} v${doc.version}: table ${err.meta?.table ?? 'TosVersion'} does not exist. Run \`prisma migrate deploy\` to apply pending migrations.`
        );
        return;
      }
      throw e;
    }
  }
}
