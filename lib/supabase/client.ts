import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Buat Supabase client untuk Client Components.
 * Menggunakan anon key — akses dikontrol oleh RLS policy permissive.
 * Clerk session token tidak dikirim karena Supabase Third-Party Auth
 * belum bisa dikonfigurasi (domain proxy /__clerk ditolak Supabase).
 */
export function createClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
