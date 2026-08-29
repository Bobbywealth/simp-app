// Demo-account seed endpoint — used to populate the App Store review
// account (`review@sim-p.app`). Only active when the deployment sets
// ENABLE_DEMO_SEED=true. In production this should ALWAYS be false; we
// flip it to true briefly when reseeding the demo account.

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db.js';

export const demoRouter = Router();

const seedSchema = z.object({
  email: z.string().email(),
  password: z.string().min(10),
  displayName: z.string().min(2).max(40),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  city: z.string().max(80),
  occupation: z.string().max(80),
  heightCm: z.number().int().min(120).max(230).optional(),
  gender: z.enum(['WOMAN', 'MAN', 'NONBINARY', 'PREFER_NOT_TO_SAY']).optional(),
  lookingFor: z.enum(['WOMEN', 'MEN', 'EVERYONE']).optional(),
  bio: z.string().max(500).optional(),
  photoUrls: z.array(z.string().url()).max(6).optional(),
  // QA walker mode: account is email-verified but has no profile / no
  // onboarding completed (a true fresh-user state).
  freshUser: z.boolean().optional(),
  // QA edge cases: lets us create unverified, banned, moderator, etc.
  isVerified: z.boolean().optional(),
  role: z.enum(['USER', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN']).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'BANNED', 'DELETED']).optional(),
});

// Only mount the actual handler when the env flag is on. The route is
// still registered so it shows up in route listings, but every call
// returns 404 unless explicitly enabled.
demoRouter.post('/demo/seed', async (req, res, next) => {
  try {
    if (process.env.ENABLE_DEMO_SEED !== 'true') {
      return res.status(404).json({ error: 'not_found' });
    }

    const input = seedSchema.parse(req.body);

    const isFresh = input.freshUser === true;

    const user = await prisma.user.upsert({
      where: { email: input.email },
      update: {
        emailVerified: true,
        emailVerifiedAt: new Date(),
        ageConfirmedAt: isFresh ? null : new Date(),
        ageConfirmedIp: isFresh ? null : '127.0.0.1',
        onboardingStep: isFresh ? 0 : 7,
        onboardingCompletedAt: isFresh ? null : new Date(),
        onboardingState: {},
        role: input.role ?? 'USER',
        status: input.status ?? 'ACTIVE',
      },
      create: {
        email: input.email,
        // The caller knows the password; we generate a dummy hash and
        // update it below.
        passwordHash: 'pending-demo-setup',
        emailVerified: true,
        emailVerifiedAt: new Date(),
        ageConfirmedAt: isFresh ? null : new Date(),
        ageConfirmedIp: isFresh ? null : '127.0.0.1',
        onboardingState: isFresh ? {} : { displayName: input.displayName },
        onboardingStep: isFresh ? 0 : 7,
        onboardingCompletedAt: isFresh ? null : new Date(),
        role: input.role ?? 'USER',
        status: input.status ?? 'ACTIVE',
        notificationPreference: { create: {} },
        discoveryPreference: { create: {} },
      },
    });

    // Now hash the real password and update.
    const bcrypt = await import('bcryptjs');
    const passwordHash = await bcrypt.hash(input.password, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    // Profile. Skipped entirely for fresh-user mode (true new user
    // walks through onboarding to create their own profile).
    if (!isFresh) {
      await prisma.profile.upsert({
        where: { userId: user.id },
        update: {
          displayName: input.displayName,
          bio:
            input.bio ??
            'Demo account for App Store reviewers. Complete, verified ' +
              'SIMP profile. Match with me, send me a message, ' +
              'browse my photos.',
          birthDate: new Date(input.birthDate),
          gender: input.gender ?? 'WOMAN',
          lookingFor: input.lookingFor ?? 'MEN',
          city: input.city,
          occupation: input.occupation,
          heightCm: input.heightCm ?? null,
          isVerified: input.isVerified ?? true,
          verificationStatus: input.isVerified === false ? 'NOT_REQUESTED' : 'APPROVED',
          profileCompletedAt: new Date(),
        },
        create: {
          userId: user.id,
          displayName: input.displayName,
          bio:
            input.bio ??
            'Demo account for App Store reviewers. Complete, verified ' +
              'SIMP profile. Match with me, send me a message, ' +
              'browse my photos.',
          birthDate: new Date(input.birthDate),
          gender: input.gender ?? 'WOMAN',
          lookingFor: input.lookingFor ?? 'MEN',
          city: input.city,
          occupation: input.occupation,
          heightCm: input.heightCm ?? null,
          isVerified: input.isVerified ?? true,
          verificationStatus: input.isVerified === false ? 'NOT_REQUESTED' : 'APPROVED',
          profileCompletedAt: new Date(),
        },
      });
    } else {
      // Fresh-user mode: delete any existing profile so the user goes
      // through onboarding cleanly.
      await prisma.profile.deleteMany({ where: { userId: user.id } });
    }

    // Photos. Skipped for fresh-user mode. Optional photoUrls override
    // the default demo photos.
    await prisma.photo.deleteMany({ where: { userId: user.id } });
    if (!isFresh) {
      const photoList = input.photoUrls ?? [
        'https://mysimp.com/icons/icon-512.png',
        'https://mysimp.com/screenshots/desktop-wide.png',
      ];
      await prisma.photo.createMany({
        data: photoList.map((url, idx) => ({
          userId: user.id,
          url,
          position: idx,
        })),
      });
    }

    res.json({
      ok: true,
      userId: user.id,
      email: user.email,
      message: 'Demo account seeded. Disable ENABLE_DEMO_SEED in the next deploy.',
    });
  } catch (error) {
    next(error);
  }
});
