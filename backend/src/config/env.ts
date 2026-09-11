import { z } from 'zod';

/**
 * Runtime environment configuration.
 *
 * Every secret is read from an environment variable at runtime (R14.3). If a
 * required variable is absent or empty, startup fails and the process reports
 * which variables are missing WITHOUT printing any value (R14.14).
 *
 * Staging and production use separate Supabase projects and separate variable
 * sets (R14.10); this module does not distinguish them beyond APP_ENV.
 */

const NON_EMPTY = z.string().trim().min(1);

const envSchema = z.object({
  // Deployment environment. Drives the seed gate (R15.4) and other posture checks.
  APP_ENV: z.enum(['local', 'staging', 'production']),

  // HTTP
  PORT: z.coerce.number().int().positive().default(8080),

  // Exact frontend origins allowed by CORS — comma separated, no wildcard (R14.12).
  ALLOWED_ORIGINS: NON_EMPTY,

  // Supabase — server side only. The service role key bypasses RLS and must never
  // reach the browser bundle (R2.10, R14.5).
  SUPABASE_URL: NON_EMPTY.url(),
  SUPABASE_ANON_KEY: NON_EMPTY,
  SUPABASE_SERVICE_ROLE_KEY: NON_EMPTY,
});

export type Env = z.infer<typeof envSchema>;

/**
 * Parse and validate process.env. On failure, throws an error whose message
 * names each absent or invalid variable and contains no secret values.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);

  if (!parsed.success) {
    // Report only variable names and the nature of the failure — never values (R14.14).
    const problems = parsed.error.issues
      .map((issue) => {
        const name = issue.path.join('.') || '(root)';
        return `  - ${name}: ${issue.message}`;
      })
      .join('\n');

    throw new Error(
      `Environment validation failed. Fix these variables before startup:\n${problems}`,
    );
  }

  return parsed.data;
}

/**
 * The parsed allow-list of origins. Kept as a helper so both the CORS layer and
 * tests read origins the same way.
 */
export function parseAllowedOrigins(env: Env): string[] {
  return env.ALLOWED_ORIGINS.split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0);
}
