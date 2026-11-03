'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, LogOut, Menu, User } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/layout/role-context';
import { findNavGroupTitle, findNavItem } from '@/lib/nav-config';
import { notifications as initialNotifications } from '@/lib/mock-data';
import { cn } from '@/lib/utils';

function initialsOf(name: string, fallback: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback.slice(0, 2).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function Navbar({ onOpenMobileMenu }: { onOpenMobileMenu: () => void }) {
  return (
    <header data-navbar className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-white/90 px-4 backdrop-blur supports-[backdrop-filter]:bg-white/75 sm:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onOpenMobileMenu} aria-label="Buka menu">
        <Menu className="h-5 w-5" />
      </Button>
      <NavBreadcrumb />
      <div className="ml-auto flex items-center gap-1 sm:gap-2">
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
  const [items, setItems] = useState(initialNotifications);
  const { toast } = useToast();
  const unreadCount = items.filter((item) => !item.read).length;

  const markAllRead = () => {
    setItems((prev) => prev.map((item) => ({ ...item, read: true })));
    toast({ title: 'Semua notifikasi ditandai dibaca' });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifikasi">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold text-white ring-2 ring-white">
              {unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <p className="text-sm font-semibold text-ink">Notifikasi</p>
          <button
            type="button"
            onClick={markAllRead}
            disabled={unreadCount === 0}
            className="text-xs font-medium text-brand transition-colors hover:text-brand-dark disabled:text-ink-muted"
          >
            Tandai semua dibaca
          </button>
        </div>
        <ul className="max-h-80 divide-y divide-line overflow-y-auto">
          {items.map((item) => (
            <li key={item.id} className="flex gap-3 px-4 py-3 transition-colors hover:bg-background">
              <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', item.read ? 'bg-transparent' : 'bg-brand')} />
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{item.title}</p>
                <p className="text-xs text-ink-muted">{item.description}</p>
                <p className="mt-1 text-[11px] text-ink-muted">{item.time}</p>
              </div>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

function UserMenu() {
  const { user, profile, role, signOut } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const displayName = profile?.name || user?.email || 'Pengguna';
  const fallback = (user?.email ?? '??').slice(0, 2).toUpperCase();

  const handleLogout = async () => {
    await signOut();
    toast({ title: 'Berhasil keluar' });
    router.push('/login');
    router.refresh();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-3 rounded-xl py-1.5 pl-1.5 pr-2 transition-colors hover:bg-background"
          aria-label="Menu profil"
        >
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-brand/10 text-xs font-semibold text-brand-dark">
              {initialsOf(profile?.name ?? '', fallback)}
            </AvatarFallback>
          </Avatar>
          <div className="hidden text-left md:block">
            <p className="max-w-[12rem] truncate text-sm font-semibold leading-tight text-ink">{displayName}</p>
            <p className="text-xs text-ink-muted">{role === 'admin' ? 'Admin / Pemilik' : 'Staff / Barista'}</p>
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-semibold text-ink">{displayName}</p>
          <p className="truncate text-xs text-ink-muted">{user?.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings" className="cursor-pointer">
            <User className="mr-2 h-4 w-4" />
            Profil saya
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handleLogout} className="cursor-pointer text-brand-dark focus:text-brand-dark">
          <LogOut className="mr-2 h-4 w-4" />
          Keluar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
