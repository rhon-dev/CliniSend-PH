import cors from 'cors';
import express, { type Express } from 'express';

import { parseAllowedOrigins, type Env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { securityHeaders } from './middleware/securityHeaders.js';
import { healthRouter } from './routes/health.js';

/**
 * Build the Express app.
 *
 * The middleware order is fixed and mirrors the design's pipeline (design 2.4):
 * security headers, then CORS (exact origins, no wildcard — R14.12), then routes,
 * then not-found, then the uniform error handler (R14.8).
 *
 * Authentication, the account/clinic gate, the role matrix, and payload
 * validation are added in later phases; the ordering slots are reserved here.
 */
export function createApp(env: Env): Express {
  const app = express();

  // Behind Vercel/Railway/Render proxies; trust the first hop for protocol/IP.
  app.set('trust proxy', 1);

  app.use(securityHeaders);

  const allowedOrigins = parseAllowedOrigins(env);
  app.use(
    cors({
      origin: allowedOrigins,
      credentials: true,
    }),
  );

  app.use(express.json({ limit: '100kb' }));

  // --- Reserved pipeline slots (later phases) ---
  // app.use(rateLimit)          // R3.13, R4.12, R8.15
  // app.use(authenticate)       // R3
  // app.use(gateAccountAndClinic) // R6, R8.6
  // route-level: authorize(role, action) // R9-R12
  // route-level: validate(schema)         // R14.7

  // Routes
  app.use(healthRouter);

  // Fallbacks
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
