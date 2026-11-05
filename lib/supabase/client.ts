import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Session } from '@clerk/nextjs/server';

/**
 * Buat Supabase client untuk Client Components dengan Clerk auth.
 *
 * Sesuai dokumentasi Clerk + Supabase integration (April 2025):
 * - Clerk harus didaftarkan sebagai Third-Party Auth Provider di Supabase Dashboard
 * - Session token dari Clerk otomatis dikirim ke Supabase untuk RLS
 *
 * @param session - Clerk session dari useSession() hook
 */
export function createClient(session?: Session | null) {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      async accessToken() {
        return session?.getToken() ?? null;
      },
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
