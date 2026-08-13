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
 */
import { prisma } from '../config/db.js';
import { LEGAL_DOCUMENTS } from './legalContent.js';

export async function seedLegalDocuments(): Promise<void> {
  for (const doc of LEGAL_DOCUMENTS) {
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
  }
}
