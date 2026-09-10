import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../app.js';
import type { Env } from '../config/env.js';

const TEST_ENV: Env = {
  APP_ENV: 'local',
  PORT: 8080,
  ALLOWED_ORIGINS: 'http://localhost:5173',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'anon-key-value',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-value',
};

describe('GET /health', () => {
  it('returns 200 and a liveness payload with no config values', async () => {
    const app = createApp(TEST_ENV);
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    // Health must not leak configuration or secrets.
    expect(JSON.stringify(res.body)).not.toContain('service-role-value');
    expect(JSON.stringify(res.body)).not.toContain('anon-key-value');
  });

  it('sets the required security headers (R14.13)', async () => {
    const app = createApp(TEST_ENV);
    const res = await request(app).get('/health');

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['strict-transport-security']).toMatch(/max-age=15552000/);
  });

  it('returns a uniform 404 shape for unknown routes', async () => {
    const app = createApp(TEST_ENV);
    const res = await request(app).get('/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
