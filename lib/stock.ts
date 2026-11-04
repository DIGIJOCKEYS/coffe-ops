import type { StockItem, StockStatus } from '@/types/operations';

export function getStockStatus(item: Pick<StockItem, 'outletStock' | 'minStock'>): StockStatus {
  if (item.outletStock <= 0) return 'habis';
  if (item.outletStock < item.minStock * 0.5) return 'kritis';
  if (item.outletStock < item.minStock) return 'menipis';
  return 'aman';
}
