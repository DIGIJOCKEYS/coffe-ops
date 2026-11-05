'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useUser, useClerk } from '@clerk/nextjs';
import { createClient } from '@/lib/supabase/client';
import { useSupabaseRealtime } from '@/hooks/use-supabase-realtime';
import type { Role } from '@/lib/nav-config';

type Profile = { name: string; role: Role; isActive: boolean };

type AuthContextValue = {
  user: any;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  role: Role;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function isRole(value: unknown): value is Role {
  return value === 'admin' || value === 'staff';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileRevision, setProfileRevision] = useState(0);
  const refreshProfile = useCallback(() => setProfileRevision((r) => r + 1), []);

  // Gunakan ref untuk user ID agar tidak masuk dependency array
  const userIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!isLoaded) return;

    const userId = user?.id;

    if (!userId) {
      setProfile(null);
      setProfileLoading(false);
      setError(null);
      userIdRef.current = undefined;
      return;
    }

    let isMounted = true;

    const syncProfile = async () => {
      setProfileLoading(true);
      setError(null);

      const displayName = user.fullName || user.firstName || user.primaryEmailAddress?.emailAddress?.split('@')[0] || 'Pengguna';
      const email = user.primaryEmailAddress?.emailAddress || '';

      try {
        const supabase = createClient();
        const { data, error: fetchError } = await supabase
          .from('profiles')
          .select('id, name, role, is_active')
          .eq('id', userId)
          .maybeSingle();

        if (fetchError) throw fetchError;

        if (data) {
          if (isMounted) {
            setProfile({
              name: data.name || displayName,
              role: isRole(data.role) ? data.role : 'staff',
              isActive: data.is_active !== false,
            });
          }

          // Sync avatar sekali per session, jangan update setiap render
          if (userIdRef.current !== userId) {
            userIdRef.current = userId;
            await supabase
              .from('profiles')
              .update({ avatar_url: user.imageUrl || null, updated_at: new Date().toISOString() })
              .eq('id', userId);
          }
        } else {
          const { count, error: countError } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true });
          if (countError) throw countError;

          const defaultRole: Role = isRole(user.publicMetadata?.role)
            ? (user.publicMetadata.role as Role)
            : count === 0 ? 'admin' : 'staff';
          const defaultActive = count === 0;

          const { error: insertError } = await supabase.from('profiles').insert({
            id: userId,
            name: displayName,
            email,
            avatar_url: user.imageUrl || null,
            role: defaultRole,
            is_active: defaultActive,
          });
          if (insertError) throw insertError;

          userIdRef.current = userId;

          if (isMounted) {
            setProfile({ name: displayName, role: defaultRole, isActive: defaultActive });
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Gagal memuat profil pengguna dari Supabase.');
        }
      } finally {
        if (isMounted) setProfileLoading(false);
      }
    };

    syncProfile();

    return () => { isMounted = false; };
  // Hanya re-run jika userId atau profileRevision berubah, bukan setiap prop Clerk
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, user?.id, profileRevision]);

  useSupabaseRealtime(['profiles'], refreshProfile, Boolean(user?.id));

  const metadataRole = user?.publicMetadata?.role;
  const activeRole: Role = profile?.role || (isRole(metadataRole) ? metadataRole as Role : 'staff');

  const value: AuthContextValue = {
    user: user ?? null,
    profile,
    loading: !isLoaded || (!!user && profileLoading),
    error,
    role: activeRole,
    signOut: async () => { await signOut(); },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth harus dipakai di dalam AuthProvider');
  return context;
}

export function useRole() {
  return { role: useAuth().role };
}
