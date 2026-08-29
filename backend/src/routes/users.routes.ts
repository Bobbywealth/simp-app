import type { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { AppError } from '../utils/errors.js';
import { sanitizeBio, sanitizeDisplayName, sanitizeText } from '../utils/sanitize.js';
import { cloudinaryThumbnailUrl } from '../services/cloudinary.service.js';
import { getProfileCompletion } from '../services/profile-completion.service.js';

export const usersRouter = Router();

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const interestSlugsSchema = z
  .array(z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-_]{0,49}$/))
  .max(10)
  .refine((items) => new Set(items).size === items.length, 'Interests must be unique');

const profileSchema = z.object({
  displayName: z.string().trim().min(2).max(40),
  bio: z.string().trim().max(500).optional().nullable(),
  birthDate: dateSchema,
  gender: z.enum(['WOMAN', 'MAN', 'NONBINARY', 'PREFER_NOT_TO_SAY']),
  lookingFor: z.enum(['WOMEN', 'MEN', 'EVERYONE']),
  city: z.string().trim().max(80).optional().nullable(),
  occupation: z.string().trim().max(80).optional().nullable(),
  heightCm: z.number().int().min(120).max(230).optional().nullable(),
  interestSlugs: interestSlugsSchema.optional(),
  customInterests: z
    .array(
      z
        .string()
        .trim()
        .min(2)
        .max(24)
        .regex(/^[\p{L}\p{N}\s'&\-./]+$/u, { message: 'Letters, numbers, and basic punctuation only.' }),
    )
    .max(3)
    .optional(),
});
const profilePatchSchema = profileSchema.partial();

const promptSchema = z.object({
  question: z.string().trim().min(2).max(120),
  answer: z.string().trim().min(1).max(280),
  position: z.number().int().min(0).max(2).optional(),
});

const preferenceSchema = z
  .object({
    minAge: z.number().int().min(18).max(99).optional(),
    maxAge: z.number().int().min(18).max(99).optional(),
    maxDistanceKm: z.number().int().min(1).max(500).optional().nullable(),
    verifiedOnly: z.boolean().optional(),
    interestSlugs: interestSlugsSchema.optional(),
    locationLat: z.number().min(-90).max(90).optional().nullable(),
    locationLng: z.number().min(-180).max(180).optional().nullable(),
  })
  .refine((value) => value.minAge === undefined || value.maxAge === undefined || value.minAge <= value.maxAge, {
    message: 'Minimum age cannot exceed maximum age',
    path: ['minAge'],
  });

const onboardingStateSchema = z.object({
  displayName: z.string().trim().min(2).max(40).optional(),
  birthDate: dateSchema.optional(),
  gender: z.enum(['WOMAN', 'MAN', 'NONBINARY', 'PREFER_NOT_TO_SAY']).optional(),
  lookingFor: z.enum(['WOMEN', 'MEN', 'EVERYONE']).optional(),
  city: z.string().trim().max(80).optional(),
  occupation: z.string().trim().max(80).optional(),
  heightCm: z.number().int().min(120).max(230).optional(),
  bio: z.string().trim().max(500).optional(),
  interestSlugs: interestSlugsSchema.optional(),
  notificationPromptSeen: z.boolean().optional(),
});

function adultBirthDate(value: string): Date {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new AppError('invalid_birth_date', 400, 'Enter a valid birth date.');
  }
  const today = new Date();
  const cutoff = new Date(Date.UTC(today.getUTCFullYear() - 18, today.getUTCMonth(), today.getUTCDate()));
  const oldest = new Date(Date.UTC(today.getUTCFullYear() - 100, today.getUTCMonth(), today.getUTCDate()));
  if (parsed > cutoff) {
    throw new AppError('age_requirement_not_met', 403, 'You must be at least 18 to use SIMP.');
  }
  if (parsed < oldest) throw new AppError('invalid_birth_date', 400, 'Enter a valid birth date.');
  return parsed;
}

async function replaceInterests(
  tx: Prisma.TransactionClient,
  userId: string,
  slugs: string[],
) {
  const interests = await Promise.all(
    slugs.map((slug) =>
      tx.interest.upsert({
        where: { slug },
        create: {
          slug,
          label: slug.replace(/[-_]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()),
        },
        update: {},
      }),
    ),
  );
  await tx.userInterest.deleteMany({ where: { userId } });
  if (interests.length) {
    await tx.userInterest.createMany({
      data: interests.map((interest) => ({ userId, interestId: interest.id })),
      skipDuplicates: true,
    });
  }
}

async function myProfilePayload(userId: string) {
  const [profile, interests] = await Promise.all([
    prisma.profile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            photos: { orderBy: { position: 'asc' } },
            prompts: { orderBy: { position: 'asc' } },
          },
        },
      },
    }),
    prisma.userInterest.findMany({ where: { userId }, include: { interest: true } }),
  ]);
  if (!profile) return null;
  const completion = await getProfileCompletion(userId);
  return {
    ...profile,
    interests,
    completion,
    customInterests: profile.customInterests ?? [],
    user: {
      ...profile.user,
      photos: profile.user.photos.map((photo) => ({
        ...photo,
        thumbnailUrl: cloudinaryThumbnailUrl(photo.url),
        isPrimary: photo.position === 0,
      })),
    },
  };
}

