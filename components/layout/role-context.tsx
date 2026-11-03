'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import type { Role } from '@/lib/nav-config';

type Profile = { name: string; role: Role };

type AuthContextValue = {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  role: Role; // profile?.role ?? 'staff' (default aman saat loading)
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (uid: string) => {
    const { data } = await supabase.from('profiles').select('name, role').eq('id', uid).single();
    if (data) {
      setProfile({ name: (data.name as string) ?? '', role: ((data.role as Role) ?? 'staff') });
    } else {
      setProfile(null);
    }
  };

  useEffect(() => {
    let mounted = true;

    const apply = async (nextUser: User | null) => {
      setUser(nextUser);
      if (nextUser) {
        await loadProfile(nextUser.id);
      } else {
        setProfile(null);
      }
      if (mounted) setLoading(false);
    };

    (async () => {
      const {
        data: { user: current },
      } = await supabase.auth.getUser();
      if (mounted) await apply(current);
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      apply(session?.user ?? null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  const value: AuthContextValue = {
    user,
    profile,
    loading,
    role: profile?.role ?? 'staff',
    signOut,
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
