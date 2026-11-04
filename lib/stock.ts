import type { StockItem, StockStatus } from '@/types/operations';

export function getStockStatus(item: Pick<StockItem, 'stock' | 'minStock'>): StockStatus {
  if (item.stock <= 0) return 'habis';
  if (item.stock < item.minStock * 0.5) return 'kritis';
  if (item.stock < item.minStock) return 'menipis';
  return 'aman';
}
