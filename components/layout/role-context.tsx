'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
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
  const userId = user?.id;
  const fullName = user?.fullName;
  const firstName = user?.firstName;
  const emailAddress = user?.primaryEmailAddress?.emailAddress;
  const avatarUrl = user?.imageUrl || null;
  const username = user?.username || null;
  const phone = user?.primaryPhoneNumber?.phoneNumber || null;
  const metadataRole = user?.publicMetadata?.role;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileRevision, setProfileRevision] = useState(0);
  const refreshProfile = useCallback(() => setProfileRevision((revision) => revision + 1), []);

  useEffect(() => {
    if (!isLoaded) return;

    if (!userId) {
      setProfile(null);
      setProfileLoading(false);
      setError(null);
      return;
    }

    let isMounted = true;
    const syncProfileWithSupabase = async () => {
      setProfileLoading(true);
      setError(null);
      const displayName = fullName || firstName || emailAddress?.split('@')[0] || 'Pengguna';
      const email = emailAddress || '';

      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('profiles')
          .select('id, name, role, is_active')
          .eq('id', userId)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          if (isMounted) {
            setProfile({
              name: data.name || displayName,
              role: isRole(data.role) ? data.role : 'staff',
              isActive: data.is_active !== false,
            });
          }
          // Sync avatar, username, phone jika berubah di Clerk
          await supabase
            .from('profiles')
            .update({ avatar_url: avatarUrl, username, phone, updated_at: new Date().toISOString() })
            .eq('id', userId);
        } else {
          const { count, error: countError } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true });
          if (countError) throw countError;

          const defaultRole: Role = isRole(metadataRole) ? metadataRole : count === 0 ? 'admin' : 'staff';
          const defaultActive = count === 0;

          const { error: insertError } = await supabase.from('profiles').insert({
            id: userId,
            name: displayName,
            email,
            username,
            phone,
            avatar_url: avatarUrl,
            role: defaultRole,
            is_active: defaultActive,
          });
          if (insertError) throw insertError;

          if (isMounted) {
            setProfile({
              name: displayName,
              role: defaultRole,
              isActive: defaultActive,
            });
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

    syncProfileWithSupabase();

    return () => { isMounted = false; };
  }, [isLoaded, userId, fullName, firstName, emailAddress, avatarUrl, username, phone, metadataRole, profileRevision]);

  useSupabaseRealtime(['profiles'], refreshProfile, Boolean(userId));

  const activeRole: Role = profile?.role || (isRole(metadataRole) ? metadataRole : 'staff');

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
