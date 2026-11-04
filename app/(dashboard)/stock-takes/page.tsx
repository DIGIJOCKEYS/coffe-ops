'use client';

import { useState, type ChangeEvent } from 'react';
import { Camera, ImageOff, Plus } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { DataState } from '@/components/shared/data-state';
import { useAuth } from '@/components/layout/role-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { usePagination } from '@/hooks/use-pagination';
import { TablePagination } from '@/components/shared/table-pagination';
import { formatNumber } from '@/lib/format';
import { createStockTake, fetchStockItems, fetchStockTakes } from '@/lib/operations-data';
import type { StockItem, StockTakeKind } from '@/types/operations';
import { getStockStatus } from '@/lib/stock';
import { useSupabaseQuery } from '@/hooks/use-supabase-query';

const DT_FORMAT = new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

const KIND_LABEL: Record<StockTakeKind, string> = { pemakaian: 'Pemakaian', rusak: 'Rusak/Tumpah' };
const KIND_STYLE: Record<StockTakeKind, string> = { pemakaian: 'bg-ink/5 text-ink', rusak: 'bg-amber-50 text-amber-700' };

export default function StockTakesPage() {
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const { data: stockData, loading: itemsLoading, error: itemsError, refresh: refreshItems } = useSupabaseQuery(fetchStockItems);
  const { data: takeData, loading: takesLoading, error: takesError, refresh: refreshTakes } = useSupabaseQuery(fetchStockTakes);
  const items = stockData ?? [];
  const records = takeData ?? [];
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  const [itemId, setItemId] = useState('');
  const [qty, setQty] = useState('1');
  const [kind, setKind] = useState<StockTakeKind>('pemakaian');
  const [reason, setReason] = useState('');
  const [staffName, setStaffName] = useState('');
  const [photo, setPhoto] = useState<string | undefined>(undefined);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handlePhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024) {
      setError('Ukuran foto maksimal 1 MB.');
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setPhoto(reader.result);
    };
    reader.onerror = () => setError('Foto gagal dibaca. Coba pilih file lain.');
    reader.readAsDataURL(file);
  };

  const resetForm = () => {
    setItemId('');
    setQty('1');
    setKind('pemakaian');
    setReason('');
    setStaffName('');
    setPhoto(undefined);
    setNotes('');
    setError(null);
  };

  const handleSubmit = async () => {
    const item = items.find((i) => i.id === itemId);
    const qtyNum = Number(qty);

    if (!item) {
      setError('Pilih item yang diambil.');
      return;
    }
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
      setError('Jumlah harus lebih dari 0.');
      return;
    }
    if (!(profile?.name ?? staffName).trim()) {
      setError('Nama wajib diisi untuk pelacakan audit.');
      return;
    }
    if (kind === 'rusak' && !reason.trim()) {
      setError('Alasan kerusakan wajib diisi.');
      return;
    }

    if (!user?.id) {
      setError('Sesi pengguna tidak ditemukan. Silakan login kembali.');
      return;
    }

    setSaving(true);
    try {
      await createStockTake({
      itemId: item.id,
      itemName: item.name,
      qty: qtyNum,
      kind,
      reason: kind === 'rusak' ? reason.trim() : undefined,
      staffName: profile?.name ?? staffName.trim(),
      photo,
      notes: notes.trim() || undefined,
      }, user.id);
      await Promise.all([refreshItems(), refreshTakes()]);
      toast({
        title: kind === 'rusak' ? 'Kerugian stok tercatat' : 'Ambil barang tercatat',
        description: `${formatNumber(qtyNum)} ${item.unit} ${item.name} oleh ${profile?.name ?? staffName.trim()}`,
      });
      resetForm();
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal mencatat pengambilan stok.');
    } finally {
      setSaving(false);
    }
  };

  const sorted = [...records].sort((a, b) => b.datetime.localeCompare(a.datetime));
  const { page, totalPages, paged, total, pageSize, setPage } = usePagination(sorted, 10);
  const selectedItem = items.find((i) => i.id === itemId);

  return (
    <>
      <PageHeader
        title="Ambil Barang"
        description="Staff mencatat pengambilan stok (pemakaian) maupun kerugian (rusak/tumpah/hilang) lengkap dengan foto dan nama untuk audit."
        actions={
          <Button onClick={() => { resetForm(); setOpen(true); }}>
            <Plus className="h-4 w-4" />
            Catat Ambil Barang
          </Button>
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
            <p className="text-sm font-medium text-ink">Belum ada catatan ambil barang</p>
            <p className="mt-1 text-sm text-ink-muted">Catat pengambilan atau kerugian stok untuk pelacakan audit.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Waktu</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Jenis</TableHead>
                  <TableHead className="text-right">Jumlah</TableHead>
                  <TableHead>Staff</TableHead>
                  <TableHead>Foto</TableHead>
                  <TableHead>Keterangan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((record) => (
                  <TableRow key={record.id}>
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
                      {record.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={record.photo}
                          alt={`Bukti ${record.itemName}`}
                          className="h-10 w-10 rounded-md object-cover ring-1 ring-line"
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <TablePagination page={page} pageCount={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} />
      </div>

      <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) resetForm(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Catat Ambil Barang</DialogTitle>
            <DialogDescription>Pemakaian untuk produksi atau kerugian (rusak/tumpah). Stok berkurang otomatis.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-ink-muted">Jenis pengambilan</Label>
              <Select value={kind} onValueChange={(value) => setKind(value as StockTakeKind)}>
                <SelectTrigger aria-label="Pilih jenis">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pemakaian">Pemakaian (dipakai produksi)</SelectItem>
                  <SelectItem value="rusak">Rusak / Tumpah / Hilang</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-ink-muted">Item stok</Label>
              <Select value={itemId} onValueChange={setItemId}>
                <SelectTrigger aria-label="Pilih item">
                  <SelectValue placeholder="Pilih item" />
                </SelectTrigger>
                <SelectContent>
                  {items.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name} ({formatNumber(item.stock)} {item.unit})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedItem && (
                <p className="text-xs text-ink-muted">
                  Sisa stok: {formatNumber(selectedItem.stock)} {selectedItem.unit} ·{' '}
                  {getStockStatus(selectedItem) === 'aman' ? 'Stok aman' : 'Perhatian: stok rendah'}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-ink-muted">Jumlah (porsi)</Label>
                <Input type="number" min={1} step="any" value={qty} onChange={(e) => setQty(e.target.value)} />
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
                  <Camera className="h-4 w-4" />
                  Pilih foto
                  <input type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
                </label>
                {photo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo} alt="Pratinjau bukti" className="h-12 w-12 rounded-md object-cover ring-1 ring-line" />
                )}
              </div>
              <p className="text-[11px] text-ink-muted">Foto akan disimpan bersama catatan stok.</p>
            </div>

            {kind === 'pemakaian' && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-ink-muted">Catatan (opsional)</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Contoh: Ambil untuk shift pagi" />
              </div>
            )}

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