usersRouter.get('/me/profile', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    res.json(await myProfilePayload(req.userId!));
  } catch (error) {
    next(error);
  }
});

usersRouter.put('/me/profile', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const data = profileSchema.parse(req.body);
    const userId = req.userId!;
    const birthDate = adultBirthDate(data.birthDate);

    await prisma.$transaction(async (tx) => {
      await tx.profile.upsert({
        where: { userId },
        create: {
          userId,
          displayName: sanitizeDisplayName(data.displayName),
          bio: data.bio ? sanitizeBio(data.bio) : null,
          birthDate,
          gender: data.gender,
          lookingFor: data.lookingFor,
          city: data.city ? sanitizeText(data.city) : null,
          occupation: data.occupation ? sanitizeText(data.occupation) : null,
          heightCm: data.heightCm ?? null,
          customInterests: data.customInterests ?? [],
        },
        update: {
          displayName: sanitizeDisplayName(data.displayName),
          bio: data.bio ? sanitizeBio(data.bio) : null,
          birthDate,
          gender: data.gender,
          lookingFor: data.lookingFor,
          city: data.city ? sanitizeText(data.city) : null,
          occupation: data.occupation ? sanitizeText(data.occupation) : null,
          heightCm: data.heightCm ?? null,
          ...(data.customInterests !== undefined ? { customInterests: data.customInterests } : {}),
        },
      });
      if (data.interestSlugs) await replaceInterests(tx, userId, data.interestSlugs);
      await tx.user.update({
        where: { id: userId },
        data: { onboardingStep: { increment: 1 } },
      });
    });

    res.json(await myProfilePayload(userId));
  } catch (error) {
    next(error);
  }
});

usersRouter.patch('/me/profile', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const data = profilePatchSchema.parse(req.body);
    const userId = req.userId!;
    const update: Prisma.ProfileUpdateInput = {};
    if (data.displayName !== undefined) update.displayName = sanitizeDisplayName(data.displayName);
    if (data.bio !== undefined) update.bio = data.bio ? sanitizeBio(data.bio) : null;
    if (data.birthDate !== undefined) update.birthDate = adultBirthDate(data.birthDate);
    if (data.gender !== undefined) update.gender = data.gender;
    if (data.lookingFor !== undefined) update.lookingFor = data.lookingFor;
    if (data.city !== undefined) update.city = data.city ? sanitizeText(data.city) : null;
    if (data.occupation !== undefined) update.occupation = data.occupation ? sanitizeText(data.occupation) : null;
    if (data.heightCm !== undefined) update.heightCm = data.heightCm;
    if (data.customInterests !== undefined) update.customInterests = data.customInterests;

    await prisma.$transaction(async (tx) => {
      const exists = await tx.profile.findUnique({ where: { userId }, select: { id: true } });
      if (!exists) throw new AppError('profile_not_found', 404, 'Create your profile first.');
      if (Object.keys(update).length) await tx.profile.update({ where: { userId }, data: update });
      if (data.interestSlugs) await replaceInterests(tx, userId, data.interestSlugs);
    });
    res.json(await myProfilePayload(userId));
  } catch (error) {
    next(error);
  }
});

