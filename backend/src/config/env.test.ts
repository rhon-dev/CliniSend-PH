import { describe, expect, it } from 'vitest';

import { loadEnv, parseAllowedOrigins } from './env.js';

const VALID = {
  APP_ENV: 'local',
  PORT: '8080',
  ALLOWED_ORIGINS: 'http://localhost:5173',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'anon-key-value',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-value',
} satisfies NodeJS.ProcessEnv;

describe('loadEnv', () => {
  it('parses a valid environment', () => {
    const env = loadEnv(VALID);
    expect(env.APP_ENV).toBe('local');
    expect(env.PORT).toBe(8080);
  });

  it('fails closed and names the missing variable without printing values (R14.14)', () => {
    const missing: NodeJS.ProcessEnv = { ...VALID };
    delete missing.SUPABASE_SERVICE_ROLE_KEY;
    expect(() => loadEnv(missing)).toThrowError(/SUPABASE_SERVICE_ROLE_KEY/);
    // The secret value must never appear in the thrown message.
    try {
      loadEnv({ ...missing, SUPABASE_SERVICE_ROLE_KEY: '' });
    } catch (err) {
      expect((err as Error).message).not.toContain('service-role-value');
    }
  });

  it('rejects an unknown APP_ENV', () => {
    expect(() => loadEnv({ ...VALID, APP_ENV: 'prod' })).toThrowError(/APP_ENV/);
  });
});

describe('parseAllowedOrigins', () => {
  it('splits and trims a comma-separated list', () => {
    const env = loadEnv({ ...VALID, ALLOWED_ORIGINS: 'https://a.example, https://b.example' });
    expect(parseAllowedOrigins(env)).toEqual(['https://a.example', 'https://b.example']);
  });
});
