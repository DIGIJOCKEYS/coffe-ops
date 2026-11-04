'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, Menu } from 'lucide-react';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { UserButton } from '@clerk/nextjs';
import { useRole } from '@/components/layout/role-context';
import { findNavGroupTitle, findNavItem } from '@/lib/nav-config';
import { fetchRecentAuditEntries } from '@/lib/operations-data';
import { useSupabaseQuery } from '@/hooks/use-supabase-query';

export function Navbar({ onOpenMobileMenu }: { onOpenMobileMenu: () => void }) {
  return (
    <header data-navbar className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-white/90 px-4 backdrop-blur supports-[backdrop-filter]:bg-white/75 sm:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onOpenMobileMenu} aria-label="Buka menu">
        <Menu className="h-5 w-5" />
      </Button>
      <NavBreadcrumb />
      <div className="ml-auto flex items-center gap-2 sm:gap-4">
        <NotificationMenu />
        <UserMenu />
      </div>
    </header>
  );
}

function NavBreadcrumb() {
  const pathname = usePathname();
  const item = findNavItem(pathname);
  const groupTitle = findNavGroupTitle(pathname);
  const isDashboard = pathname === '/dashboard';

  return (
    <Breadcrumb className="hidden min-w-0 sm:block">
      <BreadcrumbList className="flex-nowrap">
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href="/dashboard">Beranda</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        {item && !isDashboard && groupTitle && (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem className="hidden md:block">
              <span className="text-ink-muted">{groupTitle}</span>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden md:block" />
          </>
        )}
        {item && (
          <BreadcrumbItem className="min-w-0">
            <BreadcrumbPage className="truncate">{item.label}</BreadcrumbPage>
          </BreadcrumbItem>
        )}
        {isDashboard && (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Dashboard</BreadcrumbPage>
            </BreadcrumbItem>
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

function NotificationMenu() {
  const { data: auditData } = useSupabaseQuery(fetchRecentAuditEntries);
  const items = auditData ?? [];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Aktivitas terbaru">
          <Bell className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <p className="text-sm font-semibold text-ink">Aktivitas terbaru</p>
        </div>
        <ul className="max-h-80 divide-y divide-line overflow-y-auto">
          {items.map((item) => (
            <li key={item.id} className="flex gap-3 px-4 py-3 transition-colors hover:bg-background">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{item.action}</p>
                <p className="text-xs text-ink-muted">{item.user} · {item.module}</p>
                <p className="mt-1 text-[11px] text-ink-muted">{item.time}</p>
              </div>
            </li>
          ))}
          {items.length === 0 && <li className="px-4 py-5 text-sm text-ink-muted">Belum ada aktivitas.</li>}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

function UserMenu() {
  const { role } = useRole();

  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-right md:block">
        <p className="text-xs font-medium text-ink-muted">
          {role === 'admin' ? 'Admin / Pemilik' : 'Staff / Barista'}
        </p>
      </div>
      <UserButton
        signInUrl="/sign-in"
        appearance={{
          elements: {
            avatarBox: 'h-8 w-8',
          },
        }}
      />
    </div>
  );
}
