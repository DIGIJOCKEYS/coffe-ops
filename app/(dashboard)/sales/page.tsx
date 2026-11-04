'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { DataState } from '@/components/shared/data-state';
import { useAuth } from '@/components/layout/role-context';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { usePagination } from '@/hooks/use-pagination';
import { TablePagination } from '@/components/shared/table-pagination';
import { formatNumber, formatRupiah } from '@/lib/format';
import { createShiftSale, fetchShiftSales, fetchStockItems, todayJakarta } from '@/lib/operations-data';
import type { SalesLine, Shift } from '@/types/operations';
import { useSupabaseQuery } from '@/hooks/use-supabase-query';

const SHIFTS: Shift[] = ['pagi-siang', 'siang-sore'];
const SHIFT_LABEL: Record<Shift, string> = { 'pagi-siang': 'Pagi–Siang', 'siang-sore': 'Siang–Sore' };
const DATE_FORMAT = new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });

type DraftLine = { itemId: string; name: string; price: number; qty: number };

function emptyLine(): DraftLine {
  return { itemId: '', name: '', price: 0, qty: 1 };
}

export default function SalesPage() {
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const { data: salesData, loading: salesLoading, error: salesError, refresh: refreshSales } = useSupabaseQuery(fetchShiftSales);
  const { data: stockData, loading: stockLoading, error: stockError, refresh: refreshStock } = useSupabaseQuery(fetchStockItems);
  const records = salesData ?? [];
  const stockItems = stockData ?? [];
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  const [date, setDate] = useState(todayJakarta());
  const [shift, setShift] = useState<Shift>('pagi-siang');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setDate(todayJakarta());
    setShift('pagi-siang');
    setNotes('');
    setLines([emptyLine()]);
    setError(null);
  };

  const updateLine = (index: number, patch: Partial<DraftLine>) =>
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));

  const onItemSelect = (index: number, itemId: string) => {
    const item = availableMenus.find((m) => m.id === itemId);
    if (item) {
      updateLine(index, { itemId: item.id, name: item.name, price: item.price });
    }
  };

  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (index: number) => setLines((prev) => prev.filter((_, i) => i !== index));

  const draftTotal = lines.reduce((sum, line) => sum + (line.itemId ? line.qty * line.price : 0), 0);

  const availableMenus = stockItems.filter((item) => item.available);

  const handleSubmit = async () => {
    const validLines = lines.filter((line) => line.itemId && line.qty > 0);
    if (validLines.length === 0) {
      setError('Tambahkan minimal satu menu dengan jumlah lebih dari 0.');
      return;
    }
    if (!user?.id) {
      setError('Sesi pengguna tidak ditemukan. Silakan login kembali.');
      return;
    }

    const salesLines: SalesLine[] = validLines.map((line) => ({
      itemId: line.itemId,
      name: line.name,
      qty: line.qty,
      price: line.price,
    }));
    const total = salesLines.reduce((sum, line) => sum + line.qty * line.price, 0);
    setSaving(true);
    try {
      await createShiftSale({
      date,
      shift,
      total,
      notes: notes.trim() || undefined,
      lines: salesLines,
      userId: user.id,
      userName: profile?.name ?? user.fullName ?? 'Pengguna',
      });
      await refreshSales();
      toast({ title: 'Penjualan shift tercatat', description: `${SHIFT_LABEL[shift]} · ${formatRupiah(total)}` });
      resetForm();
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal menyimpan penjualan.');
    } finally {
      setSaving(false);
    }
  };

  const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const totalOmzet = records.reduce((sum, record) => sum + record.total, 0);
  const { page, totalPages, paged, total, pageSize, setPage } = usePagination(sorted, 10);

  return (
    <>
      <PageHeader
        title="Penjualan"
        description="Input penjualan per shift untuk sinkron audit dengan sistem kasir."
        actions={
          <Button onClick={() => { resetForm(); setOpen(true); }}>
            <Plus className="h-4 w-4" />
            Input Penjualan Shift
          </Button>
        }
      />

      <DataState
        loading={salesLoading || stockLoading}
        error={salesError ?? stockError}
        onRetry={() => { refreshSales(); refreshStock(); }}
      />
      {!salesLoading && !stockLoading && !salesError && !stockError && (
      <>
      <div className="mb-4 flex items-center justify-between rounded-xl border border-line bg-white px-5 py-4 shadow-sm">
        <p className="text-sm font-medium text-ink-muted">Total omzet tercatat</p>
        <p className="text-xl font-bold text-ink">{formatRupiah(totalOmzet)}</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-white shadow-sm">
        {sorted.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm font-medium text-ink">Belum ada penjualan</p>
            <p className="mt-1 text-sm text-ink-muted">Catat penjualan per shift untuk melacak omzet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Shift</TableHead>
                  <TableHead>Menu</TableHead>
                  <TableHead className="text-right">Porsi</TableHead>
                  <TableHead>Pencatat</TableHead>
                  <TableHead className="text-right">Omzet</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((record) => {
                  const portions = record.lines.reduce((sum, line) => sum + line.qty, 0);
                  return (
                    <TableRow key={record.id}>
                      <TableCell className="whitespace-nowrap text-ink-muted">{DATE_FORMAT.format(new Date(record.date))}</TableCell>
                      <TableCell className="font-medium text-ink">{SHIFT_LABEL[record.shift]}</TableCell>
                      <TableCell className="max-w-sm text-sm text-ink-muted">
                        {record.lines.map((line) => `${line.name} ×${line.qty}`).join(', ')}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-ink-muted">{formatNumber(portions)}</TableCell>
                      <TableCell className="text-ink-muted">{record.recordedBy}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-ink">{formatRupiah(record.total)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
        <TablePagination page={page} pageCount={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} />
      </div>

      <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) resetForm(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Input Penjualan Shift</DialogTitle>
            <DialogDescription>Catat omzet dan rincian menu per shift untuk audit.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-ink-muted">Tanggal</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-ink-muted">Shift</Label>
                <Select value={shift} onValueChange={(value) => setShift(value as Shift)}>
                  <SelectTrigger aria-label="Pilih shift">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SHIFTS.map((value) => (
                      <SelectItem key={value} value={value}>{SHIFT_LABEL[value]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <p className="text-xs text-ink-muted">Pencatat: {profile?.name ?? user?.fullName ?? 'Pengguna yang login'}</p>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-ink-muted">Rincian menu</Label>
              <div className="space-y-2">
                {lines.map((line, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Select value={line.itemId} onValueChange={(value) => onItemSelect(index, value)}>
                      <SelectTrigger className="flex-1" aria-label={`Menu baris ${index + 1}`}>
                        <SelectValue placeholder="Pilih menu" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableMenus.map((menu) => (
                          <SelectItem key={menu.id} value={menu.id}>
                            {menu.name} · {formatRupiah(menu.price)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min={1}
                      value={line.qty}
                      onChange={(e) => updateLine(index, { qty: Number(e.target.value) })}
                      className="w-20"
                      aria-label="Jumlah"
                    />
                    <span className="hidden w-20 shrink-0 text-right text-sm tabular-nums text-ink-muted sm:block">
                      {line.itemId ? formatRupiah(line.qty * line.price) : '—'}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeLine(index)}
                      disabled={lines.length === 1}
                      aria-label="Hapus baris"
                    >
                      <Trash2 className="h-4 w-4 text-ink-muted" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addLine}>
                <Plus className="h-4 w-4" />
                Tambah menu
              </Button>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-line bg-ink-50/40 px-4 py-3">
              <span className="text-sm font-medium text-ink">Total omzet shift</span>
              <span className="text-lg font-bold text-ink">{formatRupiah(draftTotal)}</span>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-ink-muted">Catatan (opsional)</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Contoh: Sync dari kasir" />
            </div>

            {error && <p className="text-sm text-brand-dark">{error}</p>}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={handleSubmit} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </>
      )}
    </>
  );
}
