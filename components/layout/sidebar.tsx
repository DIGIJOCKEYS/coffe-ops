'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
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
          <Link href="/dashboard" onClick={onNavigate} className="flex items-center gap-2 min-w-0">
            {collapsed ? (
              /* Collapsed: kotak merah + huruf N */
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#e00000] shadow-sm">
                <span className="text-base font-black text-white leading-none">N</span>
              </span>
            ) : (
              /* Expanded: ikon SVG + teks — bekerja di light & dark */
              <div className="flex items-center gap-2">
                <svg width="28" height="28" viewBox="0 0 36 36" fill="none" className="shrink-0">
                  <circle cx="18" cy="18" r="18" fill="#e00000" />
                  <ellipse cx="18" cy="18" rx="10" ry="7" fill="#ff6b00" transform="rotate(-30 18 18)" />
                  <ellipse cx="18" cy="18" rx="6" ry="3.5" fill="#e00000" transform="rotate(-30 18 18)" />
                  <ellipse cx="14" cy="14" rx="4" ry="2.5" fill="#ffa500" opacity="0.7" transform="rotate(-30 14 14)" />
                </svg>
                <span className="text-sm font-black tracking-wider text-foreground uppercase">Nestation</span>
              </div>
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
