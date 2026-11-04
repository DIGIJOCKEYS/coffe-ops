'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useUser, useClerk } from '@clerk/nextjs';
import { createClient } from '@/lib/supabase/client';
import type { Role } from '@/lib/nav-config';

type Profile = { name: string; role: Role };

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
  const metadataRole = user?.publicMetadata?.role;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;

    if (!userId) {
      setProfile(null);
      setProfileUserId(null);
      setProfileLoading(false);
      setError(null);
      return;
    }

    let isMounted = true;
    const syncProfileWithSupabase = async () => {
      setProfileLoading(true);
      setError(null);
      setProfile(null);
      setProfileUserId(null);
      const displayName =
        fullName ||
        firstName ||
        emailAddress?.split('@')[0] ||
        'Pengguna';
      const email = emailAddress || '';

      try {
        const supabase = createClient();
        // Cek profil di tabel Supabase
        const { data, error } = await supabase
          .from('profiles')
          .select('id, name, role')
          .eq('id', userId)
          .maybeSingle();

        if (error) {
          throw error;
        }

        if (data) {
          if (isMounted) {
            setProfile({
              name: data.name || displayName,
              role: isRole(data.role) ? data.role : 'staff',
            });
            setProfileUserId(userId);
          }
        } else {
          const { count, error: countError } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true });
          if (countError) throw countError;

          const defaultRole: Role = isRole(metadataRole) ? metadataRole : count === 0 ? 'admin' : 'staff';

          const { error: insertError } = await supabase.from('profiles').insert({
            id: userId,
            name: displayName,
            email,
            avatar_url: avatarUrl,
            role: defaultRole,
          });
          if (insertError) throw insertError;

          if (isMounted) {
            setProfile({
              name: displayName,
              role: defaultRole,
            });
            setProfileUserId(userId);
          }
        }
      } catch (error) {
        if (isMounted) {
          setError(error instanceof Error ? error.message : 'Gagal memuat profil pengguna dari Supabase.');
        }
      } finally {
        if (isMounted) {
          setProfileLoading(false);
        }
      }
    };

    syncProfileWithSupabase();

    return () => {
      isMounted = false;
    };
  }, [
    isLoaded,
    userId,
    fullName,
    firstName,
    emailAddress,
    avatarUrl,
    metadataRole,
  ]);

  const activeRole: Role = profile?.role || (isRole(metadataRole) ? metadataRole : 'staff');

  const value: AuthContextValue = {
    user: user ?? null,
    profile,
    loading: !isLoaded || (!!user && (profileLoading || profileUserId !== user.id)),
    error,
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
