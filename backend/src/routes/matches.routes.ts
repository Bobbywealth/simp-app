import { Router } from 'express';
import { prisma } from '../config/db.js';
import { requireAuth, requireVerifiedEmail, type AuthedRequest } from '../middleware/auth.js';
import { AppError } from '../utils/errors.js';
import { cloudinaryThumbnailUrl } from '../services/cloudinary.service.js';

export const matchesRouter = Router();

function ageFromBirthDate(birthDate: Date) {
  const now = new Date();
  let age = now.getUTCFullYear() - birthDate.getUTCFullYear();
  if (
    now.getUTCMonth() < birthDate.getUTCMonth() ||
    (now.getUTCMonth() === birthDate.getUTCMonth() && now.getUTCDate() < birthDate.getUTCDate())
  ) {
    age -= 1;
  }
  return age;
}

matchesRouter.get('/matches', requireAuth, requireVerifiedEmail, async (req: AuthedRequest, res, next) => {
  try {
    const userId = req.userId!;
    const limit = Math.min(50, Math.max(1, Number.parseInt(String(req.query.limit ?? '20'), 10) || 20));
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const blocked = await prisma.block.findMany({
      where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
      select: { blockerId: true, blockedId: true },
    });
    const blockedIds = blocked.map((item) => (item.blockerId === userId ? item.blockedId : item.blockerId));
    const rows = await prisma.match.findMany({
      where: {
        isActive: true,
        OR: [{ userAId: userId }, { userBId: userId }],
        userAId: { notIn: blockedIds },
        userBId: { notIn: blockedIds },
        userA: { status: 'ACTIVE' },
        userB: { status: 'ACTIVE' },
      },
      include: {
        userA: { select: { id: true, profile: true, photos: { take: 1, orderBy: { position: 'asc' } } } },
        userB: { select: { id: true, profile: true, photos: { take: 1, orderBy: { position: 'asc' } } } },
        conversation: {
          include: {
            messages: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 1 },
            _count: {
              select: {
                messages: { where: { senderId: { not: userId }, readAt: null, deletedAt: null } },
              },
            },
          },
        },
      },
      orderBy: [{ lastMessageAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const otherIds = page.map((match) => (match.userAId === userId ? match.userBId : match.userAId));
    const notes = await prisma.swipe.findMany({
      where: { swiperId: { in: otherIds }, swipedId: userId, action: { in: ['LIKE', 'SUPERLIKE'] } },
    });
    const noteMap = new Map(notes.map((note) => [note.swiperId, note.note]));

    res.json({
      matches: page.flatMap((match) => {
        const other = match.userAId === userId ? match.userB : match.userA;
        if (!other.profile) return [];
        const photo = other.photos[0];
        return [
          {
            matchId: match.id,
            conversationId: match.conversation?.id ?? null,
            matchedAt: match.createdAt,
            lastMessageAt: match.lastMessageAt,
            otherUser: {
              userId: other.id,
              profileId: other.profile.id,
              displayName: other.profile.displayName,
              age: ageFromBirthDate(other.profile.birthDate),
              city: other.profile.city,
              occupation: other.profile.occupation,
              isVerified: other.profile.isVerified,
              photoUrl: photo?.url ?? null,
              thumbnailUrl: photo ? cloudinaryThumbnailUrl(photo.url) : null,
            },
            noteFromOther: noteMap.get(other.id) ?? null,
            latestMessage: match.conversation?.messages[0] ?? null,
            unreadCount: match.conversation?._count.messages ?? 0,
          },
        ];
      }),
      nextCursor: hasMore ? page.at(-1)?.id ?? null : null,
      hasMore,
    });
  } catch (error) {
    next(error);
  }
});

matchesRouter.get('/matches/:id', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const userId = req.userId!;
    const match = await prisma.match.findUnique({
      where: { id: req.params.id },
      include: { conversation: true },
    });
    if (!match || (match.userAId !== userId && match.userBId !== userId)) {
      throw new AppError('match_not_found', 404, 'Match not found.');
    }
    if (!match.isActive) throw new AppError('match_inactive', 409, 'This match is no longer active.');
    const otherUserId = match.userAId === userId ? match.userBId : match.userAId;
    const [blocked, other, notes] = await Promise.all([
      prisma.block.findFirst({
        where: {
          OR: [
            { blockerId: userId, blockedId: otherUserId },
            { blockerId: otherUserId, blockedId: userId },
          ],
        },
      }),
      prisma.user.findFirst({
        where: { id: otherUserId, status: 'ACTIVE' },
        include: {
          profile: true,
          photos: { orderBy: { position: 'asc' } },
          prompts: { orderBy: { position: 'asc' } },
          interests: { include: { interest: true } },
        },
      }),
      prisma.swipe.findMany({
        where: {
          OR: [
            { swiperId: userId, swipedId: otherUserId },
            { swiperId: otherUserId, swipedId: userId },
          ],
          action: { in: ['LIKE', 'SUPERLIKE'] },
        },
      }),
    ]);
    if (blocked || !other?.profile) throw new AppError('profile_not_available', 404, 'Profile unavailable.');
    const myNote = notes.find((note) => note.swiperId === userId)?.note ?? null;
    const theirNote = notes.find((note) => note.swiperId === otherUserId)?.note ?? null;

    res.json({
      matchId: match.id,
      conversationId: match.conversation?.id ?? null,
      matchedAt: match.createdAt,
      lastMessageAt: match.lastMessageAt,
      otherUser: {
        userId: other.id,
        profileId: other.profile.id,
        displayName: other.profile.displayName,
        bio: other.profile.bio,
        age: ageFromBirthDate(other.profile.birthDate),
        gender: other.profile.gender,
        city: other.profile.city,
        occupation: other.profile.occupation,
        heightCm: other.profile.heightCm,
        isVerified: other.profile.isVerified,
        photos: other.photos.map((photo) => ({
          id: photo.id,
          url: photo.url,
          thumbnailUrl: cloudinaryThumbnailUrl(photo.url),
          position: photo.position,
        })),
        prompts: other.prompts.map((prompt) => ({
          id: prompt.id,
          question: prompt.question,
          answer: prompt.answer,
        })),
        interests: other.interests.map((item) => ({
          slug: item.interest.slug,
          label: item.interest.label,
        })),
      },
      myNote,
      theirNote,
    });
  } catch (error) {
    next(error);
  }
});

matchesRouter.post('/matches/:id/unmatch', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const userId = req.userId!;
    const updated = await prisma.match.updateMany({
      where: {
        id: req.params.id,
        isActive: true,
        OR: [{ userAId: userId }, { userBId: userId }],
      },
      data: { isActive: false, deactivatedAt: new Date(), deactivatedById: userId },
    });
    if (!updated.count) throw new AppError('match_not_found', 404, 'Match not found.');
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});
