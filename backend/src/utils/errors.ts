export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors?: Record<string, string[]>;
  readonly details?: Record<string, unknown>;

  constructor(
    code: string,
    status: number,
    message: string,
    options: {
      fieldErrors?: Record<string, string[]>;
      details?: Record<string, unknown>;
      cause?: unknown;
    } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.fieldErrors = options.fieldErrors;
    this.details = options.details;
  }
}

export const notFound = (message = 'The requested resource was not found') =>
  new AppError('not_found', 404, message);

export const forbidden = (message = 'You are not allowed to perform this action') =>
  new AppError('forbidden', 403, message);

export const conflict = (code: string, message: string) => new AppError(code, 409, message);
