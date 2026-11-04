'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CardShell } from '@/components/shared/card-shell';
import { formatCompactRupiah, formatRupiah } from '@/lib/format';
import type { DailySales, MonthlySales } from '@/types/operations';

const AXIS_STYLE = { fontSize: 12, fill: '#777777' };

export function SalesCharts({
  daily,
  monthly,
}: {
  daily: (DailySales & { label: string })[];
  monthly: MonthlySales[];
}) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
      <CardShell
        title="Penjualan 7 Hari Terakhir"
        description="Omzet harian dalam rupiah"
        className="xl:col-span-3"
      >
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#E8E8E8" />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={AXIS_STYLE} />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={AXIS_STYLE}
                tickFormatter={(value: number) => formatCompactRupiah(value)}
                width={56}
              />
              <Tooltip
                cursor={{ fill: 'rgba(200, 16, 46, 0.06)' }}
                formatter={(value: number) => formatRupiah(value)}
                contentStyle={{ borderRadius: 12, border: '1px solid #E8E8E8', fontSize: 12 }}
              />
              <Bar dataKey="omzet" name="Omzet" fill="#C8102E" radius={[6, 6, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardShell>

      <CardShell title="Penjualan Bulanan" description="Total omzet 6 bulan terakhir" className="xl:col-span-2">
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#E8E8E8" />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={AXIS_STYLE} />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={AXIS_STYLE}
                tickFormatter={(value: number) => formatCompactRupiah(value)}
                width={56}
              />
              <Tooltip
                cursor={{ fill: 'rgba(119, 119, 119, 0.08)' }}
                formatter={(value: number) => formatRupiah(value)}
                contentStyle={{ borderRadius: 12, border: '1px solid #E8E8E8', fontSize: 12 }}
              />
              <Bar dataKey="omzet" name="Omzet" fill="#252525" radius={[6, 6, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardShell>
    </div>
  );
}
