'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { DataState } from '@/components/shared/data-state';
import { useAuth } from '@/components/layout/role-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { usePagination } from '@/hooks/use-pagination';
import { TablePagination } from '@/components/shared/table-pagination';
import { formatNumber } from '@/lib/format';
import { fetchStockItems, saveStockCounts } from '@/lib/operations-data';
import type { StockItem } from '@/types/operations';
import { useSupabaseQuery } from '@/hooks/use-supabase-query';

export default function StockOpnamePage() {
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const { data: stockData, loading, error: loadError, refresh } = useSupabaseQuery(fetchStockItems);
  const items = useMemo(() => stockData ?? [], [stockData]);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setCounts(Object.fromEntries(items.map((item) => [item.id, String(item.stock)])));
  }, [items]);

  const rows = items.map((item) => {
    const rawCount = counts[item.id];
    const fisik = Number(rawCount);
    const valid = rawCount !== undefined && rawCount !== '' && Number.isFinite(fisik) && fisik >= 0;
    const selisih = valid ? fisik - item.stock : 0;
    return { item, fisik: valid ? fisik : 0, valid, selisih };
  });

  const lebih = rows.filter((row) => row.selisih > 0).length;
  const kurang = rows.filter((row) => row.selisih < 0).length;
  const tepat = rows.filter((row) => row.selisih === 0).length;
  const hasInvalid = rows.some((row) => !row.valid);
  const { page, totalPages, paged, total, pageSize, setPage } = usePagination(rows, 10);

  const handleSave = async () => {
    if (hasInvalid) return;
    if (!user?.id) {
      setSaveError('Sesi pengguna tidak ditemukan. Silakan login kembali.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await saveStockCounts(
        rows.map(({ item, fisik }) => ({ id: item.id, name: item.name, before: item.stock, after: fisik })),
        user.id,
        profile?.name ?? user.fullName ?? 'Pengguna',
      );
      await refresh();
      if (lebih === 0 && kurang === 0) {
        toast({ title: 'Stok sesuai', description: 'Tidak ada selisih. Semua stok fisik cocok dengan tercatat.' });
      } else {
        toast({ title: 'Opname disimpan', description: `${lebih + kurang} item disesuaikan · ${lebih} lebih, ${kurang} kurang.` });
      }
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'Gagal menyimpan stock opname.');
      await refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Stock Opname"
        description="Hitung ulang stok fisik, bandingkan dengan yang tercatat, lalu simpan. Selisih tercatat untuk audit."
        actions={
          <Button onClick={handleSave} disabled={hasInvalid || saving}>
            <Check className="h-4 w-4" />
            {saving ? 'Menyimpan...' : 'Simpan Opname'}
          </Button>
        }
      />

      <DataState loading={loading} error={loadError} onRetry={refresh} />
      {saveError && <p className="mb-3 text-sm text-red-700">{saveError}</p>}
      {!loading && !loadError && (
      <>
      <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryTile label="Total item" value={formatNumber(rows.length)} />
        <SummaryTile label="Tepat" value={formatNumber(tepat)} tone="emerald" />
        <SummaryTile label="Lebih" value={formatNumber(lebih)} tone="sky" />
        <SummaryTile label="Kurang" value={formatNumber(kurang)} tone="brand" />
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-white shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Nama</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead className="text-right">Stok Tercatat</TableHead>
                <TableHead className="text-right">Stok Fisik</TableHead>
                <TableHead className="text-right">Selisih</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map(({ item, fisik, valid, selisih }) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium text-ink">{item.name}</TableCell>
                  <TableCell className="text-ink-muted">{item.category}</TableCell>
                  <TableCell className="text-right tabular-nums text-ink-muted">
                    {formatNumber(item.stock)} {item.unit}
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      min={0}
                      step="any"
                      value={counts[item.id] ?? ''}
                      onChange={(event) => setCounts((prev) => ({ ...prev, [item.id]: event.target.value }))}
                      className="ml-auto w-28 text-right tabular-nums"
                      aria-label={`Stok fisik ${item.name}`}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    {!valid ? (
                      <Badge variant="outline" className="text-brand-dark">tidak valid</Badge>
                    ) : selisih === 0 ? (
                      <span className="text-sm tabular-nums text-ink-muted">0 {item.unit}</span>
                    ) : selisih > 0 ? (
                      <Badge className="bg-sky-50 text-sky-700">+{formatNumber(selisih)} {item.unit}</Badge>
                    ) : (
                      <Badge className="bg-brand/10 text-brand-dark">{formatNumber(selisih)} {item.unit}</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <TablePagination page={page} pageCount={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} />
      </div>

      <p className="mt-3 text-xs text-ink-muted">
        Perubahan disimpan ke Supabase dan selisihnya dicatat pada Audit Log.
      </p>
      </>
      )}
    </>
  );
}

const TONE_STYLE: Record<string, string> = {
  emerald: 'text-emerald-700',
  sky: 'text-sky-700',
  brand: 'text-brand-dark',
};

function SummaryTile({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-line bg-white px-5 py-4 shadow-sm">
      <p className="text-sm font-medium text-ink-muted">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${tone ? TONE_STYLE[tone] : 'text-ink'}`}>{value}</p>
    </div>
  );
}