usersRouter.get('/me/profile/completion', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    res.json(await getProfileCompletion(req.userId!));
  } catch (error) {
    next(error);
  }
});

usersRouter.get('/me/onboarding', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { onboardingState: true, onboardingStep: true, onboardingCompletedAt: true },
    });
    res.json(user);
  } catch (error) {
    next(error);
  }
});

usersRouter.patch('/me/onboarding', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    // Step max matches TOTAL_STEPS in frontend/src/pages/ProfileSetup.tsx.
    // If you add steps, bump both in lockstep.
    const input = z
      .object({
        step: z.number().int().min(1).max(7),
        state: onboardingStateSchema.partial(),
        // Explicit reset flag wipes the persisted onboardingState and
        // resets onboardingStep to 1. Used by Settings → "Restart
        // onboarding" so a user who wants to redo their profile can do
        // so without leaving orphan fields in the merged JSON.
        reset: z.boolean().optional(),
      })
      .parse(req.body);
    if (input.state.birthDate) adultBirthDate(input.state.birthDate);
    const current = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { onboardingState: true, onboardingStep: true, onboardingCompletedAt: true },
    });

    // Reset path: discard existing JSON, clear completion, restart at step 1.
    if (input.reset) {
      const user = await prisma.user.update({
        where: { id: req.userId! },
        data: {
          onboardingState: {},
          onboardingStep: 1,
          onboardingCompletedAt: null,
        },
        select: { onboardingState: true, onboardingStep: true, onboardingCompletedAt: true },
      });
      return res.json(user);
    }

    const prior =
      current?.onboardingState && typeof current.onboardingState === 'object' && !Array.isArray(current.onboardingState)
        ? (current.onboardingState as Record<string, unknown>)
        : {};
    // Monotonicity guard: the new step must be >= the current step.
    // Users can stay on the same step (re-saving) or advance by 1, but
    // can't jump backward or skip ahead. The frontend always sends
    // `current + 1` after a successful step, so this only fires if a
    // client tries to bypass validation.
    const currentStep = current?.onboardingStep ?? 0;
    const targetStep = Math.max(currentStep, input.step);
    const user = await prisma.user.update({
      where: { id: req.userId! },
      data: {
        onboardingState: { ...prior, ...input.state },
        onboardingStep: targetStep,
      },
      select: { onboardingState: true, onboardingStep: true, onboardingCompletedAt: true },
    });
    res.json(user);
  } catch (error) {
    next(error);
  }
});

usersRouter.post('/me/onboarding/complete', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const userId = req.userId!;
    const [user, completion, currentDocs, acceptances] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { emailVerified: true } }),
      getProfileCompletion(userId),
      prisma.tosVersion.findMany({
        where: { type: { in: ['tos', 'privacy'] } },
        orderBy: { effectiveAt: 'desc' },
        distinct: ['type'],
      }),
      prisma.tosAcceptance.findMany({ where: { userId }, select: { tosVersionId: true } }),
    ]);
    const accepted = new Set(acceptances.map((item) => item.tosVersionId));
    const missing = [
      ...(!user?.emailVerified ? ['emailVerification'] : []),
      ...completion.missing,
      ...currentDocs.filter((doc) => !accepted.has(doc.id)).map((doc) => doc.type),
    ];
    if (missing.length) {
      throw new AppError('onboarding_incomplete', 409, 'Finish each onboarding step first.', {
        details: { missing },
      });
    }
    await prisma.user.update({
      where: { id: userId },
      data: { onboardingCompletedAt: new Date(), onboardingStep: 17, onboardingState: {} },
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

usersRouter.get('/me/discovery-preferences', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const preferences = await prisma.discoveryPreference.upsert({
      where: { userId: req.userId! },
      create: { userId: req.userId! },
      update: {},
    });
    res.json(preferences);
  } catch (error) {
    next(error);
  }
});

