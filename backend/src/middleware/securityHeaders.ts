import type { NextFunction, Request, Response } from 'express';

/**
 * Security response headers (R14.13).
 *
 * - Strict-Transport-Security: max-age >= 15,552,000 seconds (180 days)
 * - X-Content-Type-Options: nosniff
 * - X-Frame-Options: DENY
 * - Referrer-Policy: no-referrer
 *
 * HSTS is only meaningful over HTTPS; in production the platform serves all
 * traffic over HTTPS and redirects HTTP (R14.1, R14.2), which is handled at the
 * hosting/proxy layer (Vercel / Railway / Render) rather than in-process.
 */
export const HSTS_MAX_AGE_SECONDS = 15_552_000;

export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('Strict-Transport-Security', `max-age=${HSTS_MAX_AGE_SECONDS}; includeSubDomains`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
}
