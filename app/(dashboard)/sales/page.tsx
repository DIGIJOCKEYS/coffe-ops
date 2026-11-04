'use client';

import { useCallback, useEffect, useState } from 'react';
import { Eye, Pencil, Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { DataState } from '@/components/shared/data-state';
import { DateRangeFilter, type DateRange } from '@/components/shared/date-range-filter';
import { useAuth, useRole } from '@/components/layout/role-context';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useSupabaseRealtime } from '@/hooks/use-supabase-realtime';
import { usePagination } from '@/hooks/use-pagination';
import { TablePagination } from '@/components/shared/table-pagination';
import { formatNumber, formatRupiah } from '@/lib/format';
import {
  createShiftSale,
  deleteShiftSale,
  fetchSaleMenus,
  fetchShiftSales,
  todayJakarta,
  updateShiftSale,
} from '@/lib/operations-data';
import type { SalesLine, Shift, ShiftSales } from '@/types/operations';
import { useSupabaseQuery } from '@/hooks/use-supabase-query';

const SHIFTS: Shift[] = ['pagi-siang', 'siang-sore'];
const SHIFT_LABEL: Record<Shift, string> = { 'pagi-siang': 'Pagi–Siang', 'siang-sore': 'Siang–Sore' };
const DATE_FORMAT = new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });

type DraftLine = { itemId: string; name: string; price: number; qty: number };
const emptyLine = (): DraftLine => ({ itemId: '', name: '', price: 0, qty: 1 });

