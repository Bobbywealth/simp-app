import { Router } from 'express';
import { z } from 'zod';
import type { NotificationType } from '@prisma/client';
import { prisma } from '../config/db.js';
import { requireAuth, requireRole, type AuthedRequest } from '../middleware/auth.js';
import { AppError } from '../utils/errors.js';
import { notify } from '../services/notification.service.js';
import { getRealtimeServer } from '../sockets/realtime.js';

export const experiencesRouter = Router();

const experienceCategory = z.enum([
  'DINNER',
  'DRINKS',
  'EVENT',
  'CONCERT',
  'TRAVEL',
  'SHOPPING',
  'ADVENTURE',
  'VIP',
  'OTHER',
]);

function calculateAge(birthDate: Date): number {
  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const month = now.getMonth() - birthDate.getMonth();
  if (month < 0 || (month === 0 && now.getDate() < birthDate.getDate())) {
    age -= 1;
  }
  return age;
}

const hostSelect = {
  id: true,
  profile: { select: { displayName: true, birthDate: true } },
  photos: { orderBy: { position: 'asc' as const }, take: 1, select: { url: true } },
};

type HostRow = {
  id: string;
  profile: { displayName: string; birthDate: Date } | null;
  photos: { url: string }[];
};

function shapeHost(host: HostRow) {
  return {
    id: host.id,
    displayName: host.profile?.displayName ?? null,
    age: host.profile ? calculateAge(host.profile.birthDate) : null,
    photoUrl: host.photos[0]?.url ?? null,
  };
}

async function approvedCountsByExperience(experienceIds: string[]): Promise<Map<string, number>> {
  if (experienceIds.length === 0) return new Map();
  const counts = await prisma.experienceRequest.groupBy({
    by: ['experienceId'],
    where: { experienceId: { in: experienceIds }, status: 'APPROVED' },
    _count: { _all: true },
  });
  return new Map(counts.map((c) => [c.experienceId, c._count._all]));
}

/** Loads an experience and ensures the caller is its host. */
async function getHostedExperience(experienceId: string, userId: string) {
  const experience = await prisma.experience.findUnique({ where: { id: experienceId } });
  if (!experience) {
    throw new AppError('experience_not_found', 404, 'Experience not found.');
  }
  if (experience.hostId !== userId) {
    throw new AppError('not_host', 403, 'Only the host can manage this experience.');
  }
  return experience;
}

// ---------------------------------------------------------------------------
// Browse user-hosted experiences
// ---------------------------------------------------------------------------

