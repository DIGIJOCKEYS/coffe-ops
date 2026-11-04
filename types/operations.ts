export type StockStatus = 'aman' | 'menipis' | 'habis' | 'kritis';

export type StockItem = {
  id: string;
  name: string;
  category: string;
  stock: number;
  outletStock: number;
  minStock: number;
  unit: string;
  unitCost: number;
  price: number;
  available: boolean;
  createdBy?: string;
  createdAt?: string;
};

export type StockItemInput = Omit<StockItem, 'id' | 'createdBy' | 'createdAt' | 'outletStock'> & {
  category?: string;
  unit?: string;
};

export type SaleMenu = Pick<StockItem, 'id' | 'name' | 'price' | 'available'>;

export type StockMutationItem = Pick<StockItem, 'id' | 'name' | 'unit'> & {
  stock?: number;
  outletStock?: number;
};

export type Shift = 'pagi-siang' | 'siang-sore';
export type SalesLine = { itemId: string; name: string; qty: number; price: number; unitCost?: number };
export type ShiftSales = {
  id: string;
  date: string;
  shift: Shift;
  lines: SalesLine[];
  total: number;
  recordedBy: string;
  notes?: string;
  createdAt?: string;
};

export type ExpenseCategory = 'Pembelian Stok' | 'Operasional' | 'Kerugian Stok' | 'Lainnya';
export type Expense = {
  id: string;
  date: string;
  description: string;
  category: ExpenseCategory;
  amount: number;
  photo?: string;
  photoThumbnail?: string;
  hasPhoto?: boolean;
  createdBy?: string;
  createdByName?: string;
  createdByRole?: 'admin' | 'staff';
  createdAt?: string;
};

export type StockTakeKind = 'transfer' | 'pemakaian' | 'rusak';
export type StockTake = {
  id: string;
  datetime: string;
  itemId: string;
  itemName: string;
  qty: number;
  kind: StockTakeKind;
  unitCost?: number;
  transferCost?: number;  // nilai modal transfer (qty × unit_cost), hanya untuk kind=transfer
  reason?: string;
  staffName: string;
  photo?: string;
  photoThumbnail?: string;
  hasPhoto?: boolean;
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

export type UserProfile = {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'staff';
  isActive: boolean;
  createdAt: string;
};

export type DailySales = { date: string; omzet: number };
export type MonthlySales = { month: string; omzet: number };