usersRouter.patch('/me/discovery-preferences', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const input = preferenceSchema.parse(req.body);
    const existing = await prisma.discoveryPreference.findUnique({ where: { userId: req.userId! } });
    const minAge = input.minAge ?? existing?.minAge ?? 18;
    const maxAge = input.maxAge ?? existing?.maxAge ?? 99;
    if (minAge > maxAge) throw new AppError('invalid_age_range', 400, 'Choose a valid age range.');
    const data = {
      ...input,
      ...(input.locationLat !== undefined
        ? { locationLat: input.locationLat === null ? null : Math.round(input.locationLat * 100) / 100 }
        : {}),
      ...(input.locationLng !== undefined
        ? { locationLng: input.locationLng === null ? null : Math.round(input.locationLng * 100) / 100 }
        : {}),
      ...(input.locationLat !== undefined || input.locationLng !== undefined
        ? { locationPrecisionKm: 2, locationUpdatedAt: new Date() }
        : {}),
    };
    const preferences = await prisma.discoveryPreference.upsert({
      where: { userId: req.userId! },
      create: { userId: req.userId!, minAge, maxAge, ...data },
      update: data,
    });
    res.json(preferences);
  } catch (error) {
    next(error);
  }
});

usersRouter.get('/me/prompts', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    res.json({
      prompts: await prisma.prompt.findMany({
        where: { userId: req.userId! },
        orderBy: { position: 'asc' },
      }),
    });
  } catch (error) {
    next(error);
  }
});

usersRouter.post('/me/prompts', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const userId = req.userId!;
    const input = promptSchema.parse(req.body);
    const count = await prisma.prompt.count({ where: { userId } });
    if (count >= 3) throw new AppError('max_prompts_reached', 409, 'You can add up to 3 prompts.');
    const prompt = await prisma.prompt.create({
      data: {
        userId,
        question: sanitizeText(input.question),
        answer: sanitizeText(input.answer),
        position: input.position ?? count,
      },
    });
    await getProfileCompletion(userId);
    res.status(201).json(prompt);
  } catch (error) {
    next(error);
  }
});

usersRouter.patch('/me/prompts/:id', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const input = promptSchema.partial().parse(req.body);
    const prompt = await prisma.prompt.findUnique({ where: { id: req.params.id } });
    if (!prompt || prompt.userId !== req.userId) {
      throw new AppError('prompt_not_found', 404, 'Prompt not found.');
    }
    const update: Prisma.PromptUpdateInput = {};
    if (input.question !== undefined) update.question = sanitizeText(input.question);
    if (input.answer !== undefined) update.answer = sanitizeText(input.answer);
    if (input.position !== undefined) update.position = input.position;
    res.json(await prisma.prompt.update({ where: { id: prompt.id }, data: update }));
  } catch (error) {
    next(error);
  }
});

// Bulk reorder — client sends the full ordered list of prompt ids; we
// rewrite position values in a single transaction so the UI can drag-to-
// reorder without round-tripping every prompt.
usersRouter.put('/me/prompts/reorder', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const { ids } = z.object({ ids: z.array(z.string().min(1)).min(1).max(3) }).parse(req.body);
    const userId = req.userId!;
    const existing = await prisma.prompt.findMany({
      where: { userId, id: { in: ids } },
      select: { id: true },
    });
    if (existing.length !== ids.length || new Set(ids).size !== ids.length) {
      throw new AppError('invalid_prompt_reorder', 400, 'Send your current prompt ids in the new order.');
    }
    await prisma.$transaction(async (tx) => {
      // pg_advisory_xact_lock keyed on userId prevents two concurrent
      // reorder writes from clobbering each other.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
      await Promise.all(
        ids.map((id, index) =>
          tx.prompt.update({ where: { id }, data: { position: index } }),
        ),
      );
    });
    res.json({
      prompts: await prisma.prompt.findMany({
        where: { userId },
        orderBy: { position: 'asc' },
      }),
    });
  } catch (error) {
    next(error);
  }
});

