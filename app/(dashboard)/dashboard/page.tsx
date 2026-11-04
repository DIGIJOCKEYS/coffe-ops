'use client';

import dynamic from 'next/dynamic';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { DataState } from '@/components/shared/data-state';
import { PageHeader } from '@/components/layout/page-header';
import { useAuth, useRole } from '@/components/layout/role-context';
import { Input } from '@/components/ui/input';
import { useSupabaseRealtime } from '@/hooks/use-supabase-realtime';
import { useSupabaseQuery } from '@/hooks/use-supabase-query';
import { KpiCards, StaffDailyCards } from '@/components/dashboard/kpi-cards';
import { omzetChange, summarizeToday } from '@/lib/metrics';
import { fetchDashboardData, todayJakarta } from '@/lib/operations-data';

const SalesCharts = dynamic(() => import('@/components/dashboard/sales-charts').then((mod) => mod.SalesCharts), {
  ssr: false,
  loading: () => <div className="h-72 animate-pulse rounded-xl border border-line bg-background" />,
});

const { ActivityCard, LowStockCard, ShiftSalesCard, TopMenusCard } = {
  ActivityCard: dynamic(() => import('@/components/dashboard/dashboard-lists').then((mod) => mod.ActivityCard), {
    ssr: false,
    loading: () => <div className="h-52 animate-pulse rounded-xl border border-line bg-background" />,
  }),
  LowStockCard: dynamic(() => import('@/components/dashboard/dashboard-lists').then((mod) => mod.LowStockCard), {
    ssr: false,
    loading: () => <div className="h-52 animate-pulse rounded-xl border border-line bg-background" />,
  }),
  ShiftSalesCard: dynamic(() => import('@/components/dashboard/dashboard-lists').then((mod) => mod.ShiftSalesCard), {
    ssr: false,
    loading: () => <div className="h-52 animate-pulse rounded-xl border border-line bg-background" />,
  }),
  // TopMenusCard kept for admin only
  TopMenusCard: dynamic(() => import('@/components/dashboard/dashboard-lists').then((mod) => mod.TopMenusCard), {
    ssr: false,
    loading: () => <div className="h-52 animate-pulse rounded-xl border border-line bg-background" />,
  }),
};

const DAY_LABEL = new Intl.DateTimeFormat('id-ID', { weekday: 'short', timeZone: 'Asia/Jakarta' });
const LONG_DATE = new Intl.DateTimeFormat('id-ID', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Asia/Jakarta',
});

export default function DashboardPage() {
  const { user } = useAuth();
  const { role } = useRole();
  const userId = user?.id;
  const today = todayJakarta();
  const [selectedDate, setSelectedDate] = useState(today);
  useEffect(() => {
    if (role !== 'staff') return;
    const timer = window.setInterval(() => {
      const currentToday = todayJakarta();
      setSelectedDate((previous) => previous === today ? currentToday : previous);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [role, today]);
  const dashboardDate = role === 'staff' ? selectedDate : today;
  const loadDashboard = useCallback(() => fetchDashboardData(userId, role, dashboardDate), [userId, role, dashboardDate]);
  const { data, loading, error, refresh } = useSupabaseQuery(loadDashboard, Boolean(userId));
  const refreshDashboard = useCallback(() => refresh(), [refresh]);
  useSupabaseRealtime(['stock_items', 'shift_sales', 'sales_lines', 'expenses', 'stock_takes', 'audit_entries'], refreshDashboard);
  const dateLabel = LONG_DATE.format(new Date(`${dashboardDate}T12:00:00+07:00`));
  const daily = (data?.daily ?? []).map((day) => ({
    ...day,
    label: DAY_LABEL.format(new Date(`${day.date}T12:00:00+07:00`)),
  }));
  const dailySales = data?.sales ?? [];
  const dailyTakes = data?.stockTakes ?? [];
  const summary = {
    ...summarizeToday(dailySales, data?.stockItems ?? [], data?.expenses ?? [], dailyTakes),
    omzetChange: omzetChange(daily),
  };
  const stockItems = data?.stockItems ?? [];
  const damagedTotal = dailyTakes
    .filter((take) => take.kind === 'rusak')
    .reduce((sum, take) => sum + take.qty, 0);
  const operationalExpenses = (data?.expenses ?? [])
    .filter((e) => e.category === 'Operasional' || e.category === 'Lainnya')
    .reduce((sum, expense) => sum + expense.amount, 0);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Ringkasan operasional Nestation, ${dateLabel}.`}
        actions={role === 'staff' ? (
          <Input
            type="date"
            value={selectedDate}
            max={today}
            onChange={(event) => setSelectedDate(event.target.value)}
            aria-label="Pilih tanggal data dashboard"
            className="w-44"
          />
        ) : null}
      />
      <DataState loading={loading} error={error} onRetry={refresh} />
      {!loading && !error && data && (
        <div className="space-y-6">
          {role === 'staff' ? (
            <>
              {/* Staff: hanya KPI harian, detail shift penjualan — tanpa grafik, menu terlaris, aktivitas */}
              <StaffDailyCards
                salesCount={dailySales.length}
                damaged={damagedTotal}
                operationalExpenses={operationalExpenses}
                dateLabel={dateLabel}
              />
              <Suspense fallback={<div className="h-52 animate-pulse rounded-xl border border-line bg-background" />}>
                <ShiftSalesCard sales={dailySales} dateLabel={dateLabel} />
              </Suspense>
            </>
          ) : (
            <>
              {/* Admin: KPI penuh + grafik + semua widget */}
              <KpiCards summary={summary} />
              <Suspense fallback={<div className="h-72 animate-pulse rounded-xl border border-line bg-background" />}>
                <SalesCharts daily={daily} monthly={data.monthly} />
              </Suspense>
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                <Suspense fallback={<div className="h-52 animate-pulse rounded-xl border border-line bg-background" />}>
                  <TopMenusCard sales={dailySales} dateLabel={dateLabel} />
                </Suspense>
                <Suspense fallback={<div className="h-52 animate-pulse rounded-xl border border-line bg-background" />}>
                  <LowStockCard items={stockItems} available={data.inventorySnapshotAvailable} />
                </Suspense>
                <Suspense fallback={<div className="h-52 animate-pulse rounded-xl border border-line bg-background" />}>
                  <ActivityCard entries={data.auditEntries} dateLabel={dateLabel} />
                </Suspense>
              </div>
              <Suspense fallback={<div className="h-52 animate-pulse rounded-xl border border-line bg-background" />}>
                <ShiftSalesCard sales={dailySales} dateLabel={dateLabel} />
              </Suspense>
            </>
          )}
        </div>
      )}
    </>
  );
}