experiencesRouter.get('/experiences', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const input = z
      .object({
        cursor: z.string().optional(),
        city: z.string().trim().max(80).optional(),
        category: experienceCategory.optional(),
        limit: z.coerce.number().int().min(1).max(50).default(20),
      })
      .parse(req.query);
    const me = req.userId!;
    const rows = await prisma.experience.findMany({
      where: {
        status: 'OPEN',
        startsAt: { gt: new Date() },
        hostId: { not: me },
        ...(input.city ? { city: { equals: input.city, mode: 'insensitive' } } : {}),
        ...(input.category ? { category: input.category } : {}),
      },
      include: { host: { select: hostSelect } },
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > input.limit;
    const page = hasMore ? rows.slice(0, input.limit) : rows;
    const counts = await approvedCountsByExperience(page.map((r) => r.id));
    const experiences = page.map((r) => ({
      ...r,
      host: shapeHost(r.host),
      approvedCount: counts.get(r.id) ?? 0,
    }));
    res.json({
      experiences,
      nextCursor: hasMore ? experiences.at(-1)?.id ?? null : null,
      hasMore,
    });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// My experiences (hosted or joined)
// ---------------------------------------------------------------------------

experiencesRouter.get('/experiences/mine', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const input = z.object({ role: z.enum(['hosted', 'joined']).default('hosted') }).parse(req.query);
    const me = req.userId!;
    const rows =
      input.role === 'hosted'
        ? await prisma.experience.findMany({
            where: { hostId: me },
            include: { host: { select: hostSelect } },
            orderBy: { createdAt: 'desc' },
          })
        : await prisma.experience.findMany({
            where: { requests: { some: { requesterId: me, status: 'APPROVED' } } },
            include: { host: { select: hostSelect } },
            orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
          });
    const counts = await approvedCountsByExperience(rows.map((r) => r.id));
    res.json({
      experiences: rows.map((r) => ({
        ...r,
        host: shapeHost(r.host),
        approvedCount: counts.get(r.id) ?? 0,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// Host a new experience
// ---------------------------------------------------------------------------

const createExperienceSchema = z.object({
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(2000).optional(),
  category: experienceCategory,
  city: z.string().trim().min(2).max(80),
  startsAt: z.string().datetime(),
  priceCents: z.number().int().min(0).optional(),
  currency: z.string().regex(/^[A-Z]{3}$/).default('USD'),
  capacity: z.number().int().min(2).max(50),
  imageUrl: z.string().url().max(2000).optional(),
});

experiencesRouter.post('/experiences', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const input = createExperienceSchema.parse(req.body);
    const startsAt = new Date(input.startsAt);
    if (startsAt <= new Date()) {
      throw new AppError('starts_at_not_future', 400, 'Experience must start in the future.');
    }
    const experience = await prisma.experience.create({
      data: {
        title: input.title,
        description: input.description,
        category: input.category,
        city: input.city,
        startsAt,
        priceCents: input.priceCents,
        currency: input.currency,
        capacity: input.capacity,
        imageUrl: input.imageUrl,
        hostId: req.userId!,
        status: 'OPEN',
      },
    });
    res.status(201).json(experience);
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// Experience detail
// ---------------------------------------------------------------------------

experiencesRouter.get('/experiences/:id', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const id = z.string().min(1).parse(req.params.id);
    const me = req.userId!;
    const experience = await prisma.experience.findUnique({
      where: { id },
      include: { host: { select: hostSelect } },
    });
    if (!experience) {
      throw new AppError('experience_not_found', 404, 'Experience not found.');
    }
    const isHost = experience.hostId === me;
    if (experience.status === 'DRAFT' && !isHost) {
      throw new AppError('experience_not_found', 404, 'Experience not found.');
    }
    const [approvedCount, myRequest] = await Promise.all([
      prisma.experienceRequest.count({ where: { experienceId: id, status: 'APPROVED' } }),
      prisma.experienceRequest.findUnique({
        where: { experienceId_requesterId: { experienceId: id, requesterId: me } },
        select: { id: true, status: true, note: true, createdAt: true },
      }),
    ]);
    res.json({
      ...experience,
      host: shapeHost(experience.host),
      approvedCount,
      myRequest,
      isHost,
    });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// Update a hosted experience (host only)
// ---------------------------------------------------------------------------

const updateExperienceSchema = z
  .object({
    title: z.string().trim().min(2).max(160).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    startsAt: z.string().datetime().optional(),
    capacity: z.number().int().min(2).max(50).optional(),
    imageUrl: z.string().url().max(2000).nullable().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'Provide at least one field to update.' });

experiencesRouter.patch('/experiences/:id', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const id = z.string().min(1).parse(req.params.id);
    const input = updateExperienceSchema.parse(req.body);
    const experience = await getHostedExperience(id, req.userId!);

    if (input.startsAt !== undefined) {
      const startsAt = new Date(input.startsAt);
      if (startsAt <= new Date()) {
        throw new AppError('starts_at_not_future', 400, 'Experience must start in the future.');
      }
    }
    if (input.capacity !== undefined) {
      const approvedCount = await prisma.experienceRequest.count({
        where: { experienceId: id, status: 'APPROVED' },
      });
      if (input.capacity < approvedCount) {
        throw new AppError(
          'capacity_too_small',
          400,
          `Capacity cannot be less than the ${approvedCount} already approved guest(s).`,
        );
      }
    }

    const updated = await prisma.experience.update({
      where: { id: experience.id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.startsAt !== undefined ? { startsAt: new Date(input.startsAt) } : {}),
        ...(input.capacity !== undefined ? { capacity: input.capacity } : {}),
        ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
      },
    });

    // If capacity was raised on a FULL experience, reopen it.
    if (input.capacity !== undefined && updated.status === 'FULL') {
      const approvedCount = await prisma.experienceRequest.count({
        where: { experienceId: id, status: 'APPROVED' },
      });
      if (input.capacity > approvedCount) {
        await prisma.experience.update({
          where: { id: experience.id },
          data: { status: 'OPEN' },
        });
        updated.status = 'OPEN';
      }
    }
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// Cancel a hosted experience (host only)
// ---------------------------------------------------------------------------

experiencesRouter.post('/experiences/:id/cancel', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const id = z.string().min(1).parse(req.params.id);
    const experience = await getHostedExperience(id, req.userId!);
    if (experience.status === 'CANCELLED') {
      throw new AppError('already_cancelled', 400, 'This experience is already cancelled.');
    }
    const updated = await prisma.experience.update({
      where: { id: experience.id },
      data: { status: 'CANCELLED' },
    });

    // Notify all approved + pending guests that the experience was cancelled.
    const guests = await prisma.experienceRequest.findMany({
      where: { experienceId: id, status: { in: ['PENDING', 'APPROVED'] } },
      select: { requesterId: true },
    });
    for (const guest of guests) {
      void notify({
        userId: guest.requesterId,
        actorId: req.userId!,
        type: 'EXPERIENCE' as NotificationType,
        entityId: id,
        title: 'Experience cancelled',
        body: `"${experience.title}" was cancelled by the host.`,
        data: { experienceId: id, route: `/experiences/${id}` },
      }).catch(() => {});
      getRealtimeServer()?.to(`user:${guest.requesterId}`).emit('experience:cancelled', {
        experienceId: id,
      });
    }

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// Request to join an experience
// ---------------------------------------------------------------------------

const joinRequestSchema = z.object({
  note: z.string().trim().max(500).optional(),
});

experiencesRouter.post('/experiences/:id/requests', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const id = z.string().min(1).parse(req.params.id);
    const input = joinRequestSchema.parse(req.body);
    const me = req.userId!;

    const experience = await prisma.experience.findUnique({ where: { id } });
    if (!experience) {
      throw new AppError('experience_not_found', 404, 'Experience not found.');
    }
    if (experience.hostId === me) {
      throw new AppError('cannot_request_own', 403, 'You cannot request to join your own experience.');
    }
    if (experience.status !== 'OPEN') {
      throw new AppError('experience_not_open', 400, 'This experience is not accepting requests.');
    }
    if (!experience.startsAt || experience.startsAt <= new Date()) {
      throw new AppError('experience_started', 400, 'This experience has already started.');
    }

    const existing = await prisma.experienceRequest.findFirst({
      where: { experienceId: id, requesterId: me, status: { in: ['PENDING', 'APPROVED'] } },
      select: { id: true, status: true },
    });
    if (existing) {
      throw new AppError(
        'request_exists',
        409,
        existing.status === 'APPROVED'
          ? 'You are already joining this experience.'
          : 'You already have a pending request for this experience.',
      );
    }

    // Upsert: a prior CANCELLED/DECLINED row is revived as PENDING (unique constraint
    // on [experienceId, requesterId] prevents a second row).
    const joinRequest = await prisma.experienceRequest.upsert({
      where: { experienceId_requesterId: { experienceId: id, requesterId: me } },
      create: {
        experienceId: id,
        requesterId: me,
        note: input.note,
        status: 'PENDING',
      },
      update: {
        note: input.note,
        status: 'PENDING',
      },
    });

    void notify({
      userId: experience.hostId,
      actorId: me,
      type: 'EXPERIENCE' as NotificationType,
      entityId: id,
      title: 'New join request',
      body: `Someone wants to join "${experience.title}". Review their request.`,
      data: { experienceId: id, requestId: joinRequest.id, route: `/experiences/${id}` },
    }).catch(() => {});

    getRealtimeServer()?.to(`user:${experience.hostId}`).emit('experience:request', {
      experienceId: id,
      requestId: joinRequest.id,
    });

    res.status(201).json(joinRequest);
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// Cancel my pending join request
// ---------------------------------------------------------------------------

experiencesRouter.delete('/experiences/:id/requests/mine', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const id = z.string().min(1).parse(req.params.id);
    const me = req.userId!;
    const existing = await prisma.experienceRequest.findFirst({
      where: { experienceId: id, requesterId: me, status: { in: ['PENDING', 'APPROVED'] } },
      select: { id: true, status: true },
    });
    if (!existing) {
      throw new AppError('request_not_found', 404, 'No active request found for this experience.');
    }
    const updated = await prisma.experienceRequest.update({
      where: { id: existing.id },
      data: { status: 'CANCELLED' },
    });

    // If an approved guest leaves a FULL experience, reopen it.
    if (existing.status === 'APPROVED') {
      const experience = await prisma.experience.findUnique({
        where: { id },
        select: { status: true, capacity: true },
      });
      if (experience?.status === 'FULL') {
        const approvedCount = await prisma.experienceRequest.count({
          where: { experienceId: id, status: 'APPROVED' },
        });
        if (experience.capacity == null || approvedCount < experience.capacity) {
          await prisma.experience.update({ where: { id }, data: { status: 'OPEN' } });
        }
      }
      // Let the host know a guest left.
      const host = await prisma.experience.findUnique({ where: { id }, select: { hostId: true, title: true } });
      if (host) {
        void notify({
          userId: host.hostId,
          actorId: me,
          type: 'EXPERIENCE' as NotificationType,
          entityId: id,
          title: 'Guest left',
          body: `A guest left "${host.title}".`,
          data: { experienceId: id, route: `/experiences/${id}` },
        }).catch(() => {});
        getRealtimeServer()?.to(`user:${host.hostId}`).emit('experience:guest-left', { experienceId: id });
      }
    }

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// List join requests (host only)
// ---------------------------------------------------------------------------

experiencesRouter.get('/experiences/:id/requests', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const id = z.string().min(1).parse(req.params.id);
    const experience = await getHostedExperience(id, req.userId!);
    const rows = await prisma.experienceRequest.findMany({
      where: { experienceId: experience.id },
      orderBy: { createdAt: 'desc' },
      include: {
        requester: {
          select: {
            id: true,
            profile: { select: { displayName: true, birthDate: true } },
            photos: { orderBy: { position: 'asc' as const }, take: 1, select: { url: true } },
          },
        },
      },
    });
    res.json({
      requests: rows.map((r) => ({
        id: r.id,
        note: r.note,
        status: r.status,
        createdAt: r.createdAt,
        requester: {
          id: r.requester.id,
          displayName: r.requester.profile?.displayName ?? null,
          age: r.requester.profile ? calculateAge(r.requester.profile.birthDate) : null,
          photoUrl: r.requester.photos[0]?.url ?? null,
        },
      })),
    });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// Approve a join request (host only)
// ---------------------------------------------------------------------------

experiencesRouter.post(
  '/experiences/:id/requests/:requestId/approve',
  requireAuth,
  async (req: AuthedRequest, res, next) => {
    try {
      const experienceId = z.string().min(1).parse(req.params.id);
      const requestId = z.string().min(1).parse(req.params.requestId);
      const me = req.userId!;

      const updated = await prisma.$transaction(async (tx) => {
        // Lock the experience row so concurrent approves can't overfill capacity.
        await tx.$queryRaw`SELECT id FROM "Experience" WHERE id = ${experienceId} FOR UPDATE`;

        const joinRequest = await tx.experienceRequest.findUnique({
          where: { id: requestId },
          include: {
            experience: { select: { id: true, hostId: true, capacity: true, status: true, title: true } },
            requester: { select: { profile: { select: { displayName: true } } } },
          },
        });
        if (!joinRequest || joinRequest.experienceId !== experienceId) {
          throw new AppError('request_not_found', 404, 'Request not found.');
        }
        if (joinRequest.experience.hostId !== me) {
          throw new AppError('not_host', 403, 'Only the host can approve requests.');
        }
        if (joinRequest.status !== 'PENDING') {
          throw new AppError('request_not_pending', 400, 'Only pending requests can be approved.');
        }
        if (joinRequest.experience.status !== 'OPEN' && joinRequest.experience.status !== 'FULL') {
          throw new AppError('experience_not_open', 400, 'This experience is not accepting guests.');
        }

        const approvedCount = await tx.experienceRequest.count({
          where: { experienceId, status: 'APPROVED' },
        });
        const capacity = joinRequest.experience.capacity;
        if (capacity != null && approvedCount >= capacity) {
          throw new AppError('experience_full', 409, 'This experience is full.');
        }

        const approved = await tx.experienceRequest.update({
          where: { id: requestId },
          data: { status: 'APPROVED' },
          include: {
            experience: { select: { id: true, title: true } },
            requester: { select: { id: true, profile: { select: { displayName: true } } } },
          },
        });

        if (capacity != null && approvedCount + 1 >= capacity) {
          await tx.experience.update({ where: { id: experienceId }, data: { status: 'FULL' } });
        }
        return { approved, approvedCount: approvedCount + 1, becameFull: capacity != null && approvedCount + 1 >= capacity };
      });

      const { approved: approvedRequest, approvedCount: newApprovedCount, becameFull } = updated;

      // Notify the requester (outside the transaction so a push failure can't roll back the approval).
      const requesterName = approvedRequest.requester.profile?.displayName ?? 'Someone';
      void notify({
        userId: approvedRequest.requesterId,
        actorId: me,
        type: 'EXPERIENCE' as NotificationType,
        entityId: experienceId,
        title: "You're in!",
        body: `${requesterName}, your request to join "${approvedRequest.experience.title}" was approved.`,
        data: { experienceId, requestId: approvedRequest.id, route: `/experiences/${experienceId}` },
      }).catch(() => {});

      getRealtimeServer()?.to(`user:${approvedRequest.requesterId}`).emit('experience:approved', {
        experienceId,
        requestId: approvedRequest.id,
      });

      res.json({
        request: {
          id: approvedRequest.id,
          status: approvedRequest.status,
          note: approvedRequest.note,
          createdAt: approvedRequest.createdAt,
          requester: {
            id: approvedRequest.requester.id,
            displayName: approvedRequest.requester.profile?.displayName ?? null,
            age: null,
            photoUrl: null,
          },
        },
        approvedCount: newApprovedCount,
        experienceStatus: becameFull ? 'FULL' : 'OPEN',
      });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// Decline a join request (host only)
// ---------------------------------------------------------------------------

experiencesRouter.post(
  '/experiences/:id/requests/:requestId/decline',
  requireAuth,
  async (req: AuthedRequest, res, next) => {
    try {
      const experienceId = z.string().min(1).parse(req.params.id);
      const requestId = z.string().min(1).parse(req.params.requestId);
      const experience = await getHostedExperience(experienceId, req.userId!);

      const joinRequest = await prisma.experienceRequest.findUnique({ where: { id: requestId } });
      if (!joinRequest || joinRequest.experienceId !== experience.id) {
        throw new AppError('request_not_found', 404, 'Request not found.');
      }
      if (joinRequest.status !== 'PENDING') {
        throw new AppError('request_not_pending', 400, 'Only pending requests can be declined.');
      }

      const declined = await prisma.experienceRequest.update({
        where: { id: requestId },
        data: { status: 'DECLINED' },
        include: {
          requester: {
            select: {
              id: true,
              profile: { select: { displayName: true, birthDate: true } },
              photos: { orderBy: { position: 'asc' }, take: 1, select: { url: true } },
            },
          },
        },
      });

      void notify({
        userId: declined.requesterId,
        actorId: req.userId!,
        type: 'EXPERIENCE' as NotificationType,
        entityId: experience.id,
        title: 'Request declined',
        body: `Your request to join "${experience.title}" wasn't approved this time.`,
        data: { experienceId: experience.id, requestId: declined.id, route: `/experiences/${experience.id}` },
      }).catch(() => {});

      getRealtimeServer()?.to(`user:${declined.requesterId}`).emit('experience:declined', {
        experienceId: experience.id,
        requestId: declined.id,
      });

      res.json({
        request: {
          id: declined.id,
          status: declined.status,
          note: declined.note,
          createdAt: declined.createdAt,
          requester: {
            id: declined.requester.id,
            displayName: declined.requester.profile?.displayName ?? null,
            age: declined.requester.profile ? calculateAge(declined.requester.profile.birthDate) : null,
            photoUrl: declined.requester.photos[0]?.url ?? null,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// Remove an approved guest (host only)
// ---------------------------------------------------------------------------

experiencesRouter.delete(
  '/experiences/:id/requests/:requestId',
  requireAuth,
  async (req: AuthedRequest, res, next) => {
    try {
      const experienceId = z.string().min(1).parse(req.params.id);
      const requestId = z.string().min(1).parse(req.params.requestId);
      const experience = await getHostedExperience(experienceId, req.userId!);

      const joinRequest = await prisma.experienceRequest.findUnique({ where: { id: requestId } });
      if (!joinRequest || joinRequest.experienceId !== experience.id) {
        throw new AppError('request_not_found', 404, 'Request not found.');
      }
      if (joinRequest.status !== 'APPROVED') {
        throw new AppError('request_not_approved', 400, 'Only approved guests can be removed.');
      }

      const removed = await prisma.experienceRequest.update({
        where: { id: requestId },
        data: { status: 'CANCELLED' },
        include: {
          requester: {
            select: {
              id: true,
              profile: { select: { displayName: true, birthDate: true } },
              photos: { orderBy: { position: 'asc' }, take: 1, select: { url: true } },
            },
          },
        },
      });

      // Reopen if the experience was FULL.
      if (experience.status === 'FULL') {
        await prisma.experience.update({
          where: { id: experienceId },
          data: { status: 'OPEN' },
        });
      }

      void notify({
        userId: removed.requesterId,
        actorId: req.userId!,
        type: 'EXPERIENCE' as NotificationType,
        entityId: experienceId,
        title: 'Removed from experience',
        body: `You were removed from "${experience.title}".`,
        data: { experienceId, route: `/experiences/${experienceId}` },
      }).catch(() => {});
      getRealtimeServer()?.to(`user:${removed.requesterId}`).emit('experience:removed', {
        experienceId,
      });

      res.json({
        request: {
          id: removed.id,
          status: removed.status,
          note: removed.note,
          createdAt: removed.createdAt,
          requester: {
            id: removed.requester.id,
            displayName: removed.requester.profile?.displayName ?? null,
            age: removed.requester.profile ? calculateAge(removed.requester.profile.birthDate) : null,
            photoUrl: removed.requester.photos[0]?.url ?? null,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// Admin: curate an experience (kept as-is; admin acts as host)
// ---------------------------------------------------------------------------

experiencesRouter.post(
  '/admin/experiences',
  requireAuth,
  requireRole('ADMIN', 'SUPER_ADMIN'),
  async (req: AuthedRequest, res, next) => {
    try {
      const input = z
        .object({
          title: z.string().trim().min(2).max(160),
          description: z.string().trim().max(2000).optional(),
          category: experienceCategory,
          city: z.string().trim().min(2).max(80),
          startsAt: z.string().datetime().optional(),
          priceCents: z.number().int().min(0).optional(),
          currency: z.string().regex(/^[A-Z]{3}$/).default('USD'),
          provider: z.string().trim().max(160).optional(),
          capacity: z.number().int().min(1).optional(),
          bookingUrl: z.string().url().optional(),
          imageUrl: z.string().url().optional(),
          isActive: z.boolean().default(false),
        })
        .parse(req.body);
      const experience = await prisma.experience.create({
        data: {
          ...input,
          hostId: req.userId!,
          status: input.isActive ? 'OPEN' : 'DRAFT',
          startsAt: input.startsAt ? new Date(input.startsAt) : null,
        },
      });
      res.status(201).json(experience);
    } catch (error) {
      next(error);
    }
  },
);
