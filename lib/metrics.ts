import type { DailySales, Expense, ShiftSales, StockItem } from '@/types/operations';

// Omzet dari penjualan shift yang diberikan.
export function sumShiftTotal(sales: ShiftSales[]): number {
  return sales.reduce((sum, shift) => sum + shift.total, 0);
}

// Total porsi terjual dari penjualan shift yang diberikan.
export function countPortions(sales: ShiftSales[]): number {
  return sales.reduce((sum, shift) => sum + shift.lines.reduce((lineSum, line) => lineSum + line.qty, 0), 0);
}

// Estimasi HPP = jumlah(qty x unitCost) untuk setiap porsi yang terjual.
export function estimateTodayHpp(sales: ShiftSales[], items: StockItem[]): number {
  const itemCost = new Map(items.map((item) => [item.id, item.unitCost]));
  return sales.reduce(
    (sum, shift) => sum + shift.lines.reduce((lineSum, line) => lineSum + line.qty * (itemCost.get(line.itemId) ?? 0), 0),
    0,
  );
}

// Ringkasan hari ini: omzet, porsi, HPP, biaya operasional, estimasi laba.
// Pembelian Stok (restock) TIDAK dihitung sebagai biaya harian karena itu
// pembelian inventaris, ditampilkan terpisah di Laporan.
export function summarizeToday(sales: ShiftSales[], items: StockItem[], expenses: Expense[]) {
  const omzet = sumShiftTotal(sales);
  const portions = countPortions(sales);
  const estimatedHpp = estimateTodayHpp(sales, items);
  const operatingCost = expenses
    .filter((expense) => expense.category !== 'Pembelian Stok')
    .reduce((sum, expense) => sum + expense.amount, 0);
  const estimatedProfit = omzet - estimatedHpp - operatingCost;
  return { omzet, portions, estimatedHpp, operatingCost, estimatedProfit };
}

// Persentase perubahan omzet hari ini dibanding kemarin.
export function omzetChange(daily: DailySales[]): number {
  if (daily.length < 2) return 0;
  const today = daily[daily.length - 1];
  const yesterday = daily[daily.length - 2];
  if (yesterday.omzet === 0) return 0;
  return ((today.omzet - yesterday.omzet) / yesterday.omzet) * 100;
}

// Agregat qty per item dari penjualan shift (untuk menu terlaris).
export function aggregateSalesByItem(sales: ShiftSales[]): Map<string, { name: string; qty: number; price: number }> {
  const map = new Map<string, { name: string; qty: number; price: number }>();
  for (const shift of sales) {
    for (const line of shift.lines) {
      const existing = map.get(line.itemId);
      if (existing) {
        existing.qty += line.qty;
      } else {
        map.set(line.itemId, { name: line.name, qty: line.qty, price: line.price });
      }
    }
  }
  return map;
}
