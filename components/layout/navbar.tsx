'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, CheckCheck, Menu, Moon, Sun } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAuth } from '@/components/layout/role-context';
import { UserMenu } from '@/components/layout/user-menu';
import { useTheme } from '@/components/layout/theme-provider';
import { findNavGroupTitle, findNavItem } from '@/lib/nav-config';
import {
  fetchNotifications,
  fetchUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/operations-data';
import { useSupabaseQuery } from '@/hooks/use-supabase-query';
import { useSupabaseRealtime } from '@/hooks/use-supabase-realtime';
import { useToast } from '@/hooks/use-toast';

export function Navbar({ onOpenMobileMenu }: { onOpenMobileMenu: () => void }) {
  const { theme, toggle } = useTheme();
  return (
    <header data-navbar className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-card/90 px-4 backdrop-blur supports-[backdrop-filter]:bg-card/80 sm:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onOpenMobileMenu} aria-label="Buka menu">
        <Menu className="h-5 w-5" />
      </Button>
      <NavBreadcrumb />
      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        {/* Dark mode toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggle}
          aria-label={theme === 'dark' ? 'Mode terang' : 'Mode gelap'}
          className="text-muted-foreground hover:text-foreground"
        >
          {theme === 'dark'
            ? <Sun className="h-4 w-4" />
            : <Moon className="h-4 w-4" />
          }
        </Button>
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
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const userId = user?.id;
  const router = useRouter();
  const { toast } = useToast();
  const loadNotifications = useCallback(
    () => userId ? fetchNotifications(userId) : Promise.resolve([]),
    [userId],
  );
  const loadUnreadCount = useCallback(
    () => userId ? fetchUnreadNotificationCount(userId) : Promise.resolve(0),
    [userId],
  );
  const { data: itemsData, refresh: refreshNotifications } = useSupabaseQuery(loadNotifications, open && Boolean(userId));
  const { data: unreadData, refresh: refreshUnread } = useSupabaseQuery(loadUnreadCount, Boolean(userId));
  const items = itemsData ?? [];
  const unreadCount = unreadData ?? 0;
  const refreshNotificationData = useCallback(() => {
    refreshUnread();
    if (open) refreshNotifications();
  }, [open, refreshNotifications, refreshUnread]);
  useSupabaseRealtime(['audit_entries', 'audit_entry_reads'], refreshNotificationData, Boolean(userId));

  const openNotification = async (entryId: string, href: string) => {
    if (!userId) return;
    try {
      await markNotificationRead(userId, entryId);
      refreshUnread();
      refreshNotifications();
      setOpen(false);
      router.push(href);
    } catch (cause) {
      toast({
        title: 'Notifikasi gagal diperbarui',
        description: cause instanceof Error ? cause.message : 'Coba lagi.',
        variant: 'destructive',
      });
    }
  };

  const readAll = async () => {
    if (!userId) return;
    try {
      await markAllNotificationsRead(userId);
      refreshUnread();
      refreshNotifications();
    } catch (cause) {
      toast({
        title: 'Notifikasi gagal diperbarui',
        description: cause instanceof Error ? cause.message : 'Coba lagi.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={unreadCount ? `Notifikasi, ${unreadCount} belum dibaca` : 'Notifikasi'}>
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-none text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 bg-popover border-border">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-semibold text-foreground">Notifikasi</p>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-8 gap-1 px-2 text-xs" onClick={readAll}>
              <CheckCheck className="h-4 w-4" />
              Baca semua
            </Button>
          )}
        </div>
        <ul className="max-h-80 divide-y divide-border overflow-y-auto">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => openNotification(item.id, item.href)}
                className={`flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-accent ${
                  item.isRead
                    ? 'bg-popover'
                    : 'bg-red-50/70 dark:bg-red-950/30'
                }`}
              >
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.isRead ? 'bg-muted-foreground/30' : 'bg-red-600'}`} />
                <span className="min-w-0">
                  <span className={`block text-sm ${item.isRead ? 'font-normal text-muted-foreground' : 'font-semibold text-foreground'}`}>
                    {item.action}
                  </span>
                  <span className="block text-xs text-muted-foreground">{item.user} · {item.module}</span>
                  <span className="mt-1 block text-[11px] text-muted-foreground">{item.time}</span>
                </span>
              </button>
            </li>
          ))}
          {items.length === 0 && (
            <li className="px-4 py-5 text-sm text-muted-foreground">Belum ada aktivitas.</li>
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}


