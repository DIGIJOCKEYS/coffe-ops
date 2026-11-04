'use client';

import { useCallback, useEffect, useState, type ChangeEvent } from 'react';
import { Camera, Eye, ImageOff, Pencil, Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { DataState } from '@/components/shared/data-state';
import { DateRangeFilter, type DateRange } from '@/components/shared/date-range-filter';
import { useAuth, useRole } from '@/components/layout/role-context';
import { Badge } from '@/components/ui/badge';
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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useSupabaseRealtime } from '@/hooks/use-supabase-realtime';
import { usePagination } from '@/hooks/use-pagination';
import { TablePagination } from '@/components/shared/table-pagination';
import { formatNumber } from '@/lib/format';
import {
  createStockTake,
  deleteStockTake,
  fetchStockItemNames,
  fetchStockItems,
  fetchStockTakePhoto,
  fetchStockTakePhotoPreview,
  fetchStockTakes,
  todayJakarta,
  updateStockTake,
} from '@/lib/operations-data';
import type { StockMutationItem, StockTake, StockTakeKind } from '@/types/operations';
import { useSupabaseQuery } from '@/hooks/use-supabase-query';

const DT_FORMAT = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

const KIND_LABEL: Record<StockTakeKind, string> = {
  transfer: 'Gudang → Outlet',
  pemakaian: 'Pemakaian Outlet',
  rusak: 'Rusak/Tumpah Outlet',
};
const KIND_STYLE: Record<StockTakeKind, string> = {
  transfer: 'bg-sky-50 text-sky-700',
  pemakaian: 'bg-ink/5 text-ink',
  rusak: 'bg-amber-50 text-amber-700',
};

function StockTakePhotoThumbnail({
  stockTakeId,
  itemName,
  thumbnail,
  onOpen,
}: {
  stockTakeId: string;
  itemName: string;
  thumbnail?: string;
  onOpen: () => void;
}) {
  const [src, setSrc] = useState(thumbnail);
  useEffect(() => {
    if (src) return;
    let active = true;
    fetchStockTakePhotoPreview(stockTakeId)
      .then((preview) => { if (active) setSrc(preview); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [src, stockTakeId]);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-md ring-1 ring-line"
      aria-label={`Lihat foto ${itemName}`}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={`Thumbnail ${itemName}`} className="h-full w-full object-cover" />
      ) : (
        <ImageOff className="h-4 w-4 text-ink-muted" />
      )}
    </button>
  );
}

