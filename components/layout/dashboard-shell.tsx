'use client';

import { useState, type ReactNode } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Toaster } from '@/components/ui/toaster';
import { Navbar } from '@/components/layout/navbar';
import { RoleGuard } from '@/components/layout/role-guard';
import { AuthProvider } from '@/components/layout/role-context';
import { SidebarNav } from '@/components/layout/sidebar';
import { cn } from '@/lib/utils';

export function DashboardShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <AuthProvider>
      <div className="min-h-screen bg-background">
        <aside
          data-sidebar
          className={cn(
            'fixed inset-y-0 left-0 z-30 hidden border-r border-line bg-white transition-[width] duration-300 ease-out lg:block',
            collapsed ? 'w-[76px]' : 'w-64',
          )}
        >
          <SidebarNav collapsed={collapsed} onToggleCollapsed={() => setCollapsed((value) => !value)} />
        </aside>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-72 p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Menu navigasi</SheetTitle>
              <SheetDescription>Pilih halaman yang ingin dibuka</SheetDescription>
            </SheetHeader>
            <SidebarNav collapsed={false} onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>

        <div
          data-main-wrapper
          className={cn(
            'flex min-h-screen flex-col transition-[padding] duration-300 ease-out',
            collapsed ? 'lg:pl-[76px]' : 'lg:pl-64',
          )}
        >
          <Navbar onOpenMobileMenu={() => setMobileOpen(true)} />
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <div className="mx-auto w-full max-w-7xl">
              <RoleGuard>{children}</RoleGuard>
            </div>
          </main>
        </div>
      </div>
      <Toaster />
    </AuthProvider>
  );
}
