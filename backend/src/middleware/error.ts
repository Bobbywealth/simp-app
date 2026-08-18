import { Prisma } from '@prisma/client';
import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const requestId = res.locals.requestId as string | undefined;

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'validation_error',
      message: 'Please correct the highlighted fields.',
      fieldErrors: err.flatten().fieldErrors,
      requestId,
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(409).json({
        error: 'conflict',
        message: 'That record already exists.',
        fieldErrors: {},
        requestId,
      });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({
        error: 'not_found',
        message: 'The requested resource was not found.',
        fieldErrors: {},
        requestId,
      });
    }
  }

  const appError = err instanceof AppError ? err : null;
  const status = appError?.status ?? 500;
  const code = appError?.code ?? 'internal_error';
  const message =
    status >= 500 && env.NODE_ENV === 'production'
      ? 'Something went wrong. Please try again.'
      : appError?.message ?? (err instanceof Error ? err.message : 'Internal server error');

  if (status >= 500) {
    logger.error({
      event: 'request_error',
      requestId,
      errorName: err instanceof Error ? err.name : 'UnknownError',
      errorMessage: err instanceof Error ? err.message : String(err),
      stack: env.NODE_ENV === 'production' ? undefined : err instanceof Error ? err.stack : undefined,
    });
  }

  return res.status(status).json({
    error: code,
    message,
    fieldErrors: appError?.fieldErrors ?? {},
    ...(appError?.details ? { details: appError.details } : {}),
    requestId,
  });
};
