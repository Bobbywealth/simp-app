import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/db.js";
import { env } from "../config/env.js";
import {
  requireAuth,
  requireRole,
  type AuthedRequest,
} from "../middleware/auth.js";
import { AppError } from "../utils/errors.js";
import crypto from "node:crypto";

export const adminOperationsRouter = Router();
adminOperationsRouter.use(
  "/admin",
  requireAuth,
  requireRole("ADMIN", "SUPER_ADMIN"),
);
const pageSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  query: z.string().trim().max(120).optional(),
});
const reasonSchema = z.object({ reason: z.string().trim().min(3).max(500) });
const fingerprint = (id: string) =>
  crypto
    .createHmac("sha256", env.IP_HASH_SECRET ?? env.JWT_ACCESS_SECRET)
    .update(id)
    .digest("hex");
const page = <T extends { id: string }>(rows: T[], limit: number) => ({
  items: rows.slice(0, limit),
  nextCursor: rows.length > limit ? rows[limit - 1]!.id : null,
});

adminOperationsRouter.get("/admin/users/:id", async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        email: true,
        emailVerified: true,
        role: true,
        status: true,
        createdAt: true,
        profile: {
          select: {
            displayName: true,
            bio: true,
            city: true,
            verificationStatus: true,
          },
        },
        photos: {
          select: { id: true, url: true, position: true },
          orderBy: { position: "asc" },
        },
        refreshTokens: {
          where: { revokedAt: null, expiresAt: { gt: new Date() } },
          select: {
            familyId: true,
            deviceName: true,
            platform: true,
            lastUsedAt: true,
            expiresAt: true,
          },
          distinct: ["familyId"],
        },
      },
    });
    if (!user) throw new AppError("user_not_found", 404, "User not found.");
    res.json(user);
  } catch (e) {
    next(e);
  }
});
adminOperationsRouter.post(
  "/admin/users/:id/revoke-sessions",
  async (req: AuthedRequest, res, next) => {
    try {
      const { reason } = reasonSchema.parse(req.body);
      const target = await prisma.user.findUnique({
        where: { id: req.params.id },
        select: { id: true, role: true },
      });
      if (!target) throw new AppError("user_not_found", 404, "User not found.");
      if (target.id === req.userId)
        throw new AppError(
          "cannot_revoke_self",
          400,
          "Use your own security settings to sign yourself out.",
        );
      if (target.role === "SUPER_ADMIN" && req.userRole !== "SUPER_ADMIN")
        throw new AppError(
          "insufficient_role",
          403,
          "Only a Super Admin can manage this account.",
        );
      const result = await prisma.$transaction(async (tx) => {
        const result = await tx.refreshToken.updateMany({
          where: { userId: target.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        await tx.moderationAction.create({
          data: {
            moderatorId: req.userId!,
            targetUserId: target.id,
            targetFingerprint: fingerprint(target.id),
            action: "WARN",
            reason,
            metadata: { operation: "REVOKE_SESSIONS" },
          },
        });
        return result;
      });
      res.json({
        ok: true,
        revoked: result.count,
        accessTokenNote:
          "Existing access tokens expire within the configured access-token lifetime.",
      });
    } catch (e) {
      next(e);
    }
  },
);
adminOperationsRouter.get("/admin/experiences", async (req, res, next) => {
  try {
    const input = pageSchema
      .extend({
        status: z
          .enum(["DRAFT", "OPEN", "FULL", "CANCELLED", "COMPLETED"])
          .optional(),
      })
      .parse(req.query);
    const rows = await prisma.experience.findMany({
      where: {
        ...(input.status ? { status: input.status } : {}),
        ...(input.query
          ? {
              OR: [
                { title: { contains: input.query, mode: "insensitive" } },
                { city: { contains: input.query, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: {
        host: {
          select: { id: true, profile: { select: { displayName: true } } },
        },
        _count: { select: { requests: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    });
    res.json(page(rows, input.limit));
  } catch (e) {
    next(e);
  }
});
adminOperationsRouter.patch(
  "/admin/experiences/:id/visibility",
  async (req: AuthedRequest, res, next) => {
    try {
      const { isActive, reason } = reasonSchema
        .extend({ isActive: z.boolean() })
        .parse(req.body);
      const target = await prisma.experience.findUnique({
        where: { id: req.params.id },
      });
      if (!target)
        throw new AppError(
          "experience_not_found",
          404,
          "Experience not found.",
        );
      if (isActive && !["OPEN", "FULL"].includes(target.status))
        throw new AppError(
          "experience_closed",
          409,
          "Only open or full experiences can be made visible.",
        );
      await prisma.$transaction(async (tx) => {
        await tx.experience.update({
          where: { id: target.id },
          data: { isActive },
        });
        await tx.moderationAction.create({
          data: {
            moderatorId: req.userId!,
            targetUserId: target.hostId,
            targetFingerprint: fingerprint(target.hostId),
            action: "WARN",
            reason,
            metadata: {
              operation: "EXPERIENCE_VISIBILITY",
              experienceId: target.id,
              isActive,
            },
          },
        });
      });
      res.json({ ok: true, isActive });
    } catch (e) {
      next(e);
    }
  },
);
adminOperationsRouter.get("/admin/waitlist", async (req, res, next) => {
  try {
    const input = pageSchema.parse(req.query);
    const rows = await prisma.waitlistEntry.findMany({
      where: input.query
        ? {
            OR: [
              { email: { contains: input.query, mode: "insensitive" } },
              { name: { contains: input.query, mode: "insensitive" } },
            ],
          }
        : {},
      select: {
        id: true,
        name: true,
        email: true,
        source: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    });
    res.json(page(rows, input.limit));
  } catch (e) {
    next(e);
  }
});
adminOperationsRouter.get("/admin/email-events", async (req, res, next) => {
  try {
    const input = pageSchema.parse(req.query);
    const rows = await prisma.emailEvent.findMany({
      where: input.query
        ? { email: { contains: input.query, mode: "insensitive" } }
        : {},
      select: {
        id: true,
        email: true,
        type: true,
        provider: true,
        subject: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    });
    res.json(page(rows, input.limit));
  } catch (e) {
    next(e);
  }
});

adminOperationsRouter.get("/admin/live/streams", async (req, res, next) => {
  try {
    const rows = await prisma.liveStream.findMany({
      where: { status: "LIVE" },
      include: {
        broadcaster: {
          select: {
            id: true,
            profile: {
              select: { displayName: true, birthDate: true, city: true },
            },
            photos: { select: { url: true }, take: 1 },
          },
        },
      },
      orderBy: { startedAt: "desc" },
    });
    res.json({
      streams: rows.map((row) => ({
        id: row.id,
        title: row.title,
        status: row.status,
        startedAt: row.startedAt,
        viewerCount: row.viewerCount,
        heartCount: row.heartCount,
        broadcaster: {
          userId: row.broadcaster.id,
          displayName: row.broadcaster.profile?.displayName ?? "Member",
          age: row.broadcaster.profile
            ? new Date().getFullYear() -
              row.broadcaster.profile.birthDate.getFullYear()
            : null,
          city: row.broadcaster.profile?.city ?? null,
          photoUrl: row.broadcaster.photos[0]?.url ?? null,
        },
      })),
    });
  } catch (e) {
    next(e);
  }
});
