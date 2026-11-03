import Link from 'next/link';
import { ArrowRight, Clock3, Flame } from 'lucide-react';
import { CardShell } from '@/components/shared/card-shell';
import { StockStatusBadge } from '@/components/shared/stock-status-badge';
import { formatNumber, formatRupiah } from '@/lib/format';
import { getStockStatus } from '@/lib/stock';
import type { ActivityItem, Ingredient, Menu, TransactionItem } from '@/lib/mock-data';
import { cn } from '@/lib/utils';

const PAYMENT_STYLE: Record<TransactionItem['paymentMethod'], string> = {
  Tunai: 'bg-emerald-50 text-emerald-700',
  QRIS: 'bg-sky-50 text-sky-700',
  'Kartu Debit': 'bg-ink/5 text-ink',
};

const VIEW_ALL_LINK = 'text-xs font-medium text-brand transition-colors hover:text-brand-dark';

export function TopMenusCard({ menus }: { menus: Menu[] }) {
  const ranked = [...menus].sort((a, b) => b.soldToday - a.soldToday).slice(0, 5);
  const maxSold = ranked[0]?.soldToday ?? 1;

  return (
    <CardShell
      title="Menu Terlaris"
      description="Berdasarkan jumlah terjual hari ini"
      action={<Link href="/menus" className={VIEW_ALL_LINK}>Lihat menu</Link>}
    >
      <ol className="space-y-4">
        {ranked.map((menu, index) => (
          <li key={menu.id} className="group">
            <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-background text-xs font-semibold text-ink-muted">
                  {index + 1}
                </span>
                <span className="truncate font-medium text-ink">{menu.name}</span>
              </div>
              <span className="shrink-0 text-xs text-ink-muted">{formatNumber(menu.soldToday)} porsi</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-background">
              <div
                className={cn('h-full rounded-full transition-all duration-500', index === 0 ? 'bg-brand' : 'bg-ink/70')}
                style={{ width: `${(menu.soldToday / maxSold) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ol>
    </CardShell>
  );
}

export function LowStockCard({ ingredients }: { ingredients: Ingredient[] }) {
  const lowStock = ingredients
    .map((item) => ({ item, status: getStockStatus(item) }))
    .filter(({ status }) => status !== 'aman')
    .sort((a, b) => a.item.stock / a.item.minStock - b.item.stock / b.item.minStock);

  return (
    <CardShell
      title="Stok Menipis"
      description="Bahan baku yang perlu segera diisi ulang"
      action={<Link href="/ingredients" className={VIEW_ALL_LINK}>Kelola bahan</Link>}
    >
      {lowStock.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-muted">Semua stok bahan baku aman.</p>
      ) : (
        <ul className="divide-y divide-line">
          {lowStock.map(({ item, status }) => (
            <li key={item.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{item.name}</p>
                <p className="text-xs text-ink-muted">
                  Sisa {item.stock.toLocaleString('id-ID')} {item.baseUnit} · Minimum {item.minStock.toLocaleString('id-ID')} {item.baseUnit}
                </p>
              </div>
              <StockStatusBadge status={status} />
            </li>
          ))}
        </ul>
      )}
    </CardShell>
  );
}

export function ActivityCard({ activities }: { activities: ActivityItem[] }) {
  return (
    <CardShell title="Aktivitas Operasional Terbaru" description="Tercatat hari ini">
      <ol className="relative space-y-5 before:absolute before:inset-y-1 before:left-[7px] before:w-px before:bg-line">
        {activities.map((activity) => (
          <li key={activity.id} className="relative flex gap-4 pl-7">
            <span className="absolute left-0 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-white ring-1 ring-line">
              <span className="h-2 w-2 rounded-full bg-brand" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-ink">{activity.action}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-muted">
                <span className="font-medium text-ink/80">{activity.user}</span>
                <span aria-hidden>·</span>
                <span>{activity.module}</span>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1">
                  <Clock3 className="h-3 w-3" />
                  {activity.time}
                </span>
              </p>
            </div>
          </li>
        ))}
      </ol>
    </CardShell>
  );
}

export function RecentTransactionsCard({ transactions }: { transactions: TransactionItem[] }) {
  return (
    <CardShell
      title="Transaksi Terbaru"
      description="Lima transaksi terakhir"
      action={
        <Link href="/sales" className={cn(VIEW_ALL_LINK, 'inline-flex items-center gap-1')}>
          Semua penjualan <ArrowRight className="h-3 w-3" />
        </Link>
      }
    >
      <ul className="divide-y divide-line">
        {transactions.map((trx) => (
          <li key={trx.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-medium text-ink">
                <Flame className="h-3.5 w-3.5 shrink-0 text-brand" aria-hidden />
                <span className="truncate">{trx.itemsSummary}</span>
              </p>
              <p className="mt-1 flex items-center gap-2 text-xs text-ink-muted">
                <span>{trx.time}</span>
                <span className={cn('rounded-md px-1.5 py-0.5 text-[11px] font-medium', PAYMENT_STYLE[trx.paymentMethod])}>
                  {trx.paymentMethod}
                </span>
              </p>
            </div>
            <p className="shrink-0 text-sm font-semibold text-ink">{formatRupiah(trx.total)}</p>
          </li>
        ))}
      </ul>
    </CardShell>
  );
}
