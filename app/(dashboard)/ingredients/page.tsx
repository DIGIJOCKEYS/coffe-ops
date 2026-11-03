'use client';

import { useState } from 'react';
import { Eye, Pencil, Plus, Search } from 'lucide-react';
import { IngredientFormDialog } from '@/components/ingredients/ingredient-form-dialog';
import { IngredientDetailSheet } from '@/components/ingredients/ingredient-detail-sheet';
import { PageHeader } from '@/components/layout/page-header';
import { useRole } from '@/components/layout/role-context';
import { StockStatusBadge } from '@/components/shared/stock-status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { formatNumber } from '@/lib/format';
import { ingredients as initialIngredients, type Ingredient, type IngredientInput, type StockStatus } from '@/lib/mock-data';
import { getStockStatus } from '@/lib/stock';
import { cn } from '@/lib/utils';

const STATUS_OPTIONS: { value: 'all' | StockStatus; label: string }[] = [
  { value: 'all', label: 'Semua status' },
  { value: 'aman', label: 'Aman' },
  { value: 'menipis', label: 'Menipis' },
  { value: 'habis', label: 'Habis' },
  { value: 'kritis', label: 'Kritis' },
];

export default function IngredientsPage() {
  const { role } = useRole();
  const { toast } = useToast();
  const [items, setItems] = useState<Ingredient[]>(initialIngredients);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState<'all' | StockStatus>('all');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Ingredient | null>(null);

  const categories = Array.from(new Set(items.map((item) => item.category))).sort();
  const filtered = items.filter((item) => {
    const matchesQuery = item.name.toLowerCase().includes(query.trim().toLowerCase());
    const matchesCategory = category === 'all' || item.category === category;
    const matchesStatus = status === 'all' || getStockStatus(item) === status;
    return matchesQuery && matchesCategory && matchesStatus;
  });
  const detailItem = items.find((item) => item.id === detailId) ?? null;
  const isAdmin = role === 'admin';

  const openCreate = () => {
    setEditTarget(null);
    setFormOpen(true);
  };

  const openEdit = (item: Ingredient) => {
    setDetailId(null);
    setEditTarget(item);
    setFormOpen(true);
  };

  const handleSave = (input: IngredientInput) => {
    if (editTarget) {
      setItems((prev) => prev.map((item) => (item.id === editTarget.id ? { ...item, ...input } : item)));
      toast({ title: 'Bahan baku diperbarui', description: input.name });
    } else {
      const id = `ING-${String(items.length + 1).padStart(3, '0')}`;
      setItems((prev) => [...prev, { id, ...input }]);
      toast({ title: 'Bahan baku ditambahkan', description: input.name });
    }
    setFormOpen(false);
  };

  return (
    <>
      <PageHeader
        title="Persediaan Bahan Baku"
        description="Pantau stok, satuan, dan batas minimum setiap bahan baku."
        actions={
          isAdmin && (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Tambah Bahan Baku
            </Button>
          )
        }
      />

      <div className="overflow-hidden rounded-xl border border-line bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-line p-4 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cari nama bahan baku"
              className="pl-9"
              aria-label="Cari bahan baku"
            />
          </div>
          <div className="flex gap-3">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-44" aria-label="Filter kategori">
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
              <SelectTrigger className="w-44" aria-label="Filter status stok">
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
            <p className="text-sm font-medium text-ink">Bahan baku tidak ditemukan</p>
            <p className="mt-1 text-sm text-ink-muted">Coba ubah kata kunci atau filter yang dipakai.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Nama</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead className="text-right">Stok Saat Ini</TableHead>
                  <TableHead className="text-right">Minimum</TableHead>
                  <TableHead>Satuan Dasar</TableHead>
                  <TableHead>Satuan Beli</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => (
                  <TableRow key={item.id} className="group">
                    <TableCell className="font-medium text-ink">{item.name}</TableCell>
                    <TableCell className="text-ink-muted">{item.category}</TableCell>
                    <TableCell className={cn('text-right font-medium tabular-nums', getStockStatus(item) === 'aman' ? 'text-ink' : 'text-brand-dark')}>
                      {formatNumber(item.stock)} {item.baseUnit}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-ink-muted">
                      {formatNumber(item.minStock)} {item.baseUnit}
                    </TableCell>
                    <TableCell className="text-ink-muted">{item.baseUnit}</TableCell>
                    <TableCell className="text-ink-muted">{item.purchaseUnit}</TableCell>
                    <TableCell>
                      <StockStatusBadge status={getStockStatus(item)} />
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
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <IngredientDetailSheet
        item={detailItem}
        canEdit={isAdmin}
        onOpenChange={(open) => !open && setDetailId(null)}
        onEdit={() => detailItem && openEdit(detailItem)}
      />

      {formOpen && (
        <IngredientFormDialog
          key={editTarget?.id ?? 'new'}
          open={formOpen}
          onOpenChange={setFormOpen}
          initial={editTarget}
          categories={categories}
          onSubmit={handleSave}
        />
      )}
    </>
  );
}
