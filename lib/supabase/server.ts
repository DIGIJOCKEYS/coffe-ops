import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { auth } from '@clerk/nextjs/server';

/**
 * Buat Supabase client untuk Server Components / Route Handlers.
 *
 * Sesuai dokumentasi Clerk + Supabase integration (April 2025):
 * - Gunakan Clerk `auth()` untuk mendapatkan token server-side
 * - Pass token ke Supabase via `accessToken` callback
 */
export async function createServerSupabaseClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      async accessToken() {
        return (await auth()).getToken();
      },
    },
  );
}

/**
 * Buat Supabase client dengan Service Role Key.
 * HANYA untuk server-side operations yang perlu bypass RLS (admin tasks).
 * JANGAN gunakan di client-side code.
 */
export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}
