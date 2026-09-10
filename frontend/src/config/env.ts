/**
 * Client-side configuration.
 *
 * The browser bundle receives ONLY the Supabase project URL and the anonymous
 * key (R14.5). The service role key is server-side only and must never appear
 * here or anywhere reachable by client code.
 *
 * Vite exposes only variables prefixed with VITE_, which is an additional guard
 * against leaking a server secret into the bundle.
 */
export interface ClientEnv {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export function loadClientEnv(): ClientEnv {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing client environment: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required.',
    );
  }

  return { supabaseUrl, supabaseAnonKey };
}
