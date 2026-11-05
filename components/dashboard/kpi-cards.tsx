'use client';

import { AlertTriangle, Calculator, CupSoda, Layers, PackagePlus, TrendingUp, Wallet, Wrench, type LucideIcon } from 'lucide-react';
import { useRole } from '@/components/layout/role-context';
import { formatNumber, formatRupiah } from '@/lib/format';
import { cn } from '@/lib/utils';

export type DashboardSummary = {
  omzet: number;
  portions: number;
  estimatedHpp: number;
  transferCost: number;
  lossCost: number;
  operatingCost: number;
  stockExpense: number;
  operationalExpense: number;
  otherExpense: number;
  totalExpense: number;
  estimatedProfit: number;
  omzetChange: number;
};

type KpiItem = {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  highlight?: boolean;
  danger?: boolean;
};

export function KpiCards({ summary }: { summary: DashboardSummary }) {
  const { role } = useRole();

  const items: KpiItem[] = [
    {
      label: 'Omzet Hari Ini',
      value: formatRupiah(summary.omzet),
      hint: `${summary.omzetChange >= 0 ? '+' : ''}${summary.omzetChange.toFixed(1).replace('.', ',')}% dibanding kemarin`,
      icon: Wallet,
      highlight: true,
    },
    {
      label: 'Estimasi HPP',
      value: formatRupiah(summary.estimatedHpp),
      hint: 'Modal pokok barang keluar/ditransfer',
      icon: Calculator,
    },
    {
      label: 'Pengeluaran Stok',
      value: formatRupiah(summary.stockExpense),
      hint: 'Pembelian restock gudang',
      icon: PackagePlus,
    },
    {
      label: 'Pengeluaran Operasional',
      value: formatRupiah(summary.operationalExpense),
      hint: 'Biaya operasional outlet/toko',
      icon: Wrench,
    },
    {
      label: 'Pengeluaran Lainnya',
      value: formatRupiah(summary.otherExpense),
      hint: 'Biaya non-operasional lainnya',
      icon: Layers,
    },
    {
      label: 'Kerugian Stok',
      value: formatRupiah(summary.lossCost),
      hint: 'Nilai barang rusak/tumpah hari ini',
      icon: AlertTriangle,
      danger: summary.lossCost > 0,
    },
    {
      label: 'Porsi Terjual',
      value: formatNumber(summary.portions),
      hint: 'Dari penjualan shift hari ini',
      icon: CupSoda,
    },
  ];

  if (role === 'admin') {
    items.push({
      label: 'Estimasi Laba',
      value: formatRupiah(summary.estimatedProfit),
      hint: 'Omzet − HPP − Kerugian − Operasional − Lainnya',
      icon: TrendingUp,
      highlight: summary.estimatedProfit > 0,
      danger: summary.estimatedProfit < 0,
    });
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <KpiCard key={item.label} item={item} />
      ))}
    </div>
  );
}

export function StaffDailyCards({
  salesCount,
  damaged,
  operationalExpenses,
  dateLabel,
}: {
  salesCount: number;
  damaged: number;
  operationalExpenses: number;
  dateLabel: string;
}) {
  const items: KpiItem[] = [
    {
      label: 'Penjualan Shift Tercatat',
      value: formatNumber(salesCount),
      hint: `Transaksi pada ${dateLabel}`,
      icon: CupSoda,
    },
    {
      label: 'Pengeluaran Operasional',
      value: formatRupiah(operationalExpenses),
      hint: `Catatan Anda pada ${dateLabel}`,
      icon: Wallet,
    },
    {
      label: 'Rusak / Tumpah',
      value: formatNumber(damaged),
      hint: `Jumlah tercatat pada ${dateLabel}`,
      icon: AlertTriangle,
      highlight: damaged > 0,
      danger: damaged > 0,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {items.map((item) => (
        <KpiCard key={item.label} item={item} />
      ))}
    </div>
  );
}

function KpiCard({ item }: { item: KpiItem }) {
  const Icon = item.icon;
  return (
    <div className="group rounded-xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-muted-foreground">{item.label}</p>
        <span
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
            item.danger
              ? 'bg-red-50 text-red-600'
              : item.highlight
              ? 'bg-brand text-white'
              : 'bg-background text-ink-muted group-hover:text-ink',
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className={cn('mt-3 text-2xl font-bold tracking-tight', item.danger ? 'text-red-500 dark:text-red-400' : 'text-foreground')}>
        {item.value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{item.hint}</p>
    </div>
  );
}
