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

    const user = await prisma.user.upsert({
      where: { email: input.email },
      update: {
        emailVerified: true,
        emailVerifiedAt: new Date(),
        ageConfirmedAt: new Date(),
        ageConfirmedIp: '127.0.0.1',
        onboardingStep: 7,
        onboardingCompletedAt: new Date(),
        onboardingState: {},
      },
      create: {
        email: input.email,
        // The caller knows the password; we generate a dummy hash and
        // update it below.
        passwordHash: 'pending-demo-setup',
        emailVerified: true,
        emailVerifiedAt: new Date(),
        ageConfirmedAt: new Date(),
        ageConfirmedIp: '127.0.0.1',
        onboardingState: { displayName: input.displayName },
        onboardingStep: 7,
        onboardingCompletedAt: new Date(),
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

    // Profile.
    await prisma.profile.upsert({
      where: { userId: user.id },
      update: {
        displayName: input.displayName,
        bio:
          'Demo account for App Store reviewers. Complete, verified, ' +
          'premium SIMP profile. Match with me, send me a message, ' +
          'browse my photos.',
        birthDate: new Date(input.birthDate),
        gender: 'WOMAN',
        lookingFor: 'MEN',
        city: input.city,
        occupation: input.occupation,
        heightCm: input.heightCm ?? null,
        isVerified: true,
        verificationStatus: 'APPROVED',
        profileCompletedAt: new Date(),
        isPremium: true,
      },
      create: {
        userId: user.id,
        displayName: input.displayName,
        bio:
          'Demo account for App Store reviewers. Complete, verified, ' +
          'premium SIMP profile. Match with me, send me a message, ' +
          'browse my photos.',
        birthDate: new Date(input.birthDate),
        gender: 'WOMAN',
        lookingFor: 'MEN',
        city: input.city,
        occupation: input.occupation,
        heightCm: input.heightCm ?? null,
        isVerified: true,
        verificationStatus: 'APPROVED',
        profileCompletedAt: new Date(),
        isPremium: true,
      },
    });

    // Photos.
    await prisma.photo.deleteMany({ where: { userId: user.id } });
    await prisma.photo.createMany({
      data: [
        {
          userId: user.id,
          url: 'https://mysimp.app/icons/icon-512.png',
          position: 0,
          width: 512,
          height: 512,
          bytes: 19638,
          mimeType: 'image/png',
        },
        {
          userId: user.id,
          url: 'https://mysimp.app/screenshots/desktop-wide.png',
          position: 1,
          width: 1920,
          height: 1080,
          bytes: 561928,
          mimeType: 'image/png',
        },
      ],
    });

    // SIMP+ entitlement for one year.
    await prisma.entitlement.deleteMany({
      where: { userId: user.id, transactionId: 'demo-account-active-entitlement' },
    });
    await prisma.entitlement.create({
      data: {
        userId: user.id,
        tier: 'SIMP_PLUS',
        status: 'ACTIVE',
        platform: 'APPLE',
        productId: 'app.simp.plus.monthly',
        transactionId: 'demo-account-active-entitlement',
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        autoRenewing: false,
        environment: 'Production',
        receiptHash: 'demo-no-receipt',
        lastVerifiedAt: new Date(),
      },
    });

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
