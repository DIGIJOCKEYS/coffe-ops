'use client';

import { CardShell } from '@/components/shared/card-shell';
import { StockStatusBadge } from '@/components/shared/stock-status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { DataState } from '@/components/shared/data-state';
import { ReportToolbar } from '@/components/reports/report-toolbar';
import { formatNumber, formatRupiah } from '@/lib/format';
import { aggregateSalesByItem, summarizeToday } from '@/lib/metrics';
import { getStockStatus } from '@/lib/stock';
import { fetchReportData, todayJakarta } from '@/lib/operations-data';
import { useSupabaseQuery } from '@/hooks/use-supabase-query';
import type { ExpenseCategory, Shift } from '@/types/operations';
import { cn } from '@/lib/utils';

const SHIFT_LABEL: Record<Shift, string> = { 'pagi-siang': 'Pagi–Siang', 'siang-sore': 'Siang–Sore' };

const EXPENSE_CATEGORIES: ExpenseCategory[] = ['Pembelian Stok', 'Operasional', 'Lainnya'];

export default function ReportsPage() {
  const { data, loading, error, refresh } = useSupabaseQuery(fetchReportData);
  const expenses = data?.expenses ?? [];
  const shiftSales = data?.shiftSales ?? [];
  const stockItems = data?.stockItems ?? [];
  const stockTakes = data?.stockTakes ?? [];
  const today = todayJakarta();
  const todaySales = shiftSales.filter((shift) => shift.date === today);
  const todayExpenses = expenses.filter((expense) => expense.date === today);
  const summary = summarizeToday(todaySales, stockItems, todayExpenses);

  const expenseByCategory = EXPENSE_CATEGORIES.map((category) => ({
    category,
    total: todayExpenses.filter((expense) => expense.category === category).reduce((sum, expense) => sum + expense.amount, 0),
  }));

  const statusCounts = stockItems.reduce(
    (acc, item) => {
      acc[getStockStatus(item)] += 1;
      return acc;
    },
    { aman: 0, menipis: 0, kritis: 0, habis: 0 } as Record<string, number>,
  );

  const topMenus = Array.from(aggregateSalesByItem(todaySales).values()).sort((a, b) => b.qty - a.qty).slice(0, 5);
  const maxSold = topMenus[0]?.qty ?? 1;

  const wasteTakes = stockTakes.filter((take) => take.kind === 'rusak');
  const wasteQty = wasteTakes.reduce((sum, take) => sum + take.qty, 0);
  const wasteLoss = wasteTakes.reduce((sum, take) => {
    const item = stockItems.find((i) => i.id === take.itemId);
    return sum + take.qty * (item?.unitCost ?? 0);
  }, 0);

  return (
    <>
      <PageHeader
        title="Laporan"
        description={`Ringkasan operasional, ${new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeZone: 'Asia/Jakarta' }).format(new Date(`${today}T12:00:00+07:00`))}.`}
        actions={<ReportToolbar />}
      />

      <DataState loading={loading} error={error} onRetry={refresh} />
      {!loading && !error && (
      <div className="space-y-6">
        {/* Ringkasan keuangan */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SummaryCard label="Omzet Hari Ini" value={formatRupiah(summary.omzet)} highlight />
          <SummaryCard label="Estimasi HPP" value={formatRupiah(summary.estimatedHpp)} />
          <SummaryCard label="Estimasi Laba" value={formatRupiah(summary.estimatedProfit)} hint="Omzet - HPP - biaya operasional" />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {/* Penjualan per shift */}
          <CardShell title="Penjualan per Shift" description="Rincian omzet hari ini">
            {todaySales.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-muted">Belum ada penjualan tercatat.</p>
            ) : (
              <ul className="divide-y divide-line">
                {todaySales.map((shift) => {
                  const portions = shift.lines.reduce((sum, line) => sum + line.qty, 0);
                  return (
                    <li key={shift.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                      <div>
                        <p className="text-sm font-medium text-ink">Shift {SHIFT_LABEL[shift.shift]}</p>
                        <p className="text-xs text-ink-muted">{formatNumber(portions)} porsi · {shift.lines.length} menu</p>
                      </div>
                      <p className="text-sm font-semibold text-ink">{formatRupiah(shift.total)}</p>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardShell>

          {/* Pengeluaran per kategori */}
          <CardShell title="Pengeluaran per Kategori" description="Total pengeluaran tercatat">
            <ul className="divide-y divide-line">
              {expenseByCategory.map(({ category, total }) => (
                <li key={category} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                  <p className="text-sm font-medium text-ink">{category}</p>
                  <p className="text-sm font-semibold text-ink">{formatRupiah(total)}</p>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
              <p className="text-sm font-medium text-ink-muted">Total</p>
              <p className="text-sm font-bold text-ink">{formatRupiah(expenseByCategory.reduce((sum, item) => sum + item.total, 0))}</p>
            </div>
          </CardShell>

          {/* Ringkasan status stok */}
          <CardShell title="Ringkasan Stok" description="Status seluruh item">
            <div className="grid grid-cols-2 gap-4">
              {(['aman', 'menipis', 'kritis', 'habis'] as const).map((status) => (
                <div key={status} className="flex items-center justify-between rounded-lg border border-line px-4 py-3">
                  <StockStatusBadge status={status} />
                  <span className="text-lg font-bold text-ink">{statusCounts[status]}</span>
                </div>
              ))}
            </div>
          </CardShell>

          {/* Menu terlaris */}
          <CardShell title="Menu Terlaris" description="Berdasarkan porsi terjual hari ini">
            {topMenus.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-muted">Belum ada penjualan tercatat.</p>
            ) : (
              <ol className="space-y-4">
                {topMenus.map((item, index) => (
                  <li key={item.name}>
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
                        className={cn('h-full rounded-full', index === 0 ? 'bg-brand' : 'bg-ink/70')}
                        style={{ width: `${(item.qty / maxSold) * 100}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardShell>

          {/* Kerugian stok (rusak/tumpah) */}
          <CardShell title="Kerugian Stok" description="Item rusak, tumpah, atau hilang">
            {wasteTakes.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-muted">Tidak ada kerugian tercatat.</p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-ink-muted">Total porsi rusak/tumpah</p>
                  <p className="text-sm font-semibold text-ink">{formatNumber(wasteQty)} porsi</p>
                </div>
                <div className="flex items-center justify-between border-t border-line pt-3">
                  <p className="text-sm text-ink-muted">Estimasi kerugian</p>
                  <p className="text-sm font-bold text-brand-dark">{formatRupiah(wasteLoss)}</p>
                </div>
              </div>
            )}
          </CardShell>
        </div>
      </div>
      )}
    </>
  );
}

function SummaryCard({ label, value, hint, highlight }: { label: string; value: string; hint?: string; highlight?: boolean }) {
  return (
    <div className={cn('rounded-xl border border-line bg-white p-5 shadow-sm', highlight && 'ring-1 ring-brand/20')}>
      <p className="text-sm font-medium text-ink-muted">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight text-ink">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}
