// Seed the App Store demo account `review@sim-p.app`. Idempotent.
//
// We can't use Prisma directly on Bobby's 16 GB Mac (the engine library
// fails to load due to system policy), so this script talks to Postgres
// over the plain pg client. Run via: `npm run seed:demo-account`.

import { Client } from 'pg';

const DATABASE_URL =
  process.env.SMOKE_DATABASE_URL ??
  process.env.DATABASE_URL ??
  'postgresql://simp_user:UgMMICMFI9Ta6WV6F2MKjUCowggzxr31@dpg-d9pnemr9ik0c73c9hg5g-a:5432/simp_app_33gb';

const DEMO_EMAIL = 'review@sim-p.app';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  // 1. Make sure the user exists; create via HTTP /auth/signup so bcrypt
  //    hash + onboarding defaults all line up. This script assumes the
  //    signup step ran first (the bash wrapper does both).
  const { rows: existing } = await client.query(
    `SELECT id FROM "User" WHERE email = $1`,
    [DEMO_EMAIL],
  );
  if (existing.length === 0) {
    throw new Error(
      `User ${DEMO_EMAIL} not found. Run the signup step in seed-demo-account.sh first.`,
    );
  }
  const userId = existing[0].id as string;
  console.log(`[user] ${userId}`);

  // 2. Force-verify email + complete onboarding + age confirmation.
  await client.query(
    `UPDATE "User"
       SET "emailVerified" = true,
           "emailVerifiedAt" = NOW(),
           "ageConfirmedAt" = NOW(),
           "ageConfirmedIp"  = '127.0.0.1',
           "onboardingStep" = 7,
           "onboardingCompletedAt" = NOW(),
           "onboardingState" = '{}'::jsonb
     WHERE id = $1`,
    [userId],
  );
  console.log('[user] force-verified + onboarding complete');

  // 3. Upsert a complete, verified, blue-badged profile.
  await client.query(
    `INSERT INTO "Profile" (
        "id", "userId", "displayName", "bio", "birthDate",
        "gender", "lookingFor", "city", "occupation", "heightCm",
        "isVerified", "verificationStatus", "profileCompletedAt",
        "createdAt", "updatedAt"
      ) VALUES (
        'prm_demo_' || substr(md5(random()::text), 1, 24), $1,
        'Apple Reviewer',
        'Demo account for App Store reviewers. Complete, verified SIMP profile. Match with me, send me a message, browse my photos.',
        DATE '1995-01-15',
        'WOMAN'::"Gender", 'MEN'::"LookingFor",
        'New York, NY', 'Product designer', 170,
        true, 'APPROVED'::"VerificationStatus", NOW(),
        NOW(), NOW()
      )
      ON CONFLICT ("userId") DO UPDATE
      SET "isVerified" = EXCLUDED."isVerified",
          "verificationStatus" = EXCLUDED."verificationStatus",
          "profileCompletedAt" = EXCLUDED."profileCompletedAt",
          "bio" = EXCLUDED."bio",
          "city" = EXCLUDED."city",
          "occupation" = EXCLUDED."occupation",
          "heightCm" = EXCLUDED."heightCm"`,
    [userId],
  );
  console.log('[profile] complete + verified + blue badge');

  // 4. Add a couple of placeholder photos pointing at brand assets.
  await client.query(`DELETE FROM "Photo" WHERE "userId" = $1`, [userId]);
  await client.query(
    `INSERT INTO "Photo"
       ("id", "userId", "url", "position", "width", "height", "bytes", "mimeType", "createdAt", "updatedAt")
     VALUES
       ('pho_demo_' || substr(md5(random()::text), 1, 22), $1,
        'https://mysimp.com/icons/icon-512.png', 0, 512, 512, 19638, 'image/png', NOW(), NOW()),
       ('pho_demo_' || substr(md5(random()::text), 1, 22), $1,
        'https://mysimp.com/screenshots/desktop-wide.png', 1, 1920, 1080, 561928, 'image/png', NOW(), NOW())`,
    [userId],
  );
  console.log('[photos] 2');

  console.log('\n✅ Demo account ready for App Store review');
  console.log('   Email:    review@sim-p.app');
  console.log('   Password: AppleReview2026!');
  console.log('   Verified: yes (blue badge)');
  console.log('   Tier:     SIMP is fully free — no premium tier');

  await client.end();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
