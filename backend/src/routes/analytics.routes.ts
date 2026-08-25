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
        // sessionId is optional — anonymous events (signup_started before
        // the user exists) tie to a session instead. The client stores a
        // uuid in localStorage on first load and reuses it across visits.
        sessionId: z.string().max(80).optional(),
        source: z.enum(['client', 'server']).optional(),
        appVersion: z.string().max(40).optional(),
        properties: z.record(z.string().max(50), propertyValue).refine(
          (value) => !Object.keys(value).some((key) => /message|body|bio|email|name|photo|token|password|phone|address|ip/i.test(key)),
          'Sensitive analytics properties are not allowed',
        ).optional(),
      })
      .parse(req.body);
    await trackAnalytics({
      event: input.event,
      userId: req.userId!,
      sessionId: input.sessionId ?? null,
      source: input.source ?? 'client',
      appVersion: input.appVersion,
      properties: input.properties,
    });
    res.status(202).json({ ok: true });
  } catch (error) {
    next(error);
  }
});
