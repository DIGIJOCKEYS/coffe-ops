import type { Ingredient, StockStatus } from '@/lib/mock-data';

export function getStockStatus(item: Pick<Ingredient, 'stock' | 'minStock'>): StockStatus {
  if (item.stock <= 0) return 'habis';
  if (item.stock < item.minStock * 0.5) return 'kritis';
  if (item.stock < item.minStock) return 'menipis';
  return 'aman';
}
