import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Buat Supabase client untuk Server Components / Route Handlers.
 * Menggunakan anon key dengan RLS policy permissive.
 */
export function createClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

/**
 * Buat Supabase client dengan Service Role Key.
 * HANYA untuk server-side operations yang perlu bypass RLS.
 */
export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}
