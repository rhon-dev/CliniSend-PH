import { createApp } from './app.js';
import { loadEnv } from './config/env.js';

/**
 * Process entrypoint. Environment validation runs first and fails closed: if a
 * required variable is absent or invalid, the process exits before binding a
 * port (R14.14).
 */
function main(): void {
  let env;
  try {
    env = loadEnv();
  } catch (err) {
    // The message names missing variables without printing values (R14.14).
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
    return;
  }

  const app = createApp(env);
  app.listen(env.PORT, () => {
    console.log(`clinisend-backend listening on port ${env.PORT} [${env.APP_ENV}]`);
  });
}

main();
