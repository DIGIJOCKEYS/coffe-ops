'use client';

import { useCallback, useEffect, useState } from 'react';
import { Eye, Image as ImageIcon, Pencil, Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { DataState } from '@/components/shared/data-state';
import { PhotoInput } from '@/components/shared/photo-input';
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
import { useToast } from '@/hooks/use-toast';
import { useSupabaseRealtime } from '@/hooks/use-supabase-realtime';
import { TablePagination } from '@/components/shared/table-pagination';
import { formatRupiah, formatRupiahInput, parseRupiahInput } from '@/lib/format';
import {
  createExpense,
  deleteExpense,
  fetchExpensePhoto,
  fetchExpensePhotoPreview,
  fetchExpensesPage,
  todayJakarta,
  updateExpense,
} from '@/lib/operations-data';
import type { Expense, ExpenseCategory } from '@/types/operations';
import { useSupabaseQuery } from '@/hooks/use-supabase-query';

const CATEGORIES: ExpenseCategory[] = ['Pembelian Stok', 'Operasional', 'Lainnya'];

const CATEGORY_STYLE: Record<ExpenseCategory, string> = {
  'Pembelian Stok': 'bg-brand/10 text-brand-dark',
  Operasional: 'bg-sky-50 text-sky-700',
  'Kerugian Stok': 'bg-red-50 text-red-700',
  Lainnya: 'bg-ink/5 text-ink',
};

const DATE_FORMAT = new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
const PAGE_SIZE = 10;

function ExpensePhotoThumbnail({
  expenseId,
  description,
  thumbnail,
  onOpen,
}: {
  expenseId: string;
  description: string;
  thumbnail?: string;
  onOpen: () => void;
}) {
  const [src, setSrc] = useState(thumbnail);
  useEffect(() => {
    if (src) return;
    let active = true;
    fetchExpensePhotoPreview(expenseId)
      .then((preview) => { if (active) setSrc(preview); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [expenseId, src]);

  return (
    <button type="button" onClick={onOpen}
      className="inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded ring-1 ring-line"
      aria-label={`Lihat foto bukti ${description}`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={`Thumbnail ${description}`} className="h-full w-full object-cover" />
      ) : (
        <ImageIcon className="h-4 w-4 text-ink-muted" />
      )}
    </button>
  );
}

export default function ExpensesPage() {
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const { role } = useRole();
  const userId = user?.id;
  const today = todayJakarta();
  const isAdmin = role === 'admin';
  const [dateRange, setDateRange] = useState<DateRange>({ from: today, to: today });
  const [page, setPage] = useState(1);

  // ── data loading ───────────────────────────────────────────────────────────
  const loadExpenses = useCallback(
    () => fetchExpensesPage(userId, role, page, PAGE_SIZE, dateRange.from, dateRange.to),
    [dateRange.from, dateRange.to, userId, role, page],
  );
  const { data: expenseData, loading, error: loadError, refresh } = useSupabaseQuery(loadExpenses, Boolean(userId));
  useSupabaseRealtime(['expenses'], refresh, Boolean(userId));
  const records = expenseData?.records ?? [];
  const totalRows = expenseData?.totalCount ?? 0;
  const totalAmount = expenseData?.totalAmount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));

  useEffect(() => setPage(1), [dateRange.from, dateRange.to]);

  // ── photo viewer state ─────────────────────────────────────────────────────
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedExpenseId) return;
    let active = true;
    setPhotoLoading(true); setPhotoError(null);
    fetchExpensePhoto(selectedExpenseId)
      .then((result) => { if (active) setSelectedPhoto(result ?? null); })
      .catch((cause: unknown) => { if (active) setPhotoError(cause instanceof Error ? cause.message : 'Foto gagal dimuat.'); })
      .finally(() => { if (active) setPhotoLoading(false); });
    return () => { active = false; };
  }, [selectedExpenseId]);

  // ── create form state ──────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayJakarta());
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('Operasional');
  const [amount, setAmount] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoThumbnail, setPhotoThumbnail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── detail state ───────────────────────────────────────────────────────────
  const [detailRecord, setDetailRecord] = useState<Expense | null>(null);

  // ── edit state ─────────────────────────────────────────────────────────────
  const [editRecord, setEditRecord] = useState<Expense | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editCategory, setEditCategory] = useState<ExpenseCategory>('Operasional');
  const [editAmount, setEditAmount] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  // ── delete confirm state ───────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState(false);

  const resetForm = () => {
    setDate(todayJakarta()); setDescription(''); setCategory('Operasional');
    setAmount(''); setPhoto(null); setPhotoThumbnail(null); setError(null);
  };

  const handlePhotoChange = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => setPhoto(typeof reader.result === 'string' ? reader.result : null);
    reader.onerror = () => setError('Foto gagal dibaca.');
    reader.readAsDataURL(file);

    const objectUrl = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      const maxEdge = 240;
      const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const ctx = canvas.getContext('2d');
      if (ctx) { ctx.drawImage(img, 0, 0, canvas.width, canvas.height); setPhotoThumbnail(canvas.toDataURL('image/jpeg', 0.65)); }
      URL.revokeObjectURL(objectUrl);
    };
    img.onerror = () => { setPhotoThumbnail(null); URL.revokeObjectURL(objectUrl); };
    img.src = objectUrl;
  };

  const handleSubmit = async () => {
    const amountNum = parseRupiahInput(amount);
    if (!description.trim()) { setError('Deskripsi wajib diisi.'); return; }
    if (!Number.isFinite(amountNum) || amountNum <= 0) { setError('Jumlah harus lebih dari 0.'); return; }
    if (!user?.id) { setError('Sesi pengguna tidak ditemukan.'); return; }
    setSaving(true);
    try {
      await createExpense(
        { date, description: description.trim(), category: isAdmin ? category : 'Operasional', amount: amountNum, photo: photo ?? undefined, photoThumbnail: photoThumbnail ?? undefined },
        user.id,
        profile?.name ?? user.fullName ?? 'Pengguna',
      );
      if (page === 1 && dateRange.from === today && dateRange.to === today) await refresh();
      else { setPage(1); setDateRange({ from: today, to: today }); }
      toast({ title: 'Pengeluaran tercatat', description: `${formatRupiah(amountNum)} — ${description.trim()}` });
      resetForm(); setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal menyimpan pengeluaran.');
    } finally { setSaving(false); }
  };

  const openEdit = (record: Expense) => {
    setEditRecord(record);
    setEditDate(record.date);
    setEditDesc(record.description);
    setEditCategory(record.category);
    setEditAmount(String(record.amount));
    setEditError(null);
  };

  const handleEdit = async () => {
    if (!editRecord || !user?.id) return;
    const amountNum = parseRupiahInput(editAmount);
    if (!editDesc.trim()) { setEditError('Deskripsi wajib diisi.'); return; }
    if (!Number.isFinite(amountNum) || amountNum <= 0) { setEditError('Jumlah harus lebih dari 0.'); return; }
    setEditSaving(true);
    try {
      await updateExpense(
        editRecord.id,
        { date: editDate, description: editDesc.trim(), category: isAdmin ? editCategory : 'Operasional', amount: amountNum },
        user.id,
        profile?.name ?? user.fullName ?? 'Pengguna',
      );
      await refresh();
      toast({ title: 'Pengeluaran diperbarui', description: editDesc.trim() });
      setEditRecord(null);
    } catch (cause) {
      setEditError(cause instanceof Error ? cause.message : 'Gagal memperbarui pengeluaran.');
    } finally { setEditSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !user?.id) return;
    setDeleting(true);
    try {
      await deleteExpense(deleteTarget.id, user.id, profile?.name ?? user.fullName ?? 'Pengguna');
      await refresh();
      toast({ title: 'Pengeluaran dihapus', description: deleteTarget.description });
      setDeleteTarget(null);
    } catch (cause) {
      toast({ title: 'Gagal menghapus', description: cause instanceof Error ? cause.message : 'Terjadi kesalahan.', variant: 'destructive' });
    } finally { setDeleting(false); }
  };

  if (role && !isAdmin && !user?.id) {
    return <div className="rounded-xl border border-line bg-white p-6 text-center text-sm text-ink-muted">Memuat identitas pengguna…</div>;
  }

  return (
    <>
      <PageHeader
        title="Pengeluaran"
        description={isAdmin
          ? 'Catat dan tinjau seluruh pengeluaran operasional maupun pembelian stok.'
          : 'Catat dan lihat pengeluaran operasional milik Anda.'}
        actions={
          <div className="flex flex-wrap items-end gap-3">
            <DateRangeFilter value={dateRange} onChange={(v) => { setDateRange(v); setPage(1); }} />
            <Button onClick={() => { resetForm(); setOpen(true); }}>
              <Plus className="h-4 w-4" />Tambah Pengeluaran
            </Button>
          </div>
        }
      />

      <DataState loading={loading} error={loadError} onRetry={refresh} />
      {!loading && !loadError && (
        <>
          <div className="mb-4 flex items-center justify-between rounded-xl border border-line bg-white px-5 py-4 shadow-sm">
            <p className="text-sm font-medium text-ink-muted">Total pengeluaran tercatat</p>
            <p className="text-xl font-bold text-ink">{formatRupiah(totalAmount)}</p>
          </div>

          <div className="overflow-hidden rounded-xl border border-line bg-white shadow-sm">
            {totalRows === 0 ? (
              <div className="px-6 py-16 text-center">
                <p className="text-sm font-medium text-ink">Belum ada pengeluaran</p>
                <p className="mt-1 text-sm text-ink-muted">Catat pengeluaran untuk melacak arus kas.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-12">No.</TableHead>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Deskripsi</TableHead>
                      <TableHead>Kategori</TableHead>
                      <TableHead>Diinput Oleh</TableHead>
                      <TableHead className="text-right">Jumlah</TableHead>
                      <TableHead>Foto</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((record, index) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium text-ink-muted">{(page - 1) * PAGE_SIZE + index + 1}</TableCell>
                        <TableCell className="whitespace-nowrap text-ink-muted">{DATE_FORMAT.format(new Date(record.date))}</TableCell>
                        <TableCell className="font-medium text-ink">{record.description}</TableCell>
                        <TableCell>
                          <Badge className={CATEGORY_STYLE[record.category]}>{record.category}</Badge>
                        </TableCell>
                        <TableCell className="text-ink-muted">
                          {record.createdByName ?? '—'}
                          {record.createdByRole ? ` · ${record.createdByRole === 'admin' ? 'Admin' : 'Staff'}` : ''}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums text-ink">{formatRupiah(record.amount)}</TableCell>
                        <TableCell>
                          {record.hasPhoto ? (
                            <ExpensePhotoThumbnail
                              expenseId={record.id}
                              description={record.description}
                              thumbnail={record.photoThumbnail}
                              onOpen={() => setSelectedExpenseId(record.id)}
                            />
                          ) : <span className="text-ink-muted">—</span>}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => setDetailRecord(record)} aria-label="Detail">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => openEdit(record)} aria-label="Edit">
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
            <TablePagination page={page} pageCount={totalPages} total={totalRows} pageSize={PAGE_SIZE} onPageChange={setPage} />
          </div>

          {/* ─── Photo Viewer Dialog ───────────────────────────────────────── */}
          <Dialog open={Boolean(selectedExpenseId)} onOpenChange={(v) => { if (!v) { setSelectedExpenseId(null); setSelectedPhoto(null); setPhotoError(null); } }}>
            <DialogContent className="max-w-3xl overflow-hidden p-0">
              {photoLoading ? (
                <p className="p-8 text-center text-sm text-ink-muted">Memuat foto…</p>
              ) : photoError ? (
                <p className="p-8 text-center text-sm text-brand-dark">{photoError}</p>
              ) : selectedPhoto ? (
                <div className="relative">
                  <button type="button" className="absolute right-3 top-3 z-10 rounded-full bg-black/60 px-2 py-1 text-xs text-white"
                    onClick={() => { setSelectedExpenseId(null); setSelectedPhoto(null); }}>Tutup</button>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={selectedPhoto} alt="Foto bukti pengeluaran" className="h-auto max-h-[80vh] w-full bg-black object-contain" />
                </div>
              ) : (
                <p className="p-8 text-center text-sm text-ink-muted">Foto bukti tidak tersedia.</p>
              )}
            </DialogContent>
          </Dialog>

          {/* ─── Detail Dialog ─────────────────────────────────────────────── */}
          <Dialog open={Boolean(detailRecord)} onOpenChange={(v) => { if (!v) setDetailRecord(null); }}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Detail Pengeluaran</DialogTitle>
              </DialogHeader>
              {detailRecord && (
                <div className="space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    <span className="text-ink-muted">Tanggal</span>
                    <span className="font-medium">{DATE_FORMAT.format(new Date(detailRecord.date))}</span>
                    <span className="text-ink-muted">Deskripsi</span>
                    <span className="font-medium text-ink">{detailRecord.description}</span>
                    <span className="text-ink-muted">Kategori</span>
                    <Badge className={CATEGORY_STYLE[detailRecord.category]}>{detailRecord.category}</Badge>
                    <span className="text-ink-muted">Jumlah</span>
                    <span className="font-semibold tabular-nums text-ink">{formatRupiah(detailRecord.amount)}</span>
                    <span className="text-ink-muted">Diinput oleh</span>
                    <span>{detailRecord.createdByName ?? '—'}</span>
                  </div>
                  {detailRecord.hasPhoto && (
                    <Button variant="outline" size="sm" onClick={() => { setDetailRecord(null); setSelectedExpenseId(detailRecord.id); }}>
                      Lihat Foto Bukti
                    </Button>
                  )}
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setDetailRecord(null)}>Tutup</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* ─── Edit Dialog ───────────────────────────────────────────────── */}
          <Dialog open={Boolean(editRecord)} onOpenChange={(v) => { if (!v) setEditRecord(null); }}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Edit Pengeluaran</DialogTitle>
                <DialogDescription>Perbarui detail pengeluaran.</DialogDescription>
              </DialogHeader>
              {editRecord && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-ink-muted">Tanggal</Label>
                    <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-ink-muted">Deskripsi</Label>
                    <Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
                  </div>
                  {isAdmin ? (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-ink-muted">Kategori</Label>
                      <Select value={editCategory} onValueChange={(v) => setEditCategory(v as ExpenseCategory)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-ink-muted">Kategori</Label>
                      <p className="flex h-10 items-center rounded-md border border-line bg-background px-3 text-sm text-ink">Operasional</p>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-ink-muted">Jumlah (Rp)</Label>
                    <Input value={editAmount} onChange={(e) => setEditAmount(formatRupiahInput(e.target.value))} placeholder="Rp60.000" />
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

          {/* ─── Delete Confirm Dialog ─────────────────────────────────────── */}
          <Dialog open={Boolean(deleteTarget)} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Hapus Pengeluaran</DialogTitle>
                <DialogDescription>
                  Yakin ingin menghapus <strong>{deleteTarget?.description}</strong> senilai{' '}
                  {deleteTarget ? formatRupiah(deleteTarget.amount) : ''}? Tindakan ini tidak dapat dibatalkan.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setDeleteTarget(null)}>Batal</Button>
                <Button variant="destructive" onClick={handleDelete} disabled={deleting}>{deleting ? 'Menghapus...' : 'Hapus'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* ─── Create Dialog ─────────────────────────────────────────────── */}
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Tambah Pengeluaran</DialogTitle>
                <DialogDescription>{isAdmin
                  ? 'Catat pengeluaran operasional atau pembelian stok.'
                  : 'Catat pengeluaran operasional yang Anda lakukan.'}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-ink-muted">Tanggal</Label>
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-ink-muted">Deskripsi</Label>
                  <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Contoh: Es batu 20 kg" />
                </div>
                {isAdmin ? (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-ink-muted">Kategori</Label>
                    <Select value={category} onValueChange={(v) => setCategory(v as ExpenseCategory)}>
                      <SelectTrigger aria-label="Pilih kategori"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-ink-muted">Kategori</Label>
                    <p className="flex h-10 items-center rounded-md border border-line bg-background px-3 text-sm text-ink">Operasional</p>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-ink-muted">Jumlah (Rp)</Label>
                  <Input value={amount} onChange={(e) => setAmount(formatRupiahInput(e.target.value))} placeholder="Rp60.000" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-ink-muted">Foto bukti</Label>
                  <PhotoInput
                    onFile={handlePhotoChange}
                    label="foto"
                    maxMB={10}
                    onError={(msg) => setError(msg)}
                  />
                  {photo && (
                    <button type="button" onClick={() => setSelectedPhoto(photo)} className="mt-2 block overflow-hidden rounded-md border border-line">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo} alt="Preview bukti pengeluaran" className="h-24 w-full object-cover" />
                    </button>
                  )}
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
