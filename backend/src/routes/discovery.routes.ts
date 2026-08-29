import type { Gender, LookingFor, Prisma } from '@prisma/client';
import { Router } from 'express';
import { prisma } from '../config/db.js';
import { requireAuth, requireVerifiedEmail, type AuthedRequest } from '../middleware/auth.js';
import { AppError } from '../utils/errors.js';
import { cloudinaryThumbnailUrl } from '../services/cloudinary.service.js';
import { getProfileCompletion } from '../services/profile-completion.service.js';

export const discoveryRouter = Router();

const gendersFor = (lookingFor: LookingFor): Gender[] =>
  lookingFor === 'WOMEN'
    ? ['WOMAN']
    : lookingFor === 'MEN'
      ? ['MAN']
      : ['WOMAN', 'MAN', 'NONBINARY'];

const lookingForMyGender = (gender: Gender): LookingFor[] =>
  gender === 'MAN' ? ['MEN', 'EVERYONE'] : gender === 'WOMAN' ? ['WOMEN', 'EVERYONE'] : ['EVERYONE'];

function ageFromBirthDate(birthDate: Date) {
  const now = new Date();
  let age = now.getUTCFullYear() - birthDate.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < birthDate.getUTCMonth() ||
    (now.getUTCMonth() === birthDate.getUTCMonth() && now.getUTCDate() < birthDate.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6_371;
  const dLat = toRadians(bLat - aLat);
  const dLng = toRadians(bLng - aLng);
  const value =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(aLat)) * Math.cos(toRadians(bLat)) * Math.sin(dLng / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

discoveryRouter.get(
  '/discovery',
  requireAuth,
  requireVerifiedEmail,
  async (req: AuthedRequest, res, next) => {
    try {
      const userId = req.userId!;
      const limit = Math.min(50, Math.max(1, Number.parseInt(String(req.query.limit ?? '20'), 10) || 20));
      const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
      const completion = await getProfileCompletion(userId);
      if (!completion.complete) {
        throw new AppError('profile_incomplete', 409, 'Complete your profile to start discovering.', {
          details: { missing: completion.missing, percent: completion.percent },
        });
      }

      const me = await prisma.user.findUnique({
        where: { id: userId },
        include: { profile: true, discoveryPreference: true },
      });
      if (!me?.profile) throw new AppError('profile_required', 409, 'Create your profile first.');
      const preferences = me.discoveryPreference ??
        (await prisma.discoveryPreference.create({ data: { userId } }));
      const minAge = Math.max(
        18,
        Math.min(99, Number.parseInt(String(req.query.minAge ?? preferences.minAge), 10) || preferences.minAge),
      );
      const maxAge = Math.max(
        minAge,
        Math.min(99, Number.parseInt(String(req.query.maxAge ?? preferences.maxAge), 10) || preferences.maxAge),
      );

      const now = new Date();
      const latestBirthDate = new Date(Date.UTC(now.getUTCFullYear() - minAge, now.getUTCMonth(), now.getUTCDate()));
      const earliestBirthDate = new Date(
        Date.UTC(now.getUTCFullYear() - maxAge - 1, now.getUTCMonth(), now.getUTCDate() + 1),
      );

      const [swipes, blocks] = await Promise.all([
        prisma.swipe.findMany({ where: { swiperId: userId }, select: { swipedId: true } }),
        prisma.block.findMany({
          where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
          select: { blockerId: true, blockedId: true },
        }),
      ]);
      const excluded = new Set([userId, ...swipes.map((item) => item.swipedId)]);
      for (const block of blocks) {
        excluded.add(block.blockerId === userId ? block.blockedId : block.blockerId);
      }

      const where: Prisma.UserWhereInput = {
        id: { notIn: [...excluded] },
        status: 'ACTIVE',
        emailVerified: true,
        profile: {
          profileCompletedAt: { not: null },
          gender: { in: gendersFor(me.profile.lookingFor) },
          lookingFor: { in: lookingForMyGender(me.profile.gender) },
          birthDate: { gte: earliestBirthDate, lte: latestBirthDate },
          ...(preferences.verifiedOnly ? { isVerified: true } : {}),
        },
        photos: { some: {} },
        ...(preferences.interestSlugs.length
          ? { interests: { some: { interest: { slug: { in: preferences.interestSlugs } } } } }
          : {}),
      };

      const raw = await prisma.user.findMany({
        where,
        include: {
          profile: true,
          discoveryPreference: true,
          photos: { orderBy: { position: 'asc' } },
          prompts: { orderBy: { position: 'asc' }, take: 3 },
          interests: { include: { interest: true } },
        },
        orderBy: [
          // SIMP is free — no boost ranking. Order by the remote's
          // relevance signal (createdAt desc + id desc) so the cursor
          // pagination stays stable.
          { createdAt: 'desc' },
          { id: 'desc' },
        ],
        take: Math.min(151, limit * 3 + 1),
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });

      const candidateSlugs = new Set(preferences.interestSlugs);
      const maxDist = preferences.maxDistanceKm ?? 100;
      const withDistance = raw
        .map((candidate) => {
          const mine = preferences;
          const theirs = candidate.discoveryPreference;
          const distance =
            mine.locationLat !== null &&
            mine.locationLng !== null &&
            theirs?.locationLat !== null &&
            theirs?.locationLat !== undefined &&
            theirs.locationLng !== null
              ? distanceKm(mine.locationLat, mine.locationLng, theirs.locationLat, theirs.locationLng)
              : null;
          const sharedInterestCount = candidate.interests.filter((ci) =>
            candidateSlugs.has(ci.interest.slug),
          ).length;
          const distanceScore =
            distance !== null
              ? Math.max(0, 1 - distance / maxDist) * 30
              : 15;
          return { candidate, distance, sharedInterestCount, distanceScore };
        })
        .filter(({ distance }) =>
          preferences.maxDistanceKm === null
            ? true
            : distance !== null && distance <= preferences.maxDistanceKm,
        );

      // SIMP is fully free — there is no longer a premium ranking or an
      // Elite boost decay. Discovery orders by distance + shared-interest
      // overlap, then by signup time desc for stability.
      const sorted = [...withDistance].sort((a, b) => {
        const aScore = a.distanceScore + a.sharedInterestCount * 5;
        const bScore = b.distanceScore + b.sharedInterestCount * 5;
        const db = bScore - aScore;
        if (db !== 0) return db;
        return b.candidate.createdAt.getTime() - a.candidate.createdAt.getTime();
      });
      const selected = sorted.slice(0, limit);

      const profiles = selected.flatMap(({ candidate, distance }) => {
        if (!candidate.profile) return [];
        return [
          {
            profileId: candidate.profile.id,
            userId: candidate.id,
            displayName: candidate.profile.displayName,
            bio: candidate.profile.bio,
            age: ageFromBirthDate(candidate.profile.birthDate),
            gender: candidate.profile.gender,
            city: candidate.profile.city,
            occupation: candidate.profile.occupation,
            heightCm: candidate.profile.heightCm,
            isVerified: candidate.profile.isVerified,
            verificationStatus: candidate.profile.verificationStatus,
            distanceKm: distance === null ? null : Math.max(1, Math.round(distance)),
            photos: candidate.photos.map((photo) => ({
              id: photo.id,
              url: photo.url,
              thumbnailUrl: cloudinaryThumbnailUrl(photo.url),
              position: photo.position,
            })),
            prompts: candidate.prompts.map((prompt) => ({
              id: prompt.id,
              question: prompt.question,
              answer: prompt.answer,
            })),
            interests: candidate.interests.map((item) => ({
              slug: item.interest.slug,
              label: item.interest.label,
            })),
          },
        ];
      });

      const lastRaw = raw[Math.min(raw.length, limit * 3) - 1];
      res.json({
        profiles,
        nextCursor: raw.length > limit * 3 ? lastRaw?.id ?? null : null,
        hasMore: raw.length > limit * 3,
        filters: {
          minAge,
          maxAge,
          maxDistanceKm: preferences.maxDistanceKm,
          verifiedOnly: preferences.verifiedOnly,
          interestSlugs: preferences.interestSlugs,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

discoveryRouter.get(
  '/explore',
  requireAuth,
  requireVerifiedEmail,
  async (req: AuthedRequest, res, next) => {
    try {
      const userId = req.userId!;
      const interestSlug = typeof req.query.interest === 'string' ? req.query.interest : undefined;
      const limit = Math.min(50, Math.max(1, Number.parseInt(String(req.query.limit ?? '20'), 10) || 20));
      const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;

      const me = await prisma.user.findUnique({
        where: { id: userId },
        include: { profile: true },
      });
      if (!me?.profile) throw new AppError('profile_required', 409, 'Create your profile first.');

      const [swipes, blocks] = await Promise.all([
        prisma.swipe.findMany({ where: { swiperId: userId }, select: { swipedId: true } }),
        prisma.block.findMany({
          where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
          select: { blockerId: true, blockedId: true },
        }),
      ]);
      const excluded = new Set([userId, ...swipes.map((item) => item.swipedId)]);
      for (const block of blocks) {
        excluded.add(block.blockerId === userId ? block.blockedId : block.blockerId);
      }

      const where: Prisma.UserWhereInput = {
        id: { notIn: [...excluded] },
        status: 'ACTIVE',
        emailVerified: true,
        profile: {
          profileCompletedAt: { not: null },
          gender: { in: gendersFor(me.profile.lookingFor) },
          lookingFor: { in: lookingForMyGender(me.profile.gender) },
        },
        photos: { some: {} },
        ...(interestSlug ? { interests: { some: { interest: { slug: interestSlug } } } } : {}),
      };

      const raw = await prisma.user.findMany({
        where,
        include: {
          profile: true,
          photos: { orderBy: { position: 'asc' } },
          prompts: { orderBy: { position: 'asc' }, take: 3 },
          interests: { include: { interest: true } },
        },
        orderBy: [{ profile: { birthDate: 'desc' } }, { createdAt: 'desc' }],
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });

      const hasMore = raw.length > limit;
      const page = hasMore ? raw.slice(0, limit) : raw;

      const profiles = page.map((candidate) => {
        if (!candidate.profile) return null;
        return {
          profileId: candidate.profile.id,
          userId: candidate.id,
          displayName: candidate.profile.displayName,
          bio: candidate.profile.bio,
          age: ageFromBirthDate(candidate.profile.birthDate),
          gender: candidate.profile.gender,
          city: candidate.profile.city,
          occupation: candidate.profile.occupation,
          heightCm: candidate.profile.heightCm,
          isVerified: candidate.profile.isVerified,
          verificationStatus: candidate.profile.verificationStatus,
          distanceKm: null,
          photos: candidate.photos.map((photo) => ({
            id: photo.id,
            url: photo.url,
            thumbnailUrl: cloudinaryThumbnailUrl(photo.url),
            position: photo.position,
          })),
          prompts: candidate.prompts.map((prompt) => ({
            id: prompt.id,
            question: prompt.question,
            answer: prompt.answer,
          })),
          interests: candidate.interests.map((item) => ({
            slug: item.interest.slug,
            label: item.interest.label,
          })),
        };
      }).filter(Boolean);

      res.json({
        profiles,
        nextCursor: hasMore ? page.at(-1)?.id ?? null : null,
        hasMore,
        interest: interestSlug ?? null,
      });
    } catch (error) {
      next(error);
    }
  },
);

discoveryRouter.get(
  '/interests',
  requireAuth,
  async (req: AuthedRequest, res, next) => {
    try {
      const userId = req.userId!;
      const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit ?? '20'), 10) || 20));

      const interests = await prisma.interest.findMany({
        take: limit,
        orderBy: { label: 'asc' },
      });

      const userInterests = await prisma.userInterest.findMany({
        where: { userId },
        include: { interest: true },
      });
      const userSlugs = new Set(userInterests.map((ui) => ui.interest.slug));

      res.json({
        interests: interests.map((i) => ({
          slug: i.slug,
          label: i.label,
          userHasIt: userSlugs.has(i.slug),
        })),
      });
    } catch (error) {
      next(error);
    }
  },
);