export default function StockTakesPage() {
  const { toast } = useToast();
  const { role } = useRole();
  const { user, profile } = useAuth();
  const userId = user?.id;
  const isAdmin = role === 'admin';
  const today = todayJakarta();

  // ── date range filter ──────────────────────────────────────────────────────
  const [dateRange, setDateRange] = useState<DateRange>({ from: today, to: today });

  // ── data loading ───────────────────────────────────────────────────────────
  const loadItems = useCallback(
    () => (isAdmin ? fetchStockItems() : fetchStockItemNames()),
    [isAdmin],
  );
  const loadTakes = useCallback(
    () => fetchStockTakes(dateRange.from, dateRange.to, userId, role),
    [dateRange.from, dateRange.to, userId, role],
  );
  const {
    data: stockData,
    loading: itemsLoading,
    error: itemsError,
    refresh: refreshItems,
  } = useSupabaseQuery(loadItems, Boolean(userId));
  const {
    data: takeData,
    loading: takesLoading,
    error: takesError,
    refresh: refreshTakes,
  } = useSupabaseQuery(loadTakes, Boolean(userId));
  useSupabaseRealtime(['stock_items'], refreshItems, isAdmin);
  useSupabaseRealtime(['stock_takes'], refreshTakes, Boolean(userId));
  const items = stockData ?? [];
  const records = takeData ?? [];

  // ── pagination ─────────────────────────────────────────────────────────────
  const sorted = [...records].sort((a, b) => b.datetime.localeCompare(a.datetime));
  const { page, totalPages, paged, total, pageSize, setPage } = usePagination(sorted, 10);
  useEffect(() => setPage(1), [dateRange.from, dateRange.to, setPage]);

  // ── photo viewer state ─────────────────────────────────────────────────────
  const [selectedTakeId, setSelectedTakeId] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedTakeId) return;
    let active = true;
    setPhotoLoading(true);
    setPhotoError(null);
    fetchStockTakePhoto(selectedTakeId)
      .then((result) => { if (active) setSelectedPhoto(result ?? null); })
      .catch((cause: unknown) => { if (active) setPhotoError(cause instanceof Error ? cause.message : 'Foto gagal dimuat.'); })
      .finally(() => { if (active) setPhotoLoading(false); });
    return () => { active = false; };
  }, [selectedTakeId]);

  // ── detail view state ──────────────────────────────────────────────────────
  const [detailRecord, setDetailRecord] = useState<StockTake | null>(null);

  // ── create form state ──────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [itemId, setItemId] = useState('');
  const [qty, setQty] = useState('1');
  const [kind, setKind] = useState<StockTakeKind>('rusak');
  const [reason, setReason] = useState('');
  const [staffName, setStaffName] = useState('');
  const [photo, setPhoto] = useState<string | undefined>(undefined);
  const [photoThumbnail, setPhotoThumbnail] = useState<string | undefined>(undefined);
  const [photoProcessing, setPhotoProcessing] = useState(false);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  // ── edit state ─────────────────────────────────────────────────────────────
  const [editRecord, setEditRecord] = useState<StockTake | null>(null);
  const [editQty, setEditQty] = useState('');
  const [editReason, setEditReason] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  // ── delete confirm ─────────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<StockTake | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handlePhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) { setPhoto(undefined); setPhotoThumbnail(undefined); setPhotoProcessing(false); return; }
    if (file.size > 1024 * 1024) { setError('Ukuran foto maksimal 1 MB.'); event.target.value = ''; return; }
    setPhoto(undefined); setPhotoThumbnail(undefined); setPhotoProcessing(true); setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') { setPhotoProcessing(false); setError('Foto gagal dibaca.'); return; }
      const original = reader.result;
      const image = new window.Image();
      image.onload = () => {
        const maxEdge = 240;
        const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext('2d');
        if (!context) { setPhotoProcessing(false); setError('Thumbnail gagal dibuat.'); return; }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        setPhoto(original);
        setPhotoThumbnail(canvas.toDataURL('image/jpeg', 0.65));
        setPhotoProcessing(false);
      };
      image.onerror = () => { setPhotoProcessing(false); setError('Foto tidak dapat diproses.'); };
      image.src = original;
    };
    reader.onerror = () => { setPhotoProcessing(false); setError('Foto gagal dibaca.'); };
    reader.readAsDataURL(file);
  };

  const resetForm = () => {
    setItemId(''); setQty('1');
    setKind(isAdmin ? 'transfer' : 'rusak');
    setReason(''); setStaffName('');
    setPhoto(undefined); setPhotoThumbnail(undefined);
    setPhotoProcessing(false); setNotes(''); setError(null);
  };

  const handleSubmit = async () => {
    const item = items.find((i) => i.id === itemId);
    const qtyNum = Number(qty);
    if (!item) { setError('Pilih item yang diambil.'); return; }
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) { setError('Jumlah harus lebih dari 0.'); return; }
    if (isAdmin && qtyNum > sourceStock) { setError(`Jumlah melebihi stok tersedia (${formatNumber(sourceStock)} ${item.unit}).`); return; }
    if (photoProcessing) { setError('Tunggu foto selesai diproses.'); return; }
    if (!(profile?.name ?? staffName).trim()) { setError('Nama wajib diisi.'); return; }
    if (kind === 'rusak' && !reason.trim()) { setError('Alasan kerusakan wajib diisi.'); return; }
    if ((kind === 'transfer' || kind === 'rusak') && !photo) { setError('Foto bukti wajib untuk transfer atau kerusakan.'); return; }
    if (!user?.id) { setError('Sesi pengguna tidak ditemukan.'); return; }

    setSaving(true);
    try {
      await createStockTake({
        itemId: item.id, itemName: item.name, qty: qtyNum,
        kind, reason: kind === 'rusak' ? reason.trim() : undefined,
        staffName: profile?.name ?? staffName.trim(),
        photo, photoThumbnail, notes: notes.trim() || undefined,
      }, user.id);
      await Promise.all([refreshItems(), refreshTakes()]);
      toast({ title: kind === 'transfer' ? 'Transfer stok tercatat' : 'Kerugian outlet tercatat', description: `${formatNumber(qtyNum)} ${item.unit} ${item.name}` });
      resetForm(); setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal mencatat mutasi stok.');
    } finally { setSaving(false); }
  };

  const handleEdit = async () => {
    if (!editRecord || !user?.id) return;
    const qtyNum = Number(editQty);
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) { setEditError('Jumlah harus lebih dari 0.'); return; }
    setEditSaving(true);
    try {
      await updateStockTake(
        editRecord.id,
        { qty: qtyNum, reason: editReason.trim() || undefined, notes: editNotes.trim() || undefined },
        user.id,
        profile?.name ?? user.fullName ?? 'Pengguna',
      );
      await refreshTakes();
      toast({ title: 'Mutasi stok diperbarui', description: editRecord.itemName });
      setEditRecord(null);
    } catch (cause) {
      setEditError(cause instanceof Error ? cause.message : 'Gagal memperbarui mutasi.');
    } finally { setEditSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !user?.id) return;
    setDeleting(true);
    try {
      await deleteStockTake(deleteTarget.id, user.id, profile?.name ?? user.fullName ?? 'Pengguna');
      await Promise.all([refreshItems(), refreshTakes()]);
      toast({ title: 'Mutasi stok dihapus', description: deleteTarget.itemName });
      setDeleteTarget(null);
    } catch (cause) {
      toast({ title: 'Gagal menghapus', description: cause instanceof Error ? cause.message : 'Terjadi kesalahan.', variant: 'destructive' });
    } finally { setDeleting(false); }
  };

  const selectedItem = items.find((i: StockMutationItem) => i.id === itemId);
  const sourceStock = isAdmin && selectedItem
    ? (kind === 'transfer' ? selectedItem.stock ?? 0 : selectedItem.outletStock ?? 0)
    : 0;
  const canCreate = role === 'staff' || isAdmin;

  if (!role || (role !== 'staff' && role !== 'admin')) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <h1 className="text-lg font-semibold text-ink">Akses dibatasi</h1>
        <p className="mt-2 max-w-md text-sm text-ink-muted">Halaman Mutasi Stok hanya dapat diakses oleh akun staff dan admin.</p>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Mutasi Stok"
        description={isAdmin
          ? 'Transfer stok Gudang ke Outlet dan tinjau barang rusak/tumpah.'
          : 'Laporkan barang rusak atau tumpah di outlet dengan alasan dan foto bukti.'}
        actions={
          <div className="flex flex-wrap items-end gap-3">
            <DateRangeFilter value={dateRange} onChange={(v) => { setDateRange(v); setPage(1); }} />
            {canCreate && (
              <Button onClick={() => { resetForm(); setOpen(true); }}>
                <Plus className="h-4 w-4" />
                Catat Mutasi Stok
              </Button>
            )}
          </div>
        }
      />

      <DataState
        loading={itemsLoading || takesLoading}
        error={itemsError ?? takesError}
        onRetry={() => { refreshItems(); refreshTakes(); }}
      />
      {!itemsLoading && !takesLoading && !itemsError && !takesError && (
        <>
          <div className="overflow-hidden rounded-xl border border-line bg-white shadow-sm">
            {sorted.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <p className="text-sm font-medium text-ink">Belum ada mutasi stok</p>
                <p className="mt-1 text-sm text-ink-muted">Catat pengambilan atau kerugian stok untuk pelacakan audit.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-12">No.</TableHead>
                      <TableHead>Waktu</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>Jenis</TableHead>
                      <TableHead className="text-right">Jumlah</TableHead>
                      <TableHead>Staff</TableHead>
                      <TableHead>Foto</TableHead>
                      <TableHead>Keterangan</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paged.map((record, index) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium text-ink-muted">{(page - 1) * pageSize + index + 1}</TableCell>
                        <TableCell className="whitespace-nowrap tabular-nums text-ink-muted">
                          {DT_FORMAT.format(new Date(record.datetime))}
                        </TableCell>
                        <TableCell className="font-medium text-ink">{record.itemName}</TableCell>
                        <TableCell>
                          <Badge className={KIND_STYLE[record.kind]}>{KIND_LABEL[record.kind]}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums text-ink">
                          {formatNumber(record.qty)} porsi
                        </TableCell>
                        <TableCell className="text-ink-muted">{record.staffName}</TableCell>
                        <TableCell>
                          {record.hasPhoto ? (
                            <StockTakePhotoThumbnail
                              stockTakeId={record.id}
                              itemName={record.itemName}
                              thumbnail={record.photoThumbnail}
                              onOpen={() => setSelectedTakeId(record.id)}
                            />
                          ) : (
                            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-background text-ink-muted">
                              <ImageOff className="h-4 w-4" />
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-ink-muted">
                          {record.kind === 'rusak' ? record.reason ?? '—' : record.notes ?? '—'}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => setDetailRecord(record)} aria-label="Detail">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => {
                              setEditRecord(record);
                              setEditQty(String(record.qty));
                              setEditReason(record.reason ?? '');
                              setEditNotes(record.notes ?? '');
                              setEditError(null);
                            }} aria-label="Edit">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => setDeleteTarget(record)} aria-label="Hapus">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <TablePagination page={page} pageCount={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} />
          </div>

          {/* ─── Photo Viewer Dialog ─────────────────────────────────────────── */}
          <Dialog open={Boolean(selectedTakeId)} onOpenChange={(v) => { if (!v) { setSelectedTakeId(null); setSelectedPhoto(null); setPhotoError(null); } }}>
            <DialogContent className="max-w-3xl overflow-hidden p-0">
              {photoLoading ? (
                <p className="p-8 text-center text-sm text-ink-muted">Memuat foto…</p>
              ) : photoError ? (
                <p className="p-8 text-center text-sm text-brand-dark">{photoError}</p>
              ) : selectedPhoto ? (
                <div className="relative">
                  <button type="button" className="absolute right-3 top-3 z-10 rounded-full bg-black/60 px-2 py-1 text-xs text-white"
                    onClick={() => { setSelectedTakeId(null); setSelectedPhoto(null); }}>Tutup</button>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={selectedPhoto} alt="Foto bukti" className="h-auto max-h-[80vh] w-full bg-black object-contain" />
                </div>
              ) : (
                <p className="p-8 text-center text-sm text-ink-muted">Foto bukti tidak tersedia.</p>
              )}
            </DialogContent>
          </Dialog>

          {/* ─── Detail Dialog ───────────────────────────────────────────────── */}
          <Dialog open={Boolean(detailRecord)} onOpenChange={(v) => { if (!v) setDetailRecord(null); }}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Detail Mutasi Stok</DialogTitle>
              </DialogHeader>
              {detailRecord && (
                <div className="space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    <span className="text-ink-muted">Item</span><span className="font-medium text-ink">{detailRecord.itemName}</span>
                    <span className="text-ink-muted">Jenis</span><span>{KIND_LABEL[detailRecord.kind]}</span>
                    <span className="text-ink-muted">Jumlah</span><span className="tabular-nums">{formatNumber(detailRecord.qty)} porsi</span>
                    <span className="text-ink-muted">Staff</span><span>{detailRecord.staffName}</span>
                    <span className="text-ink-muted">Waktu</span><span>{DT_FORMAT.format(new Date(detailRecord.datetime))}</span>
                    {detailRecord.reason && <><span className="text-ink-muted">Alasan</span><span>{detailRecord.reason}</span></>}
                    {detailRecord.notes && <><span className="text-ink-muted">Catatan</span><span>{detailRecord.notes}</span></>}
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setDetailRecord(null)}>Tutup</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* ─── Edit Dialog ─────────────────────────────────────────────────── */}
          <Dialog open={Boolean(editRecord)} onOpenChange={(v) => { if (!v) setEditRecord(null); }}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Edit Mutasi Stok</DialogTitle>
                <DialogDescription>Perbarui jumlah atau keterangan mutasi.</DialogDescription>
              </DialogHeader>
              {editRecord && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-ink-muted">Item</Label>
                    <p className="text-sm font-medium text-ink">{editRecord.itemName} — <Badge className={KIND_STYLE[editRecord.kind]}>{KIND_LABEL[editRecord.kind]}</Badge></p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-ink-muted">Jumlah</Label>
                    <Input type="number" min={0.01} step="any" value={editQty} onChange={(e) => setEditQty(e.target.value)} />
                  </div>
                  {editRecord.kind === 'rusak' && (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-ink-muted">Alasan</Label>
                      <Input value={editReason} onChange={(e) => setEditReason(e.target.value)} placeholder="Alasan kerusakan" />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-ink-muted">Catatan</Label>
                    <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={2} />
                  </div>
                  {editError && <p className="text-sm text-brand-dark">{editError}</p>}
                </div>
              )}
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setEditRecord(null)}>Batal</Button>
                <Button onClick={handleEdit} disabled={editSaving}>{editSaving ? 'Menyimpan...' : 'Simpan'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* ─── Delete Confirm Dialog ───────────────────────────────────────── */}
          <Dialog open={Boolean(deleteTarget)} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Hapus Mutasi Stok</DialogTitle>
                <DialogDescription>
                  Yakin ingin menghapus mutasi <strong>{deleteTarget?.itemName}</strong> sebanyak {deleteTarget?.qty} porsi?
                  Tindakan ini tidak dapat dibatalkan.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setDeleteTarget(null)}>Batal</Button>
                <Button variant="destructive" onClick={handleDelete} disabled={deleting}>{deleting ? 'Menghapus...' : 'Hapus'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* ─── Create Dialog ───────────────────────────────────────────────── */}
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{isAdmin ? 'Catat Mutasi Stok' : 'Laporkan Kerusakan Outlet'}</DialogTitle>
                <DialogDescription>{isAdmin
                  ? 'Transfer memindahkan saldo Gudang ke Outlet.'
                  : 'Barang rusak/tumpah mengurangi saldo Outlet dan perlu bukti untuk audit.'}</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-ink-muted">Jenis pengambilan</Label>
                  <Select value={kind} onValueChange={(v) => {
                    const nextKind = v as StockTakeKind;
                    setKind(nextKind); setError(null);
                    const nextItem = items.find((i: StockMutationItem) => i.id === itemId);
                    if (isAdmin && nextItem) {
                      const avail = nextKind === 'transfer' ? nextItem.stock ?? 0 : nextItem.outletStock ?? 0;
                      if (Number(qty) > avail) setQty(avail > 0 ? String(avail) : '');
                    }
                  }}>
                    <SelectTrigger aria-label="Pilih jenis"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="transfer">Transfer Gudang → Outlet</SelectItem>
                      <SelectItem value="rusak">Rusak / Tumpah / Hilang di Outlet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-ink-muted">Item stok</Label>
                  <Select value={itemId} onValueChange={(v) => {
                    const nextItem = items.find((i: StockMutationItem) => i.id === v);
                    setItemId(v); setError(null);
                    if (isAdmin && nextItem) {
                      const avail = kind === 'transfer' ? nextItem.stock ?? 0 : nextItem.outletStock ?? 0;
                      if (Number(qty) > avail) setQty(avail > 0 ? String(avail) : '');
                    }
                  }}>
                    <SelectTrigger aria-label="Pilih item"><SelectValue placeholder="Pilih item" /></SelectTrigger>
                    <SelectContent>
                      {items.map((item: StockMutationItem) => (
                        <SelectItem key={item.id} value={item.id}>
                          {isAdmin
                            ? `${item.name} · Gudang ${formatNumber(item.stock ?? 0)} / Outlet ${formatNumber(item.outletStock ?? 0)} ${item.unit}`
                            : item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {isAdmin && selectedItem && (
                    <p className="text-xs text-ink-muted">
                      Saldo yang berubah: {formatNumber(sourceStock)} {selectedItem.unit} di {kind === 'transfer' ? 'gudang' : 'outlet'}.
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-ink-muted">Jumlah ({selectedItem?.unit ?? 'unit'})</Label>
                    <Input type="number" min="0.01" max={isAdmin && selectedItem ? sourceStock : undefined} step="any"
                      value={qty} disabled={!selectedItem || (isAdmin && sourceStock <= 0)}
                      onChange={(e) => {
                        const v = e.target.value; const n = Number(v);
                        if (isAdmin && v !== '' && n > sourceStock) {
                          setQty(String(sourceStock));
                          setError(`Jumlah dibatasi: ${formatNumber(sourceStock)} ${selectedItem?.unit ?? 'unit'}.`);
                          return;
                        }
                        setQty(v); setError(null);
                      }} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-ink-muted">Nama staff</Label>
                    <Input value={profile?.name ?? staffName} onChange={(e) => setStaffName(e.target.value)} placeholder="Nama pencatat" disabled={Boolean(profile?.name)} />
                  </div>
                </div>

                {kind === 'rusak' && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-ink-muted">Alasan kerusakan *</Label>
                    <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Contoh: Tumpah saat disiapkan" />
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-ink-muted">Foto bukti</Label>
                  <div className="flex items-center gap-3">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-line bg-white px-3 py-2 text-sm text-ink-muted transition-colors hover:bg-background">
                      <Camera className="h-4 w-4" />Pilih foto
                      <input type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
                    </label>
                    {photo && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photo} alt="Pratinjau bukti" className="h-12 w-12 rounded-md object-cover ring-1 ring-line" />
                    )}
                  </div>
                  <p className="text-[11px] text-ink-muted">{photoProcessing ? 'Memproses foto…' : 'Foto bukti disimpan bersama mutasi stok.'}</p>
                </div>

                {kind === 'transfer' && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-ink-muted">Catatan transfer (opsional)</Label>
                    <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Contoh: Restock outlet untuk shift siang" />
                  </div>
                )}

                {error && <p className="text-sm text-brand-dark">{error}</p>}
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
                <Button onClick={handleSubmit} disabled={saving || photoProcessing}>{saving ? 'Menyimpan...' : photoProcessing ? 'Memproses foto…' : 'Simpan'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </>
  );
}
