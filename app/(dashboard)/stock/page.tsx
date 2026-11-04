'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { Eye, Pencil, Plus, Search } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { DataState } from '@/components/shared/data-state';
import { useAuth, useRole } from '@/components/layout/role-context';
import { Badge } from '@/components/ui/badge';
import { StockStatusBadge } from '@/components/shared/stock-status-badge';
import { TablePagination } from '@/components/shared/table-pagination';
import { usePagination } from '@/hooks/use-pagination';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useSupabaseRealtime } from '@/hooks/use-supabase-realtime';
import { formatNumber, formatRupiah } from '@/lib/format';
import type { StockItem, StockItemInput, StockStatus } from '@/types/operations';
import { fetchStockItems, saveStockItem } from '@/lib/operations-data';
import { getStockStatus } from '@/lib/stock';
import { cn } from '@/lib/utils';
import { useSupabaseQuery } from '@/hooks/use-supabase-query';

const StockDetailSheet = dynamic(() => import('@/components/stock/stock-detail-sheet').then((mod) => mod.StockDetailSheet), {
  ssr: false,
  loading: () => null,
});

const StockFormDialog = dynamic(() => import('@/components/stock/stock-form-dialog').then((mod) => mod.StockFormDialog), {
  ssr: false,
  loading: () => null,
});

const STATUS_OPTIONS: { value: 'all' | StockStatus; label: string }[] = [
  { value: 'all', label: 'Semua status' },
  { value: 'aman', label: 'Aman' },
  { value: 'menipis', label: 'Menipis' },
  { value: 'habis', label: 'Habis' },
  { value: 'kritis', label: 'Kritis' },
];

export default function StockPage() {
  const { role } = useRole();
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: stockData, loading, error: loadError, refresh } = useSupabaseQuery(fetchStockItems);
  useSupabaseRealtime(['stock_items'], refresh);
  const items = stockData ?? [];
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState<'all' | StockStatus>('all');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<StockItem | null>(null);

  const categories = Array.from(new Set(items.map((item) => item.category))).sort();
  const filtered = items.filter((item) => {
    const matchesQuery = item.name.toLowerCase().includes(query.trim().toLowerCase());
    const matchesCategory = category === 'all' || item.category === category;
    const matchesStatus = status === 'all' || getStockStatus(item) === status;
    return matchesQuery && matchesCategory && matchesStatus;
  });
  const { page, totalPages, paged, total, pageSize, setPage } = usePagination(filtered, 10);
  useEffect(() => {
    setPage(1);
  }, [query, category, status, setPage]);
  const detailItem = items.find((item) => item.id === detailId) ?? null;
  const isAdmin = role === 'admin';

  const openCreate = () => {
    setEditTarget(null);
    setFormOpen(true);
  };

  const openEdit = (item: StockItem) => {
    setDetailId(null);
    setEditTarget(item);
    setFormOpen(true);
  };

  const handleSave = async (input: StockItemInput) => {
    setSaving(true);
    setSaveError(null);
    try {
      if (!user?.id) throw new Error('Sesi pengguna tidak ditemukan. Silakan login kembali.');
      await saveStockItem(input, user.id, editTarget?.id);
      await refresh();
      toast({ title: editTarget ? 'Stok & menu diperbarui' : 'Stok & menu ditambahkan', description: input.name });
      setFormOpen(false);
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'Gagal menyimpan stok.');
      throw cause;
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Stok & Menu"
        description="Pantau stok gudang dan stok outlet secara terpisah. Transfer dan penjualan memperbarui saldo masing-masing."
        actions={
          isAdmin && (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Tambah Stok & Menu
            </Button>
          )
        }
      />

      <DataState loading={loading} error={loadError} onRetry={refresh} />
      {saveError && <p className="mb-3 text-sm text-red-700">{saveError}</p>}
      {!loading && !loadError && (
      <div className="overflow-hidden rounded-xl border border-line bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-line p-4 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cari nama menu / item"
              className="pl-9"
              aria-label="Cari item stok"
            />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-full sm:w-44" aria-label="Filter kategori">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua kategori</SelectItem>
                {categories.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={(value) => setStatus(value as 'all' | StockStatus)}>
              <SelectTrigger className="w-full sm:w-44" aria-label="Filter status stok">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm font-medium text-ink">Item tidak ditemukan</p>
            <p className="mt-1 text-sm text-ink-muted">Coba ubah kata kunci atau filter yang dipakai.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-12">No.</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead className="text-right">Stok Gudang</TableHead>
                  <TableHead className="text-right">Stok Outlet</TableHead>
                  <TableHead className="text-right">Min. Outlet</TableHead>
                  <TableHead className="text-right">Harga Jual</TableHead>
                  <TableHead>Menu</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((item, index) => {
                  const itemStatus = getStockStatus(item);
                  return (
                    <TableRow key={item.id} className="group">
                      <TableCell className="font-medium text-ink-muted">{(page - 1) * pageSize + index + 1}</TableCell>
                      <TableCell className="font-medium text-ink">{item.name}</TableCell>
                      <TableCell className="text-ink-muted">{item.category}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums text-ink">
                        {formatNumber(item.stock)} {item.unit}
                      </TableCell>
                      <TableCell className={cn('text-right font-medium tabular-nums', itemStatus === 'aman' ? 'text-ink' : 'text-brand-dark')}>
                        {formatNumber(item.outletStock)} {item.unit}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-ink-muted">
                        {formatNumber(item.minStock)} {item.unit}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-ink-muted">{formatRupiah(item.price)}</TableCell>
                      <TableCell>
                        {item.available ? (
                          <Badge className="bg-emerald-50 text-emerald-700">Dijual</Badge>
                        ) : (
                          <Badge variant="outline" className="text-ink-muted">Tidak dijual</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <StockStatusBadge status={itemStatus} />
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setDetailId(item.id)} aria-label={`Detail ${item.name}`}>
                            <Eye className="h-4 w-4" />
                            Detail
                          </Button>
                          {isAdmin && (
                            <Button variant="ghost" size="sm" onClick={() => openEdit(item)} aria-label={`Edit ${item.name}`}>
                              <Pencil className="h-4 w-4" />
                              Edit
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
        <TablePagination page={page} pageCount={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} />
      </div>
      )}

      <StockDetailSheet
        item={detailItem}
        canEdit={isAdmin}
        onOpenChange={(open) => !open && setDetailId(null)}
        onEdit={() => detailItem && openEdit(detailItem)}
      />

      {formOpen && (
        <StockFormDialog
          key={editTarget?.id ?? 'new'}
          open={formOpen}
          onOpenChange={setFormOpen}
          initial={editTarget}
          categories={categories}
          onSubmit={handleSave}
          saving={saving}
        />
      )}
    </>
  );
}
