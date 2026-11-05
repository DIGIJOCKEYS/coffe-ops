import {
  ArrowUpFromLine,
  Building2,
  ClipboardCheck,
  FileBarChart,
  LayoutDashboard,
  Package,
  ScrollText,
  Settings,
  ShoppingBag,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

export type Role = 'admin' | 'staff';

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
};

export type NavGroup = {
  title: string;
  items: NavItem[];
};

const ALL_ROLES: Role[] = ['admin', 'staff'];
const ADMIN_ONLY: Role[] = ['admin'];

export const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Dashboard',
    items: [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ALL_ROLES }],
  },
  {
    title: 'Operasional',
    items: [
      { href: '/stock', label: 'Stok & Menu', icon: Package, roles: ADMIN_ONLY },
      { href: '/stock-takes', label: 'Mutasi Stok', icon: ArrowUpFromLine, roles: ALL_ROLES },
      { href: '/stock-opname', label: 'Stock Opname', icon: ClipboardCheck, roles: ADMIN_ONLY },
      { href: '/sales', label: 'Penjualan', icon: ShoppingBag, roles: ALL_ROLES },
      { href: '/expenses', label: 'Pengeluaran', icon: Wallet, roles: ALL_ROLES },
    ],
  },
  {
    title: 'Analisis',
    items: [
      { href: '/reports', label: 'Laporan', icon: FileBarChart, roles: ADMIN_ONLY },
      { href: '/audit-logs', label: 'Audit Log', icon: ScrollText, roles: ADMIN_ONLY },
    ],
  },
  {
    title: 'Pengaturan',
    items: [
      { href: '/users', label: 'Pengguna', icon: Users, roles: ADMIN_ONLY },
      { href: '/business', label: 'Pengaturan Bisnis', icon: Building2, roles: ADMIN_ONLY },
      { href: '/settings', label: 'Pengaturan Akun', icon: Settings, roles: ALL_ROLES },
    ],
  },
];

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

export function findNavItem(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => item.href === pathname);
}

export function findNavGroupTitle(href: string): string | undefined {
  return NAV_GROUPS.find((group) => group.items.some((item) => item.href === href))?.title;
}

export function canAccess(role: Role, item: NavItem): boolean {
  return item.roles.includes(role);
}
