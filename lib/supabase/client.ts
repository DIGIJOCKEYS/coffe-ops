import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js';

let _instance: SupabaseClient | null = null;

/**
 * Singleton Supabase client untuk Client Components.
 * Hanya dibuat satu kali untuk menghindari "Multiple GoTrueClient instances" warning.
 */
export function createClient(): SupabaseClient {
  if (_instance) return _instance;

  _instance = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // Kita tidak pakai Supabase Auth (pakai Clerk), matikan auto-refresh
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );

  return _instance;
}
