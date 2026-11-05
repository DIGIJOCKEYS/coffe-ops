import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Buat Supabase client untuk Client Components.
 *
 * Cara baru (sejak April 2025):
 * - Daftarkan Clerk sebagai Third-Party Auth Provider di Supabase Dashboard
 * - Pass Clerk session token via `accessToken` callback
 * - Tidak perlu JWT template, tidak perlu getToken({ template: 'supabase' })
 *
 * @param getToken - Fungsi untuk mendapatkan Clerk session token.
 *   Dapatkan dari `useSession()` hook: `session?.getToken()`
 */
export function createClient(getToken?: () => Promise<string | null> | string | null) {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      accessToken: getToken
        ? async () => {
            const token = await getToken();
            return token ?? null;
          }
        : undefined,
    },
  );
}

/**
 * Buat Supabase client tanpa auth (untuk operasi public/anon).
 * Hanya untuk data yang memang boleh dibaca semua orang.
 */
export function createAnonClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
