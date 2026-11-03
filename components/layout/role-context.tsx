'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Role } from '@/lib/nav-config';

type RoleContextValue = {
  role: Role;
  setRole: (role: Role) => void;
};

const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>('admin');
  const value = useMemo(() => ({ role, setRole }), [role]);
  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole(): RoleContextValue {
  const context = useContext(RoleContext);
  if (!context) throw new Error('useRole harus dipakai di dalam RoleProvider');
  return context;
}
