import type { NextFunction, Request, Response } from 'express';

/**
 * Application error with a stable, client-safe shape. Handlers throw these;
 * anything else is treated as an unexpected 500.
 */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

interface ErrorBody {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
}

/**
 * Uniform error responder.
 *
 * Responses never include stack traces, SQL text, or database identifiers
 * (R14.8). Unexpected errors are logged server-side and returned as a generic
 * 500 so internals do not leak.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    const body: ErrorBody = {
      error: { code: err.code, message: err.message, ...(err.fields ? { fields: err.fields } : {}) },
    };
    res.status(err.status).json(body);
    return;
  }

  // Unexpected: log the detail internally, return nothing revealing.
  console.error('[unhandled error]', err);
  const body: ErrorBody = {
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' },
  };
  res.status(500).json(body);
}

/** Fallback for unmatched routes. */
export function notFoundHandler(_req: Request, res: Response): void {
  const body: ErrorBody = {
    error: { code: 'NOT_FOUND', message: 'Resource not found.' },
  };
  res.status(404).json(body);
}
