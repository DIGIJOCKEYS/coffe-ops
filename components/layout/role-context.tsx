'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useUser, useClerk } from '@clerk/nextjs';
import { createClient } from '@/lib/supabase/client';
import type { Role } from '@/lib/nav-config';

type Profile = { name: string; role: Role };

type AuthContextValue = {
  user: any;
  profile: Profile | null;
  loading: boolean;
  role: Role;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const [profile, setProfile] = useState<Profile | null>(null);
  const syncedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !user) {
      setProfile(null);
      syncedUserIdRef.current = null;
      return;
    }

    // Hindari re-sync berulang kali jika user ID sama
    if (syncedUserIdRef.current === user.id) {
      return;
    }
    syncedUserIdRef.current = user.id;

    let isMounted = true;
    const syncProfileWithSupabase = async () => {
      const supabase = createClient();
      const displayName =
        user.fullName ||
        user.firstName ||
        user.primaryEmailAddress?.emailAddress?.split('@')[0] ||
        'Pengguna';
      const email = user.primaryEmailAddress?.emailAddress || '';
      const avatarUrl = user.imageUrl || null;

      try {
        // Cek profil di tabel Supabase
        const { data, error } = await supabase
          .from('profiles')
          .select('id, name, role')
          .eq('id', user.id)
          .maybeSingle();

        if (error) {
          if (isMounted) {
            setProfile({
              name: displayName,
              role: (user.publicMetadata?.role as Role) || 'admin',
            });
          }
          return;
        }

        if (data) {
          if (isMounted) {
            setProfile({
              name: data.name || displayName,
              role: (data.role as Role) || 'staff',
            });
          }
        } else {
          // Pengguna baru -> cek apakah ini pengguna pertama untuk jadikan admin
          const { count } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true });

          const defaultRole: Role =
            (user.publicMetadata?.role as Role) || (count === 0 ? 'admin' : 'staff');

          await supabase.from('profiles').insert({
            id: user.id,
            name: displayName,
            email,
            avatar_url: avatarUrl,
            role: defaultRole,
          });

          if (isMounted) {
            setProfile({
              name: displayName,
              role: defaultRole,
            });
          }
        }
      } catch {
        if (isMounted) {
          setProfile({
            name: displayName,
            role: (user.publicMetadata?.role as Role) || 'admin',
          });
        }
      }
    };

    syncProfileWithSupabase();

    return () => {
      isMounted = false;
    };
  }, [isLoaded, user?.id]);

  const activeRole: Role = profile?.role || (user?.publicMetadata?.role as Role) || 'admin';

  const value: AuthContextValue = {
    user: user ?? null,
    profile,
    loading: !isLoaded,
    role: activeRole,
    signOut: async () => {
      await signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth harus dipakai di dalam AuthProvider');
  return context;
}

// Kompatibilitas untuk konsumen lama yang pakai useRole().role
export function useRole() {
  return { role: useAuth().role };
}
