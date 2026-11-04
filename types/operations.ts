export type StockStatus = 'aman' | 'menipis' | 'habis' | 'kritis';

export type StockItem = {
  id: string;
  name: string;
  category: string;
  stock: number;
  minStock: number;
  unit: string;
  unitCost: number;
  price: number;
  available: boolean;
};

export type StockItemInput = Omit<StockItem, 'id'>;

export type Shift = 'pagi-siang' | 'siang-sore';
export type SalesLine = { itemId: string; name: string; qty: number; price: number };
export type ShiftSales = {
  id: string;
  date: string;
  shift: Shift;
  lines: SalesLine[];
  total: number;
  recordedBy: string;
  notes?: string;
};

export type ExpenseCategory = 'Pembelian Stok' | 'Operasional' | 'Lainnya';
export type Expense = {
  id: string;
  date: string;
  description: string;
  category: ExpenseCategory;
  amount: number;
};

export type StockTakeKind = 'pemakaian' | 'rusak';
export type StockTake = {
  id: string;
  datetime: string;
  itemId: string;
  itemName: string;
  qty: number;
  kind: StockTakeKind;
  reason?: string;
  staffName: string;
  photo?: string;
  notes?: string;
};

export type AuditEntry = {
  id: string;
  user: string;
  action: string;
  module: string;
  time: string;
  createdAt: string;
};

export type DailySales = { date: string; omzet: number };
export type MonthlySales = { month: string; omzet: number };
