'use client';

import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { StockStatusBadge } from '@/components/shared/stock-status-badge';
import { formatNumber, formatRupiah } from '@/lib/format';
import { getStockStatus } from '@/lib/stock';
import type { StockItem } from '@/types/operations';

export function StockDetailSheet({
  item,
  canEdit,
  onOpenChange,
  onEdit,
}: {
  item: StockItem | null;
  canEdit: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
}) {
  const status = item ? getStockStatus(item) : 'aman';
  const percent = item && item.minStock > 0 ? Math.min((item.stock / item.minStock) * 100, 100) : 0;

  return (
    <Sheet open={item !== null} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {item?.name}
            {item && <StockStatusBadge status={status} />}
          </SheetTitle>
          <SheetDescription>
            {item ? `${item.id} · ${item.category}` : ''}
          </SheetDescription>
        </SheetHeader>

        {item && (
          <div className="space-y-5 px-4">
            <div className="rounded-xl border border-line bg-ink-50/40 p-4">
              <p className="text-xs text-ink-muted">Stok saat ini</p>
              <p className="mt-1 text-2xl font-semibold text-ink">
                {formatNumber(item.stock)} {item.unit}
              </p>
              <Progress value={percent} className="mt-3 h-2 [&>div]:bg-brand" />
              <p className="mt-2 text-xs text-ink-muted">Minimum stok {formatNumber(item.minStock)} {item.unit}</p>
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
              <div>
                <dt className="text-ink-muted">Kategori</dt>
                <dd className="font-medium text-ink">{item.category}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">Satuan</dt>
                <dd className="font-medium text-ink">{item.unit}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">Harga beli / bungkus</dt>
                <dd className="font-medium text-ink">{formatRupiah(item.unitCost)}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">Harga jual / porsi</dt>
                <dd className="font-medium text-ink">{formatRupiah(item.price)}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-ink-muted">Status menu</dt>
                <dd className="font-medium text-ink">{item.available ? 'Tersedia dijual' : 'Tidak dijual'}</dd>
              </div>
            </dl>
          </div>
        )}

        {canEdit && (
          <SheetFooter>
            <Button className="w-full" onClick={onEdit}>
              <Pencil className="h-4 w-4" />
              Edit Stok & Menu
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