export default function SalesPage() {
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const { role } = useRole();
  const today = todayJakarta();
  const isAdmin = role === 'admin';
  const [dateRange, setDateRange] = useState<DateRange>({ from: today, to: today });

  // ── load data ──────────────────────────────────────────────────────────────
  const loadSales = useCallback(
    () => fetchShiftSales(dateRange.from, dateRange.to),
    [dateRange.from, dateRange.to],
  );
  const { data: salesData, loading, error: loadError, refresh } = useSupabaseQuery(loadSales);
  const { data: menuData, loading: menuLoading, error: menuError, refresh: refreshMenus } =
    useSupabaseQuery(fetchSaleMenus);
  useSupabaseRealtime(['shift_sales', 'sales_lines', 'stock_items'], refresh);

  const records = salesData ?? [];
  const menus = (menuData ?? []).filter((item) => item.available);
  const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const totalOmzet = records.reduce((sum, r) => sum + r.total, 0);
  const { page, pageSize, paged, total, totalPages, setPage } = usePagination(sorted, 10);
  useEffect(() => setPage(1), [dateRange.from, dateRange.to, setPage]);

  // ── create form state ──────────────────────────────────────────────────────
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [date, setDate] = useState(today);
  const [shift, setShift] = useState<Shift>('pagi-siang');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [error, setError] = useState<string | null>(null);
  const draftTotal = lines.reduce((sum, l) => sum + (l.itemId ? l.qty * l.price : 0), 0);

  // ── detail view state ──────────────────────────────────────────────────────
  const [detailRecord, setDetailRecord] = useState<ShiftSales | null>(null);

  // ── edit state ─────────────────────────────────────────────────────────────
  const [editRecord, setEditRecord] = useState<ShiftSales | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editShift, setEditShift] = useState<Shift>('pagi-siang');
  const [editNotes, setEditNotes] = useState('');
  const [editLines, setEditLines] = useState<DraftLine[]>([emptyLine()]);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const editTotal = editLines.reduce((sum, l) => sum + (l.itemId ? l.qty * l.price : 0), 0);

  // ── delete confirm state ───────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<ShiftSales | null>(null);
  const [deleting, setDeleting] = useState(false);

  const resetForm = () => {
    setDate(todayJakarta()); setShift('pagi-siang'); setNotes('');
    setLines([emptyLine()]); setError(null);
  };

  const updateLine = (index: number, patch: Partial<DraftLine>) =>
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  const updateEditLine = (index: number, patch: Partial<DraftLine>) =>
    setEditLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));

  const onItemSelect = (index: number, itemId: string) => {
    const item = menus.find((m) => m.id === itemId);
    if (item) { updateLine(index, { itemId: item.id, name: item.name, price: item.price }); setError(null); }
  };
  const onEditItemSelect = (index: number, itemId: string) => {
    const item = menus.find((m) => m.id === itemId);
    if (item) { updateEditLine(index, { itemId: item.id, name: item.name, price: item.price }); setEditError(null); }
  };

  const handleSubmit = async () => {
    const validLines = lines.filter((l) => l.itemId && Number.isFinite(l.qty) && l.qty > 0);
    if (!validLines.length) { setError('Tambahkan minimal satu menu.'); return; }
    if (!user?.id) { setError('Sesi pengguna tidak ditemukan.'); return; }

    const salesLines: SalesLine[] = validLines.map(({ itemId, name, qty, price }) => ({ itemId, name, qty, price }));
    setSaving(true);
    try {
      const savedTotal = await createShiftSale({ date, shift, notes: notes.trim() || undefined, lines: salesLines, userId: user.id });
      await refreshMenus();
      if (dateRange.from === date && dateRange.to === date) await refresh();
      else setDateRange({ from: date, to: date });
      toast({ title: 'Penjualan shift tercatat', description: `${SHIFT_LABEL[shift]} · ${formatRupiah(savedTotal)}` });
      resetForm(); setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal menyimpan penjualan.');
    } finally { setSaving(false); }
  };

  const openEdit = (record: ShiftSales) => {
    setEditRecord(record);
    setEditDate(record.date);
    setEditShift(record.shift);
    setEditNotes(record.notes ?? '');
    setEditLines(record.lines.map((l) => ({ itemId: l.itemId, name: l.name, price: l.price, qty: l.qty })));
    setEditError(null);
  };

  const handleEdit = async () => {
    if (!editRecord || !user?.id) return;
    const validLines = editLines.filter((l) => l.itemId && Number.isFinite(l.qty) && l.qty > 0);
    if (!validLines.length) { setEditError('Tambahkan minimal satu menu.'); return; }
    const salesLines: SalesLine[] = validLines.map(({ itemId, name, qty, price }) => ({ itemId, name, qty, price }));
    setEditSaving(true);
    try {
      const newTotal = await updateShiftSale(
        editRecord.id,
        { date: editDate, shift: editShift, notes: editNotes.trim() || undefined, lines: salesLines },
        user.id,
        profile?.name ?? user.fullName ?? 'Pengguna',
      );
      await refresh();
      toast({ title: 'Penjualan diperbarui', description: `${SHIFT_LABEL[editShift]} · ${formatRupiah(newTotal)}` });
      setEditRecord(null);
    } catch (cause) {
      setEditError(cause instanceof Error ? cause.message : 'Gagal memperbarui penjualan.');
    } finally { setEditSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !user?.id) return;
    setDeleting(true);
    try {
      await deleteShiftSale(deleteTarget.id, user.id, profile?.name ?? user.fullName ?? 'Pengguna');
      await refresh();
      toast({ title: 'Penjualan dihapus' });
      setDeleteTarget(null);
    } catch (cause) {
      toast({ title: 'Gagal menghapus', description: cause instanceof Error ? cause.message : 'Terjadi kesalahan.', variant: 'destructive' });
    } finally { setDeleting(false); }
  };

  return (
    <>
      <PageHeader
        title="Penjualan"
        description={isAdmin ? 'Riwayat transaksi per shift.' : 'Catat penjualan per shift; saldo Outlet berkurang otomatis.'}
        actions={(
          <div className="flex flex-wrap items-end gap-3">
            <DateRangeFilter value={dateRange} onChange={setDateRange} />
            {!isAdmin && (
              <Button onClick={() => { resetForm(); setOpen(true); }}>
                <Plus className="h-4 w-4" />Input Penjualan Shift
              </Button>
            )}
          </div>
        )}
      />

      {isAdmin && (
        <div className="my-5 rounded-lg border border-line bg-white px-4 py-3 text-sm text-ink-muted">
          Mode lihat saja. Penjualan dicatat oleh Staff.
        </div>
      )}
      <DataState loading={loading} error={loadError} onRetry={refresh} />
      {!loading && !loadError && (
        <>
          <div className="mb-4 flex items-center justify-between rounded-xl border border-line bg-white px-5 py-4 shadow-sm">
            <p className="text-sm font-medium text-ink-muted">Total omzet periode</p>
            <p className="text-xl font-bold text-ink">{formatRupiah(totalOmzet)}</p>
          </div>

          <div className="overflow-hidden rounded-xl border border-line bg-white shadow-sm">
            {sorted.length === 0 ? (
              <div className="px-6 py-16 text-center text-sm text-ink-muted">Belum ada penjualan pada rentang ini.</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-12">No.</TableHead>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Shift</TableHead>
                      <TableHead>Menu</TableHead>
                      <TableHead className="text-right">Porsi</TableHead>
                      <TableHead>Pencatat</TableHead>
                      <TableHead className="text-right">Omzet</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paged.map((record, index) => {
                      const portions = record.lines.reduce((sum, l) => sum + l.qty, 0);
                      const canModify = isAdmin || record.recordedBy === (profile?.name ?? user?.fullName);
                      return (
                        <TableRow key={record.id}>
                          <TableCell className="font-medium text-ink-muted">{(page - 1) * pageSize + index + 1}</TableCell>
                          <TableCell className="whitespace-nowrap text-ink-muted">{DATE_FORMAT.format(new Date(record.date))}</TableCell>
                          <TableCell className="font-medium text-ink">{SHIFT_LABEL[record.shift]}</TableCell>
                          <TableCell className="max-w-sm text-sm text-ink-muted">{record.lines.map((l) => `${l.name} ×${l.qty}`).join(', ')}</TableCell>
                          <TableCell className="text-right tabular-nums text-ink-muted">{formatNumber(portions)}</TableCell>
                          <TableCell className="text-ink-muted">{record.recordedBy}</TableCell>
                          <TableCell className="text-right font-semibold tabular-nums text-ink">{formatRupiah(record.total)}</TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="sm" onClick={() => setDetailRecord(record)} aria-label="Detail">
                                <Eye className="h-4 w-4" />
                              </Button>
                              {canModify && (
                                <>
                                  <Button variant="ghost" size="sm" onClick={() => openEdit(record)} aria-label="Edit">
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => setDeleteTarget(record)} aria-label="Hapus">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </>
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
        </>
      )}

      {/* ─── Detail Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={Boolean(detailRecord)} onOpenChange={(v) => { if (!v) setDetailRecord(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Detail Penjualan Shift</DialogTitle>
          </DialogHeader>
          {detailRecord && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <span className="text-ink-muted">Tanggal</span>
                <span className="font-medium">{DATE_FORMAT.format(new Date(detailRecord.date))}</span>
                <span className="text-ink-muted">Shift</span>
                <span>{SHIFT_LABEL[detailRecord.shift]}</span>
                <span className="text-ink-muted">Pencatat</span>
                <span>{detailRecord.recordedBy}</span>
                {detailRecord.notes && (
                  <><span className="text-ink-muted">Catatan</span><span>{detailRecord.notes}</span></>
                )}
              </div>
              <div className="mt-2">
                <p className="mb-2 text-xs font-semibold text-ink-muted uppercase tracking-wide">Rincian menu</p>
                <div className="divide-y divide-line rounded-lg border border-line">
                  {detailRecord.lines.map((l) => (
                    <div key={l.itemId} className="flex items-center justify-between px-3 py-2">
                      <span>{l.name} ×{l.qty}</span>
                      <span className="tabular-nums text-ink-muted">{formatRupiah(l.price * l.qty)}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between bg-background px-3 py-2 font-semibold">
                    <span>Total</span>
                    <span className="tabular-nums text-ink">{formatRupiah(detailRecord.total)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailRecord(null)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Edit Dialog ───────────────────────────────────────────────────── */}
      <Dialog open={Boolean(editRecord)} onOpenChange={(v) => { if (!v) setEditRecord(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Penjualan Shift</DialogTitle>
            <DialogDescription>Perbarui detail penjualan shift.</DialogDescription>
          </DialogHeader>
          {menuLoading ? (
            <p className="py-4 text-sm text-ink-muted">Memuat menu…</p>
          ) : menuError ? (
            <p className="py-4 text-sm text-brand-dark">{menuError}</p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-ink-muted">Tanggal</Label>
                  <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-ink-muted">Shift</Label>
                  <Select value={editShift} onValueChange={(v) => setEditShift(v as Shift)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SHIFTS.map((v) => <SelectItem key={v} value={v}>{SHIFT_LABEL[v]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-ink-muted">Rincian menu</Label>
                {editLines.map((line, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Select value={line.itemId} onValueChange={(v) => onEditItemSelect(idx, v)}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder="Pilih menu" /></SelectTrigger>
                      <SelectContent>
                        {menus.map((m) => <SelectItem key={m.id} value={m.id}>{m.name} · {formatRupiah(m.price)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input type="number" min={1} step={1} value={line.qty}
                      onChange={(e) => updateEditLine(idx, { qty: Number(e.target.value) })} className="w-20" />
                    <span className="hidden w-20 shrink-0 text-right text-sm tabular-nums text-ink-muted sm:block">
                      {line.itemId ? formatRupiah(line.qty * line.price) : '—'}
                    </span>
                    <Button type="button" variant="ghost" size="icon"
                      onClick={() => setEditLines((prev) => prev.filter((_, i) => i !== idx))}
                      disabled={editLines.length === 1}>
                      <Trash2 className="h-4 w-4 text-ink-muted" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => setEditLines((prev) => [...prev, emptyLine()])}>
                  <Plus className="h-4 w-4" />Tambah menu
                </Button>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-line bg-ink-50/40 px-4 py-3">
                <span className="text-sm font-medium text-ink">Total</span>
                <span className="text-lg font-bold text-ink">{formatRupiah(editTotal)}</span>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-ink-muted">Catatan</Label>
                <Input value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Catatan (opsional)" />
              </div>
              {editError && <p className="text-sm text-brand-dark">{editError}</p>}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditRecord(null)}>Batal</Button>
            <Button onClick={handleEdit} disabled={editSaving || menuLoading}>{editSaving ? 'Menyimpan...' : 'Simpan'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirm Dialog ──────────────────────────────────────────── */}
      <Dialog open={Boolean(deleteTarget)} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Hapus Penjualan</DialogTitle>
            <DialogDescription>
              Yakin ingin menghapus penjualan <strong>{deleteTarget ? SHIFT_LABEL[deleteTarget.shift] : ''}</strong>{' '}
              tanggal {deleteTarget ? DATE_FORMAT.format(new Date(deleteTarget.date)) : ''}?
              Tindakan ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Batal</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>{deleting ? 'Menghapus...' : 'Hapus'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Create Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Input Penjualan Shift</DialogTitle>
            <DialogDescription>Catat rincian menu; jumlah divalidasi terhadap saldo outlet saat disimpan.</DialogDescription>
          </DialogHeader>
          {menuLoading ? <p className="py-4 text-sm text-ink-muted">Memuat menu…</p> : menuError ? <p className="py-4 text-sm text-brand-dark">{menuError}</p> : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-ink-muted">Tanggal</Label>
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-ink-muted">Shift</Label>
                  <Select value={shift} onValueChange={(v) => setShift(v as Shift)}>
                    <SelectTrigger aria-label="Pilih shift"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SHIFTS.map((v) => <SelectItem key={v} value={v}>{SHIFT_LABEL[v]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-xs text-ink-muted">Pencatat: {profile?.name ?? user?.fullName ?? 'Pengguna yang login'}</p>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-ink-muted">Rincian menu</Label>
                {lines.map((line, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Select value={line.itemId} onValueChange={(v) => onItemSelect(idx, v)}>
                      <SelectTrigger className="flex-1" aria-label={`Menu baris ${idx + 1}`}><SelectValue placeholder="Pilih menu" /></SelectTrigger>
                      <SelectContent>
                        {menus.map((m) => <SelectItem key={m.id} value={m.id}>{m.name} · {formatRupiah(m.price)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input type="number" min={1} step={1} value={line.qty}
                      onChange={(e) => updateLine(idx, { qty: Number(e.target.value) })} className="w-20" aria-label="Jumlah" />
                    <span className="hidden w-20 shrink-0 text-right text-sm tabular-nums text-ink-muted sm:block">
                      {line.itemId ? formatRupiah(line.qty * line.price) : '—'}
                    </span>
                    <Button type="button" variant="ghost" size="icon"
                      onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                      disabled={lines.length === 1} aria-label="Hapus baris">
                      <Trash2 className="h-4 w-4 text-ink-muted" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => setLines((prev) => [...prev, emptyLine()])}>
                  <Plus className="h-4 w-4" />Tambah menu
                </Button>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-line bg-ink-50/40 px-4 py-3">
                <span className="text-sm font-medium text-ink">Total omzet shift</span>
                <span className="text-lg font-bold text-ink">{formatRupiah(draftTotal)}</span>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-ink-muted">Catatan (opsional)</Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Catatan shift" />
              </div>
              {error && <p className="text-sm text-brand-dark">{error}</p>}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={handleSubmit} disabled={saving || menuLoading}>{saving ? 'Menyimpan...' : 'Simpan'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
