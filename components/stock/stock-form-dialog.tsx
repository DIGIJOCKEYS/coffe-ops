'use client';

import { useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { StockItem, StockItemInput } from '@/types/operations';

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

function toFormState(item: StockItem | null): FormState {
  if (!item) {
    return { name: '', category: '', stock: '0', minStock: '0', unit: 'porsi', unitCost: '0', price: '0', available: true };
  }
  return {
    name: item.name,
    category: item.category,
    stock: String(item.stock),
    minStock: String(item.minStock),
    unit: item.unit,
    unitCost: String(item.unitCost),
    price: String(item.price),
    available: item.available,
  };
}

export function StockFormDialog({
  open,
  onOpenChange,
  initial,
  categories,
  onSubmit,
  saving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: StockItem | null;
  categories: string[];
  onSubmit: (input: StockItemInput) => Promise<void>;
  saving: boolean;
}) {
  const [form, setForm] = useState<FormState>(() => toFormState(initial));
  const [error, setError] = useState<string | null>(null);

  const update = (key: keyof FormState) => (event: ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const stock = Number(form.stock);
    const minStock = Number(form.minStock);
    const unitCost = Number(form.unitCost);
    const price = Number(form.price);

    if (!form.name.trim() || !form.category.trim() || !form.unit.trim()) {
      setError('Nama, kategori, dan satuan wajib diisi.');
      return;
    }
    if ([stock, minStock, unitCost, price].some((value) => !Number.isFinite(value) || value < 0)) {
      setError('Stok, minimum, harga beli, dan harga jual harus berupa angka tidak negatif.');
      return;
    }

    try {
      await onSubmit({
        name: form.name.trim(),
        category: form.category.trim(),
        stock,
        minStock,
        unit: form.unit.trim(),
        unitCost,
        price,
        available: form.available,
      });
    } catch {
      // The parent displays the Supabase error and keeps the dialog open.
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? 'Edit Stok & Menu' : 'Tambah Stok & Menu'}</DialogTitle>
          <DialogDescription>
            Satu bungkus = satu porsi menu. Isi stok sekaligus menentukan menu yang dijual.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Nama menu / item">
            <Input value={form.name} onChange={update('name')} placeholder="Contoh: Kopi Susu Gula Aren" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Kategori">
              <Input value={form.category} onChange={update('category')} list="stock-categories" placeholder="Signature" />
              <datalist id="stock-categories">
                {categories.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </Field>
            <Field label="Satuan">
              <Input value={form.unit} onChange={update('unit')} placeholder="porsi, bungkus" />
            </Field>
            <Field label="Harga beli per bungkus (Rp)">
              <Input type="number" min={0} value={form.unitCost} onChange={update('unitCost')} />
            </Field>
            <Field label="Harga jual per porsi (Rp)">
              <Input type="number" min={0} value={form.price} onChange={update('price')} />
            </Field>
            <Field label="Stok saat ini">
              <Input type="number" min={0} step="any" value={form.stock} onChange={update('stock')} />
            </Field>
            <Field label="Minimum stok">
              <Input type="number" min={0} step="any" value={form.minStock} onChange={update('minStock')} />
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
