'use client';

import { Pencil } from 'lucide-react';
import { StockStatusBadge } from '@/components/shared/stock-status-badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { formatNumber, formatRupiah } from '@/lib/format';
import type { Ingredient } from '@/lib/mock-data';
import { getStockStatus } from '@/lib/stock';

export function IngredientDetailSheet({
  item,
  canEdit,
  onOpenChange,
  onEdit,
}: {
  item: Ingredient | null;
  canEdit: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
}) {
  const percent = item && item.minStock > 0 ? Math.min((item.stock / item.minStock) * 100, 100) : 0;

  return (
    <Sheet open={item !== null} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        {item && (
          <>
            <SheetHeader>
              <div className="flex items-center gap-3">
                <SheetTitle className="text-left text-lg text-ink">{item.name}</SheetTitle>
                <StockStatusBadge status={getStockStatus(item)} />
              </div>
              <SheetDescription className="text-left">
                {item.id} · {item.category}
              </SheetDescription>
            </SheetHeader>

            <div className="mt-6 space-y-6">
              <div className="rounded-xl bg-background p-4">
                <p className="text-xs font-medium text-ink-muted">Stok saat ini</p>
                <p className="mt-1 text-2xl font-bold text-ink">
                  {formatNumber(item.stock)} {item.baseUnit}
                </p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                  <div className="h-full rounded-full bg-brand transition-all duration-500" style={{ width: `${percent}%` }} />
                </div>
                <p className="mt-2 text-xs text-ink-muted">
                  Minimum stok {formatNumber(item.minStock)} {item.baseUnit}
                </p>
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-5 text-sm">
                <div>
                  <dt className="text-xs text-ink-muted">Satuan dasar</dt>
                  <dd className="mt-1 font-medium text-ink">{item.baseUnit}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-muted">Satuan pembelian</dt>
                  <dd className="mt-1 font-medium text-ink">{item.purchaseUnit}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-muted">Harga per satuan beli</dt>
                  <dd className="mt-1 font-medium text-ink">{formatRupiah(item.unitCost)}</dd>
                </div>
              </dl>
            </div>

            {canEdit && (
              <SheetFooter className="mt-auto pt-6">
                <Button className="w-full" onClick={onEdit}>
                  <Pencil className="h-4 w-4" />
                  Edit Bahan Baku
                </Button>
              </SheetFooter>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
