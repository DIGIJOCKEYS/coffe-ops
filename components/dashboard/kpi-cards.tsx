'use client';

import { Calculator, CupSoda, Receipt, TrendingUp, Wallet, type LucideIcon } from 'lucide-react';
import { useRole } from '@/components/layout/role-context';
import { formatNumber, formatRupiah } from '@/lib/format';
import { cn } from '@/lib/utils';

export type DashboardSummary = {
  omzet: number;
  portions: number;
  estimatedHpp: number;
  estimatedProfit: number;
  omzetChange: number;
};

type KpiItem = {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  highlight?: boolean;
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
      label: 'Porsi Terjual',
      value: formatNumber(summary.portions),
      hint: 'Dari penjualan shift hari ini',
      icon: CupSoda,
    },
    {
      label: 'Estimasi HPP',
      value: formatRupiah(summary.estimatedHpp),
      hint: 'Berdasarkan harga beli per bungkus',
      icon: Calculator,
    },
  ];

  if (role === 'admin') {
    items.push({
      label: 'Estimasi Laba Operasional',
      value: formatRupiah(summary.estimatedProfit),
      hint: 'Omzet - HPP - pengeluaran operasional',
      icon: TrendingUp,
    });
  }

  return (
    <div className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2', items.length === 4 ? 'xl:grid-cols-4' : 'xl:grid-cols-3')}>
      {items.map((item) => (
        <KpiCard key={item.label} item={item} />
      ))}
    </div>
  );
}

function KpiCard({ item }: { item: KpiItem }) {
  const Icon = item.icon;
  return (
    <div className="group rounded-xl border border-line bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-ink-muted">{item.label}</p>
        <span
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
            item.highlight ? 'bg-brand text-white' : 'bg-background text-ink-muted group-hover:text-ink',
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight text-ink">{item.value}</p>
      <p className="mt-1 text-xs text-ink-muted">{item.hint}</p>
    </div>
  );
}
