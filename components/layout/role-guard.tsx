'use client';

import type { ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/layout/role-context';
import { canAccess, findNavItem } from '@/lib/nav-config';

export function RoleGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { role, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" />
      </div>
    );
  }

  const item = findNavItem(pathname);
  if (item && !canAccess(role, item)) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand/10 text-brand-dark">
          <Lock className="h-6 w-6" />
        </span>
        <h1 className="mt-4 text-lg font-semibold text-ink">Akses dibatasi</h1>
        <p className="mt-1 max-w-sm text-sm text-ink-muted">
          Halaman ini hanya tersedia untuk Admin / Pemilik.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
