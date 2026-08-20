import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { ANALYTICS_EVENTS, trackAnalytics } from '../services/analytics.service.js';

export const analyticsRouter = Router();

const propertyValue = z.union([z.string().max(200), z.number(), z.boolean(), z.null()]);

analyticsRouter.post('/analytics/events', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const input = z
      .object({
        event: z.enum(ANALYTICS_EVENTS),
        properties: z.record(z.string().max(50), propertyValue).refine(
          (value) => !Object.keys(value).some((key) => /message|body|bio|email|name|photo|token/i.test(key)),
          'Sensitive analytics properties are not allowed',
        ).optional(),
      })
      .parse(req.body);
    await trackAnalytics({ event: input.event, userId: req.userId!, properties: input.properties });
    res.status(202).json({ ok: true });
  } catch (error) {
    next(error);
  }
});
