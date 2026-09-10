import { Router } from 'express';

/**
 * Liveness endpoint (README Phase 8 gate: "health endpoint reachable").
 *
 * Returns liveness and, once migrations exist, migration-version information
 * only. It exposes no tenant data and no configuration values.
 */
export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'clinisend-backend',
    time: new Date().toISOString(),
  });
});
