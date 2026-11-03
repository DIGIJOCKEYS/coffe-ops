'use client';

import { useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Ingredient, IngredientInput } from '@/lib/mock-data';

type FormState = {
  name: string;
  category: string;
  stock: string;
  minStock: string;
  baseUnit: string;
  purchaseUnit: string;
  unitCost: string;
};

function toFormState(item: Ingredient | null): FormState {
  if (!item) {
    return { name: '', category: '', stock: '0', minStock: '0', baseUnit: '', purchaseUnit: '', unitCost: '0' };
  }
  return {
    name: item.name,
    category: item.category,
    stock: String(item.stock),
    minStock: String(item.minStock),
    baseUnit: item.baseUnit,
    purchaseUnit: item.purchaseUnit,
    unitCost: String(item.unitCost),
  };
}

export function IngredientFormDialog({
  open,
  onOpenChange,
  initial,
  categories,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: Ingredient | null;
  categories: string[];
  onSubmit: (input: IngredientInput) => void;
}) {
  const [form, setForm] = useState<FormState>(() => toFormState(initial));
  const [error, setError] = useState<string | null>(null);

  const update = (key: keyof FormState) => (event: ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const stock = Number(form.stock);
    const minStock = Number(form.minStock);
    const unitCost = Number(form.unitCost);

    if (!form.name.trim() || !form.category.trim() || !form.baseUnit.trim() || !form.purchaseUnit.trim()) {
      setError('Nama, kategori, dan satuan wajib diisi.');
      return;
    }
    if ([stock, minStock, unitCost].some((value) => Number.isNaN(value) || value < 0)) {
      setError('Stok, minimum, dan harga harus berupa angka tidak negatif.');
      return;
    }

    onSubmit({
      name: form.name.trim(),
      category: form.category.trim(),
      stock,
      minStock,
      baseUnit: form.baseUnit.trim(),
      purchaseUnit: form.purchaseUnit.trim(),
      unitCost,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? 'Edit Bahan Baku' : 'Tambah Bahan Baku'}</DialogTitle>
          <DialogDescription>Isi data bahan baku dengan lengkap agar perhitungan HPP akurat.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Nama bahan baku">
            <Input value={form.name} onChange={update('name')} placeholder="Contoh: Biji Kopi Arabica" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Kategori">
              <Input value={form.category} onChange={update('category')} list="ingredient-categories" placeholder="Kopi" />
              <datalist id="ingredient-categories">
                {categories.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </Field>
            <Field label="Harga per satuan beli (Rp)">
              <Input type="number" min={0} value={form.unitCost} onChange={update('unitCost')} />
            </Field>
            <Field label="Satuan dasar">
              <Input value={form.baseUnit} onChange={update('baseUnit')} placeholder="gram, ml, pcs" />
            </Field>
            <Field label="Satuan pembelian">
              <Input value={form.purchaseUnit} onChange={update('purchaseUnit')} placeholder="karung 1 kg" />
            </Field>
            <Field label="Stok saat ini">
              <Input type="number" min={0} step="any" value={form.stock} onChange={update('stock')} />
            </Field>
            <Field label="Minimum stok">
              <Input type="number" min={0} step="any" value={form.minStock} onChange={update('minStock')} />
            </Field>
          </div>

          {error && <p className="text-sm text-brand-dark">{error}</p>}

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit">Simpan</Button>
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
