'use client';

import { useSession } from '@clerk/nextjs';
import { createClient } from './client';

/**
 * Hook untuk mendapatkan Supabase client dengan Clerk auth token.
 *
 * Gunakan hook ini di semua Client Components yang butuh akses Supabase.
 * Token Clerk akan otomatis dikirim ke Supabase untuk RLS.
 *
 * @example
 * const supabase = useSupabaseClient();
 * const { data } = await supabase.from('profiles').select('*');
 */
export function useSupabaseClient() {
  const { session } = useSession();
  return createClient(session);
}
