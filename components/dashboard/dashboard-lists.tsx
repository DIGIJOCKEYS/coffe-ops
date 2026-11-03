import Link from 'next/link';
import { ArrowRight, Clock3, Coffee } from 'lucide-react';
import { CardShell } from '@/components/shared/card-shell';
import { StockStatusBadge } from '@/components/shared/stock-status-badge';
import { formatNumber, formatRupiah } from '@/lib/format';
import { aggregateSalesByItem } from '@/lib/metrics';
import { getStockStatus } from '@/lib/stock';
import type { AuditEntry, Shift, ShiftSales, StockItem } from '@/lib/mock-data';
import { cn } from '@/lib/utils';

const VIEW_ALL_LINK = 'text-xs font-medium text-brand transition-colors hover:text-brand-dark';

const SHIFT_LABEL: Record<Shift, string> = {
  'pagi-siang': 'Pagi–Siang',
  'siang-sore': 'Siang–Sore',
};

export function TopMenusCard({ sales }: { sales: ShiftSales[] }) {
  const aggregated = Array.from(aggregateSalesByItem(sales).values()).sort((a, b) => b.qty - a.qty).slice(0, 5);
  const maxSold = aggregated[0]?.qty ?? 1;

  return (
    <CardShell
      title="Menu Terlaris"
      description="Berdasarkan porsi terjual hari ini"
      action={<Link href="/sales" className={VIEW_ALL_LINK}>Lihat penjualan</Link>}
    >
      {aggregated.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-muted">Belum ada penjualan tercatat.</p>
      ) : (
        <ol className="space-y-4">
          {aggregated.map((item, index) => (
            <li key={item.name} className="group">
              <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-background text-xs font-semibold text-ink-muted">
                    {index + 1}
                  </span>
                  <span className="truncate font-medium text-ink">{item.name}</span>
                </div>
                <span className="shrink-0 text-xs text-ink-muted">{formatNumber(item.qty)} porsi</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-background">
                <div
                  className={cn('h-full rounded-full transition-all duration-500', index === 0 ? 'bg-brand' : 'bg-ink/70')}
                  style={{ width: `${(item.qty / maxSold) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ol>
      )}
    </CardShell>
  );
}

export function LowStockCard({ items }: { items: StockItem[] }) {
  const lowStock = items
    .map((item) => ({ item, status: getStockStatus(item) }))
    .filter(({ status }) => status !== 'aman')
    .sort((a, b) => a.item.stock / a.item.minStock - b.item.stock / b.item.minStock);

  return (
    <CardShell
      title="Stok Menipis"
      description="Item yang perlu segera diisi ulang"
      action={<Link href="/stock" className={VIEW_ALL_LINK}>Kelola stok</Link>}
    >
      {lowStock.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-muted">Semua stok aman.</p>
      ) : (
        <ul className="divide-y divide-line">
          {lowStock.map(({ item, status }) => (
            <li key={item.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{item.name}</p>
                <p className="text-xs text-ink-muted">
                  Sisa {formatNumber(item.stock)} {item.unit} · Minimum {formatNumber(item.minStock)} {item.unit}
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

export function ActivityCard({ entries }: { entries: AuditEntry[] }) {
  return (
    <CardShell title="Aktivitas Terbaru" description="Linimasa audit hari ini">
      <ol className="relative space-y-5 before:absolute before:inset-y-1 before:left-[7px] before:w-px before:bg-line">
        {entries.map((entry) => (
          <li key={entry.id} className="relative flex gap-4 pl-7">
            <span className="absolute left-0 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-white ring-1 ring-line">
              <span className="h-2 w-2 rounded-full bg-brand" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-ink">{entry.action}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-muted">
                <span className="font-medium text-ink/80">{entry.user}</span>
                <span aria-hidden>·</span>
                <span>{entry.module}</span>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1">
                  <Clock3 className="h-3 w-3" />
                  {entry.time}
                </span>
              </p>
            </div>
          </li>
        ))}
      </ol>
    </CardShell>
  );
}

export function ShiftSalesCard({ sales }: { sales: ShiftSales[] }) {
  return (
    <CardShell
      title="Penjualan Shift Hari Ini"
      description="Rincian per shift"
      action={
        <Link href="/sales" className={cn(VIEW_ALL_LINK, 'inline-flex items-center gap-1')}>
          Semua penjualan <ArrowRight className="h-3 w-3" />
        </Link>
      }
    >
      {sales.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-muted">Belum ada penjualan shift tercatat.</p>
      ) : (
        <ul className="divide-y divide-line">
          {sales.map((shift) => {
            const portions = shift.lines.reduce((sum, line) => sum + line.qty, 0);
            return (
              <li key={shift.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-medium text-ink">
                    <Coffee className="h-3.5 w-3.5 shrink-0 text-brand" aria-hidden />
                    Shift {SHIFT_LABEL[shift.shift]}
                  </p>
                  <p className="mt-1 text-xs text-ink-muted">
                    {formatNumber(portions)} porsi · {shift.lines.length} menu
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold text-ink">{formatRupiah(shift.total)}</p>
              </li>
            );
          })}
        </ul>
      )}
    </CardShell>
  );
}
