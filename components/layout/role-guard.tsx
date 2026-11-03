'use client';

import { usePathname } from 'next/navigation';
import { Lock } from 'lucide-react';
import { useRole } from '@/components/layout/role-context';
import { canAccess, findNavItem } from '@/lib/nav-config';

export function RoleGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { role } = useRole();
  const item = findNavItem(pathname);

  if (item && !canAccess(role, item)) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-line bg-white px-6 py-16 text-center shadow-sm">
        <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-background text-ink-muted">
          <Lock className="h-5 w-5" />
        </span>
        <h1 className="text-lg font-semibold text-ink">Akses dibatasi</h1>
        <p className="mt-1 max-w-sm text-sm text-ink-muted">
          Halaman ini hanya tersedia untuk Admin / Pemilik. Ganti tampilan role dari menu profil untuk melihatnya.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
