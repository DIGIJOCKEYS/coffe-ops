import Link from 'next/link';
import { Plus } from 'lucide-react';
import { ActivityCard, LowStockCard, RecentTransactionsCard, TopMenusCard } from '@/components/dashboard/dashboard-lists';
import { KpiCards } from '@/components/dashboard/kpi-cards';
import { SalesCharts } from '@/components/dashboard/sales-charts';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { estimateHppRatio, summarizeDay } from '@/lib/metrics';
import { activities, dailySales, ingredients, menus, monthlySales, recentTransactions } from '@/lib/mock-data';

const DAY_LABEL = new Intl.DateTimeFormat('id-ID', { weekday: 'short', timeZone: 'Asia/Jakarta' });
const LONG_DATE = new Intl.DateTimeFormat('id-ID', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Asia/Jakarta',
});

export default function DashboardPage() {
  const daily = dailySales.map((day) => ({
    ...day,
    label: DAY_LABEL.format(new Date(`${day.date}T12:00:00+07:00`)),
  }));
  const today = daily[daily.length - 1];
  const yesterday = daily[daily.length - 2];
  const summary = {
    ...summarizeDay(today, estimateHppRatio(menus)),
    omzetChange: ((today.omzet - yesterday.omzet) / yesterday.omzet) * 100,
  };

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Ringkasan operasional kedai, ${LONG_DATE.format(new Date('2026-11-03T12:00:00+07:00'))}.`}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/receipts">Penerimaan Stok</Link>
            </Button>
            <Button asChild>
              <Link href="/sales">
                <Plus className="h-4 w-4" />
                Input Penjualan
              </Link>
            </Button>
          </>
        }
      />

      <div className="space-y-6">
        <KpiCards summary={summary} />
        <SalesCharts daily={daily} monthly={monthlySales} />
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <TopMenusCard menus={menus} />
          <LowStockCard ingredients={ingredients} />
          <ActivityCard activities={activities} />
        </div>
        <RecentTransactionsCard transactions={recentTransactions} />
      </div>
    </>
  );
}
