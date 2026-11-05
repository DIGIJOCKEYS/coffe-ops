'use client';

import { useEffect, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { formatRupiahInput, parseRupiahInput } from '@/lib/format';
import type { StockItemInput } from '@/types/operations';

type FormState = {
  name: string;
  category: string;
  stock: string;
  minStock: string;
  unit: string;
  unitCost: string;
  price: string;
  available: boolean;
};

function initialFormState(): FormState {
  return {
    name: '',
    category: 'Lainnya',
    stock: '',     // Dikosongkan agar tidak ada bug angka 0 di depan
    minStock: '',  // Dikosongkan agar tidak ada bug angka 0 di depan
    unit: 'porsi',
    unitCost: '',
    price: '',
    available: true,
  };
}

export function StockFormDialog({
  open,
  onOpenChange,
  onSubmit,
  saving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: StockItemInput) => Promise<void>;
  saving: boolean;
}) {
  const [form, setForm] = useState<FormState>(initialFormState);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(initialFormState());
      setError(null);
    }
  }, [open]);

  const update = (key: keyof FormState) => (event: ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const updateCurrency = (key: 'unitCost' | 'price') => (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setForm((prev) => ({ ...prev, [key]: formatRupiahInput(value) }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const stock = form.stock.trim() === '' ? 0 : Number(form.stock);
    const minStock = form.minStock.trim() === '' ? 0 : Number(form.minStock);
    const unitCost = parseRupiahInput(form.unitCost);
    const price = parseRupiahInput(form.price);

    if (!form.name.trim()) {
      setError('Nama item wajib diisi.');
      return;
    }
    if ([stock, minStock, unitCost, price].some((value) => !Number.isFinite(value) || value < 0)) {
      setError('Stok, minimum, harga beli, dan harga jual harus berupa angka tidak negatif.');
      return;
    }

    try {
      await onSubmit({
        name: form.name.trim(),
        category: (form.category || 'Lainnya').trim(),
        stock,
        minStock,
        unit: (form.unit || 'porsi').trim(),
        unitCost,
        price,
        available: form.available,
      });
    } catch {
      // Parent displays the error toast/message
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Tambah Stok & Menu</DialogTitle>
          <DialogDescription>
            Satu bungkus = satu porsi menu. Isi stok sekaligus menentukan menu yang dijual.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Nama menu / item">
            <Input value={form.name} onChange={update('name')} placeholder="Contoh: Kopi Susu Gula Aren" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Harga beli per bungkus">
              <Input value={form.unitCost} onChange={updateCurrency('unitCost')} placeholder="Rp150.000" />
            </Field>
            <Field label="Harga jual per porsi">
              <Input value={form.price} onChange={updateCurrency('price')} placeholder="Rp25.000" />
            </Field>
            <Field label="Stok gudang">
              <Input type="number" min={0} step="any" value={form.stock} onChange={update('stock')} placeholder="0" />
            </Field>
            <Field label="Minimum stok outlet">
              <Input type="number" min={0} step="any" value={form.minStock} onChange={update('minStock')} placeholder="0" />
            </Field>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-line bg-ink-50/40 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-ink">Tersedia dijual sebagai menu</p>
              <p className="text-xs text-ink-muted">Matikan jika item ini bukan menu yang dijual.</p>
            </div>
            <Switch
              checked={form.available}
              onCheckedChange={(checked) => setForm((prev) => ({ ...prev, available: checked }))}
              aria-label="Tersedia dijual"
            />
          </div>

          {error && <p className="text-sm text-brand-dark">{error}</p>}

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-ink-muted">{label}</Label>
      {children}
    </div>
  );
}
