import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Client Supabase untuk Server Components / Route Handlers.
// Membaca session dari cookie, jadi RLS berlaku sesuai user yang login.
export function createClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Dipanggil dari Server Component yang tidak bisa set cookie —
            // aman diabaikan karena middleware yang menyegarkan session.
          }
        },
      },
    },
  );
}
