import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { auth } from '@clerk/nextjs/server';

/**
 * Buat Supabase client untuk Server Components / Route Handlers.
 *
 * Cara baru (sejak April 2025):
 * - Gunakan Clerk `auth()` untuk mendapatkan token server-side
 * - Pass token ke Supabase via `accessToken`
 * - Tidak perlu @supabase/ssr cookie handling untuk autentikasi
 */
export async function createClient() {
  const { getToken } = await auth();

  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      accessToken: () => getToken(),
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
