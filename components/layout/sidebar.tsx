'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Coffee, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { canAccess, NAV_GROUPS, type NavItem } from '@/lib/nav-config';
import { cn } from '@/lib/utils';
import { useRole } from '@/components/layout/role-context';

type SidebarNavProps = {
  collapsed: boolean;
  onToggleCollapsed?: () => void;
  onNavigate?: () => void;
};

export function SidebarNav({ collapsed, onToggleCollapsed, onNavigate }: SidebarNavProps) {
  const pathname = usePathname();
  const { role } = useRole();

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex h-full flex-col">
        <div
          className={cn(
            'flex h-16 items-center border-b border-line',
            collapsed ? 'justify-center px-2' : 'justify-between px-5',
          )}
        >
          <Link href="/dashboard" onClick={onNavigate} className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand text-white shadow-sm">
              <Coffee className="h-5 w-5" />
            </span>
            {!collapsed && (
              <span className="text-sm font-bold tracking-wider text-ink">COFFEE OPS</span>
            )}
          </Link>
          {onToggleCollapsed && !collapsed && (
            <button
              type="button"
              onClick={onToggleCollapsed}
              aria-label="Ciutkan sidebar"
              className="hidden rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-background hover:text-ink lg:inline-flex"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {NAV_GROUPS.map((group) => {
            const visibleItems = group.items.filter((item) => canAccess(role, item));
            if (visibleItems.length === 0) return null;
            return (
              <div key={group.title} className="mb-5 last:mb-0">
                {collapsed ? (
                  <div className="mx-auto mb-2 h-px w-6 bg-line" />
                ) : (
                  <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
                    {group.title}
                  </p>
                )}
                <ul className="space-y-1">
                  {visibleItems.map((item) => (
                    <li key={item.href}>
                      <SidebarLink
                        item={item}
                        active={pathname === item.href}
                        collapsed={collapsed}
                        onNavigate={onNavigate}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </nav>

        {onToggleCollapsed && collapsed && (
          <div className="border-t border-line p-3">
            <button
              type="button"
              onClick={onToggleCollapsed}
              aria-label="Perluas sidebar"
              className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl text-ink-muted transition-colors hover:bg-background hover:text-ink"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

function SidebarLink({
  item,
  active,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group relative flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-200',
        collapsed ? 'h-10 w-10 justify-center mx-auto' : 'px-3 py-2.5',
        active
          ? 'bg-brand/10 text-brand-dark'
          : 'text-ink-muted hover:bg-background hover:text-ink',
      )}
    >
      {active && !collapsed && (
        <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-brand" />
      )}
      <Icon className={cn('h-[18px] w-[18px] shrink-0', active && 'text-brand')} />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );

  if (!collapsed) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}
