'use client';

import { createClient } from './client';

/**
 * Hook untuk mendapatkan Supabase client.
 * Simple wrapper — session tidak diperlukan karena RLS policy permissive.
 */
export function useSupabaseClient() {
  return createClient();
}
