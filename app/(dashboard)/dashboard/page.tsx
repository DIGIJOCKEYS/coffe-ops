'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { ActivityCard, LowStockCard, ShiftSalesCard, TopMenusCard } from '@/components/dashboard/dashboard-lists';
import { KpiCards } from '@/components/dashboard/kpi-cards';
import { SalesCharts } from '@/components/dashboard/sales-charts';
import { DataState } from '@/components/shared/data-state';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { useSupabaseQuery } from '@/hooks/use-supabase-query';
import { omzetChange, summarizeToday } from '@/lib/metrics';
import { fetchDashboardData } from '@/lib/operations-data';

const DAY_LABEL = new Intl.DateTimeFormat('id-ID', { weekday: 'short', timeZone: 'Asia/Jakarta' });
const LONG_DATE = new Intl.DateTimeFormat('id-ID', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Asia/Jakarta',
});

export default function DashboardPage() {
  const { data, loading, error, refresh } = useSupabaseQuery(fetchDashboardData);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
  const daily = (data?.daily ?? []).map((day) => ({
    ...day,
    label: DAY_LABEL.format(new Date(`${day.date}T12:00:00+07:00`)),
  }));
  const todaySales = (data?.sales ?? []).filter((shift) => shift.date === today);
  const summary = {
    ...summarizeToday(todaySales, data?.stockItems ?? [], data?.expenses ?? []),
    omzetChange: omzetChange(daily),
  };

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Ringkasan operasional kedai, ${LONG_DATE.format(new Date())}.`}
        actions={
          <>
            <Button variant="outline" asChild><Link href="/stock-takes">Ambil Barang</Link></Button>
            <Button asChild><Link href="/sales"><Plus className="h-4 w-4" />Input Penjualan</Link></Button>
          </>
        }
      />
      <DataState loading={loading} error={error} onRetry={refresh} />
      {!loading && !error && data && (
        <div className="space-y-6">
          <KpiCards summary={summary} />
          <SalesCharts daily={daily} monthly={data.monthly} />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <TopMenusCard sales={todaySales} />
            <LowStockCard items={data.stockItems} />
            <ActivityCard entries={data.auditEntries} />
          </div>
          <ShiftSalesCard sales={todaySales} />
        </div>
      )}
    </>
  );
}