usersRouter.put('/me/photos/reorder', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const { photoIds } = z.object({ photoIds: z.array(z.string().cuid()).min(1) }).parse(req.body);
    const userId = req.userId!;

    const photos = await prisma.photo.findMany({ where: { id: { in: photoIds } } });
    if (photos.length !== photoIds.length || !photos.every((p) => p.userId === userId)) {
      throw new AppError('photo_not_found', 404, 'Photo not found.');
    }

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
      await Promise.all(
        photoIds.map((id, index) =>
          tx.photo.update({ where: { id }, data: { position: index } }),
        ),
      );
    });

    res.json({
      photos: await prisma.photo.findMany({
        where: { userId },
        orderBy: { position: 'asc' },
      }),
    });
  } catch (error) {
    next(error);
  }
});

usersRouter.delete('/me/prompts/:id', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const prompt = await prisma.prompt.findUnique({ where: { id: req.params.id } });
    if (!prompt || prompt.userId !== req.userId) {
      throw new AppError('prompt_not_found', 404, 'Prompt not found.');
    }
    await prisma.prompt.delete({ where: { id: prompt.id } });
    await getProfileCompletion(req.userId!);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

usersRouter.post('/me/verification/request', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const { note } = z.object({ note: z.string().trim().max(500).optional() }).parse(req.body);
    const pending = await prisma.profileVerificationRequest.findFirst({
      where: { userId: req.userId!, status: 'PENDING' },
    });
    if (pending) return res.json(pending);
    const request = await prisma.$transaction(async (tx) => {
      const created = await tx.profileVerificationRequest.create({
        data: { userId: req.userId!, userNote: note },
      });
      await tx.profile.update({
        where: { userId: req.userId! },
        data: { verificationStatus: 'PENDING', isVerified: false },
      });
      return created;
    });
    res.status(201).json(request);
  } catch (error) {
    next(error);
  }
});

usersRouter.get('/interests', async (_req, res, next) => {
  try {
    res.json(await prisma.interest.findMany({ orderBy: { label: 'asc' } }));
  } catch (error) {
    next(error);
  }
});

usersRouter.get('/:id', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const targetId = req.params.id!;
    if (targetId !== req.userId) {
      const [match, block] = await Promise.all([
        prisma.match.findFirst({
          where: {
            isActive: true,
            OR: [
              { userAId: req.userId!, userBId: targetId },
              { userAId: targetId, userBId: req.userId! },
            ],
          },
        }),
        prisma.block.findFirst({
          where: {
            OR: [
              { blockerId: req.userId!, blockedId: targetId },
              { blockerId: targetId, blockedId: req.userId! },
            ],
          },
        }),
      ]);
      if (!match || block) throw new AppError('profile_not_available', 403, 'Profile unavailable.');
    }

    const user = await prisma.user.findFirst({
      where: { id: targetId, status: 'ACTIVE' },
      select: {
        id: true,
        profile: true,
        photos: { orderBy: { position: 'asc' } },
        prompts: { orderBy: { position: 'asc' } },
        interests: { include: { interest: true } },
      },
    });
    if (!user?.profile) throw new AppError('user_not_found', 404, 'Profile not found.');
    const age = Math.floor(
      (Date.now() - user.profile.birthDate.getTime()) / (365.2425 * 24 * 60 * 60 * 1_000),
    );
    res.json({
      userId: user.id,
      displayName: user.profile.displayName,
      bio: user.profile.bio,
      age,
      gender: user.profile.gender,
      city: user.profile.city,
      occupation: user.profile.occupation,
      heightCm: user.profile.heightCm,
      isVerified: user.profile.isVerified,
      photos: user.photos,
      prompts: user.prompts,
      interests: user.interests.map((item) => item.interest),
    });
  } catch (error) {
    next(error);
  }
});
