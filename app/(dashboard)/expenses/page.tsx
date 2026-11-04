'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';
import { usePagination } from '@/hooks/use-pagination';
import { TablePagination } from '@/components/shared/table-pagination';
import { formatRupiah } from '@/lib/format';
import { createExpense, fetchExpenses, todayJakarta } from '@/lib/operations-data';
import type { ExpenseCategory } from '@/types/operations';
import { useSupabaseQuery } from '@/hooks/use-supabase-query';

const CATEGORIES: ExpenseCategory[] = ['Pembelian Stok', 'Operasional', 'Lainnya'];

const CATEGORY_STYLE: Record<ExpenseCategory, string> = {
  'Pembelian Stok': 'bg-brand/10 text-brand-dark',
  Operasional: 'bg-sky-50 text-sky-700',
  Lainnya: 'bg-ink/5 text-ink',
};

const DATE_FORMAT = new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });

export default function ExpensesPage() {
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const { data: expenseData, loading, error: loadError, refresh } = useSupabaseQuery(fetchExpenses);
  const records = expenseData ?? [];
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  const [date, setDate] = useState(todayJakarta());
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('Operasional');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setDate(todayJakarta());
    setDescription('');
    setCategory('Operasional');
    setAmount('');
    setError(null);
  };

  const handleSubmit = async () => {
    const amountNum = Number(amount);
    if (!description.trim()) {
      setError('Deskripsi wajib diisi.');
      return;
    }
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setError('Jumlah harus berupa angka lebih dari 0.');
      return;
    }

    if (!user?.id) {
      setError('Sesi pengguna tidak ditemukan. Silakan login kembali.');
      return;
    }
    setSaving(true);
    try {
      await createExpense(
        { date, description: description.trim(), category, amount: amountNum },
        user.id,
        profile?.name ?? user.fullName ?? 'Pengguna',
      );
      await refresh();
      toast({ title: 'Pengeluaran tercatat', description: `${formatRupiah(amountNum)} — ${description.trim()}` });
      resetForm();
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal menyimpan pengeluaran.');
    } finally {
      setSaving(false);
    }
  };

  const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const total = records.reduce((sum, record) => sum + record.amount, 0);
  const { page, totalPages, paged, total: totalRows, pageSize, setPage } = usePagination(sorted, 10);

  return (
    <>
      <PageHeader
        title="Pengeluaran"
        description="Catat pembelian stok dari suplier, es batu, cup, sedotan, air, dan biaya lainnya."
        actions={
          <Button onClick={() => { resetForm(); setOpen(true); }}>
            <Plus className="h-4 w-4" />
            Tambah Pengeluaran
          </Button>
        }
      />

      <DataState loading={loading} error={loadError} onRetry={refresh} />
      {!loading && !loadError && (
      <>
      <div className="mb-4 flex items-center justify-between rounded-xl border border-line bg-white px-5 py-4 shadow-sm">
        <p className="text-sm font-medium text-ink-muted">Total pengeluaran tercatat</p>
        <p className="text-xl font-bold text-ink">{formatRupiah(total)}</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-white shadow-sm">
        {sorted.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm font-medium text-ink">Belum ada pengeluaran</p>
            <p className="mt-1 text-sm text-ink-muted">Catat pengeluaran untuk melacak arus kas.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Deskripsi</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead className="text-right">Jumlah</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="whitespace-nowrap text-ink-muted">{DATE_FORMAT.format(new Date(record.date))}</TableCell>
                    <TableCell className="font-medium text-ink">{record.description}</TableCell>
                    <TableCell>
                      <Badge className={CATEGORY_STYLE[record.category]}>{record.category}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums text-ink">{formatRupiah(record.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <TablePagination page={page} pageCount={totalPages} total={totalRows} pageSize={pageSize} onPageChange={setPage} />
      </div>

      <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) resetForm(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tambah Pengeluaran</DialogTitle>
            <DialogDescription>Catat uang keluar untuk pembelian stok maupun biaya operasional.</DialogDescription>
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
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-ink-muted">Kategori</Label>
              <Select value={category} onValueChange={(value) => setCategory(value as ExpenseCategory)}>
                <SelectTrigger aria-label="Pilih kategori">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((value) => (
                    <SelectItem key={value} value={value}>{value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-ink-muted">Jumlah (Rp)</Label>
              <Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="60000" />
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
