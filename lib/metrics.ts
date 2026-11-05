import type { DailySales, Expense, ShiftSales, StockItem, StockTake } from '@/types/operations';

// Omzet dari penjualan shift yang diberikan.
export function sumShiftTotal(sales: ShiftSales[]): number {
  return sales.reduce((sum, shift) => sum + shift.total, 0);
}

// Total porsi terjual dari penjualan shift yang diberikan.
export function countPortions(sales: ShiftSales[]): number {
  return sales.reduce(
    (sum, shift) => sum + shift.lines.reduce((lineSum, line) => lineSum + line.qty, 0),
    0,
  );
}

// ─── Estimasi HPP dari Transfer ──────────────────────────────────────────────
// HPP = total nilai modal barang yang ditransfer ke outlet (qty × unit_cost).
// Ini merepresentasikan biaya pokok barang yang "keluar dari gudang".
export function estimateTransferCost(stockTakes: StockTake[]): number {
  return stockTakes
    .filter((t) => t.kind === 'transfer')
    .reduce((sum, t) => sum + t.qty * (t.unitCost ?? 0), 0);
}

// ─── Estimasi kerugian dari rusak/tumpah ─────────────────────────────────────
export function estimateLossCost(stockTakes: StockTake[]): number {
  return stockTakes
    .filter((t) => t.kind === 'rusak')
    .reduce((sum, t) => sum + t.qty * (t.unitCost ?? 0), 0);
}

// ─── Ringkasan harian ─────────────────────────────────────────────────────────
// Estimasi laba = Omzet − HPP − Kerugian (rusak/tumpah) − Pengeluaran Operasional − Pengeluaran Lainnya
export function summarizeToday(
  sales: ShiftSales[],
  items: StockItem[],
  expenses: Expense[],
  stockTakes: StockTake[] = [],
) {
  const omzet    = sumShiftTotal(sales);
  const portions = countPortions(sales);

  // HPP dari transfer modal ke outlet
  const transferCost = estimateTransferCost(stockTakes);

  // Kerugian dari rusak / tumpah
  const lossCostFromTakes = estimateLossCost(stockTakes);
  const lossCostFromExpenses = expenses
    .filter((e) => e.category === 'Kerugian Stok')
    .reduce((sum, e) => sum + e.amount, 0);
  const lossCost = lossCostFromTakes > 0 ? lossCostFromTakes : lossCostFromExpenses;

  // Breakdown masing-masing kategori pengeluaran
  const stockExpense = expenses
    .filter((e) => e.category === 'Pembelian Stok')
    .reduce((sum, e) => sum + e.amount, 0);

  const operationalExpense = expenses
    .filter((e) => e.category === 'Operasional')
    .reduce((sum, e) => sum + e.amount, 0);

  const otherExpense = expenses
    .filter((e) => e.category === 'Lainnya')
    .reduce((sum, e) => sum + e.amount, 0);

  const operatingCost = operationalExpense;
  const totalExpense = stockExpense + operationalExpense + otherExpense + lossCost;

  // HPP modal
  const itemCost = new Map(items.map((item) => [item.id, item.unitCost]));
  const estimatedHpp = transferCost > 0
    ? transferCost
    : sales.reduce(
        (sum, shift) =>
          sum + shift.lines.reduce(
            (lineSum, line) => lineSum + line.qty * (line.unitCost ?? itemCost.get(line.itemId) ?? 0),
            0,
          ),
        0,
      );

  const estimatedProfit = omzet - estimatedHpp - lossCost - operationalExpense - otherExpense;

  return {
    omzet,
    portions,
    estimatedHpp,
    transferCost,
    lossCost,
    operatingCost,
    stockExpense,
    operationalExpense,
    otherExpense,
    totalExpense,
    estimatedProfit,
  };
}

// Persentase perubahan omzet hari ini dibanding kemarin.
export function omzetChange(daily: DailySales[]): number {
  if (daily.length < 2) return 0;
  const today     = daily[daily.length - 1];
  const yesterday = daily[daily.length - 2];
  if (yesterday.omzet === 0) return 0;
  return ((today.omzet - yesterday.omzet) / yesterday.omzet) * 100;
}

// Agregat qty per item dari penjualan shift (untuk menu terlaris).
export function aggregateSalesByItem(
  sales: ShiftSales[],
): Map<string, { name: string; qty: number; price: number }> {
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
