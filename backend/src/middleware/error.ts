import type { ErrorRequestHandler } from 'express';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  type ZodLikeError = { name?: string; issues?: unknown; flatten?: () => unknown };
  if ((err as ZodLikeError)?.name === 'ZodError') {
    return res.status(400).json({
      error: 'validation_error',
      issues: (err as ZodLikeError).flatten?.() ?? (err as ZodLikeError).issues,
    });
  }

  const status = (err as { status?: number })?.status ?? 500;
  const code = (err as { code?: string })?.code ?? 'internal_error';
  const message = (err as { message?: string })?.message ?? 'Internal server error';

  if (status >= 500) {
    console.error('[error]', err);
  }
  res.status(status).json({ error: code, message });
};
