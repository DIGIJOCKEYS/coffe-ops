export type StockStatus = 'aman' | 'menipis' | 'habis' | 'kritis';

export type Ingredient = {
  id: string;
  name: string;
  category: string;
  stock: number;
  minStock: number;
  baseUnit: string;
  purchaseUnit: string;
  unitCost: number;
};

export type IngredientInput = Omit<Ingredient, 'id'>;

export type Menu = {
  id: string;
  name: string;
  category: string;
  price: number;
  hpp: number;
  soldToday: number;
  available: boolean;
};

export type DailySales = {
  date: string;
  omzet: number;
  transactions: number;
};

export type MonthlySales = {
  month: string;
  omzet: number;
};

export type ActivityItem = {
  id: string;
  user: string;
  action: string;
  module: string;
  time: string;
};

export type TransactionItem = {
  id: string;
  time: string;
  itemsSummary: string;
  paymentMethod: 'Tunai' | 'QRIS' | 'Kartu Debit';
  total: number;
};

export type NotificationItem = {
  id: string;
  title: string;
  description: string;
  time: string;
  read: boolean;
};

export const DAILY_OPERATING_COST = 1_350_000;

export const currentUser = {
  name: 'Hendra Wijaya',
  email: 'hendra@coffeeops.id',
  roleLabel: 'Admin / Pemilik',
  initials: 'HW',
};

export const notifications: NotificationItem[] = [
  { id: 'NTF-1', title: 'Stok Cup Plastik habis', description: 'Segera lakukan penerimaan stok kemasan.', time: '10 menit lalu', read: false },
  { id: 'NTF-2', title: 'Stock opname menunggu persetujuan', description: 'Opname mingguan diajukan oleh Budi Santoso.', time: '1 jam lalu', read: false },
  { id: 'NTF-3', title: 'Biji Kopi Arabica di bawah minimum', description: 'Sisa 4,2 kg dari minimum 8 kg.', time: '3 jam lalu', read: true },
];

export const ingredients: Ingredient[] = [
  { id: 'ING-001', name: 'Biji Kopi Arabica Gayo', category: 'Kopi', stock: 4.2, minStock: 8, baseUnit: 'kg', purchaseUnit: 'karung 1 kg', unitCost: 185_000 },
  { id: 'ING-002', name: 'Susu Full Cream', category: 'Susu', stock: 12, minStock: 10, baseUnit: 'liter', purchaseUnit: 'karton 1 liter', unitCost: 24_500 },
  { id: 'ING-003', name: 'Gula Aren Cair', category: 'Pemanis', stock: 2.5, minStock: 5, baseUnit: 'liter', purchaseUnit: 'botol 1 liter', unitCost: 38_000 },
  { id: 'ING-004', name: 'Cup Plastik 12oz', category: 'Kemasan', stock: 0, minStock: 300, baseUnit: 'pcs', purchaseUnit: 'dus 50 pcs', unitCost: 1_150 },
  { id: 'ING-005', name: 'Sirup Vanilla', category: 'Sirup', stock: 3, minStock: 4, baseUnit: 'botol', purchaseUnit: 'botol 750 ml', unitCost: 82_000 },
  { id: 'ING-006', name: 'Matcha Powder', category: 'Teh & Bubuk', stock: 180, minStock: 500, baseUnit: 'gram', purchaseUnit: 'pouch 250 gram', unitCost: 105_000 },
  { id: 'ING-007', name: 'Cokelat Bubuk', category: 'Bubuk', stock: 1.1, minStock: 2, baseUnit: 'kg', purchaseUnit: 'pouch 1 kg', unitCost: 96_000 },
  { id: 'ING-008', name: 'Es Batu', category: 'Lainnya', stock: 0, minStock: 20, baseUnit: 'kg', purchaseUnit: 'kantong 5 kg', unitCost: 15_000 },
];

export const menus: Menu[] = [
  { id: 'MNU-001', name: 'Kopi Susu Gula Aren', category: 'Signature', price: 22_000, hpp: 6_800, soldToday: 64, available: true },
  { id: 'MNU-002', name: 'Americano', category: 'Espresso', price: 18_000, hpp: 4_100, soldToday: 41, available: true },
  { id: 'MNU-003', name: 'Cafe Latte', category: 'Espresso', price: 24_000, hpp: 8_300, soldToday: 33, available: true },
  { id: 'MNU-004', name: 'Matcha Latte', category: 'Non-Kopi', price: 26_000, hpp: 9_600, soldToday: 28, available: true },
  { id: 'MNU-005', name: 'Cokelat Panas', category: 'Non-Kopi', price: 22_000, hpp: 7_200, soldToday: 14, available: false },
];

export const dailySales: DailySales[] = [
  { date: '2026-10-28', omzet: 3_610_000, transactions: 142 },
  { date: '2026-10-29', omzet: 3_975_000, transactions: 151 },
  { date: '2026-10-30', omzet: 3_420_000, transactions: 134 },
  { date: '2026-10-31', omzet: 4_285_000, transactions: 169 },
  { date: '2026-11-01', omzet: 4_640_000, transactions: 178 },
  { date: '2026-11-02', omzet: 4_105_000, transactions: 160 },
  { date: '2026-11-03', omzet: 4_820_000, transactions: 186 },
];

export const monthlySales: MonthlySales[] = [
  { month: 'Mei', omzet: 92_400_000 },
  { month: 'Jun', omzet: 98_750_000 },
  { month: 'Jul', omzet: 104_200_000 },
  { month: 'Agu', omzet: 101_600_000 },
  { month: 'Sep', omzet: 112_900_000 },
  { month: 'Okt', omzet: 118_350_000 },
];

export const activities: ActivityItem[] = [
  { id: 'ACT-101', user: 'Rina Maharani', action: 'Mencatat penerimaan 2 karung Biji Kopi Arabica', module: 'Penerimaan Stok', time: '09:12' },
  { id: 'ACT-102', user: 'Dimas Pratama', action: 'Mencatat penggunaan 1,5 liter Susu Full Cream', module: 'Penggunaan Stok', time: '10:04' },
  { id: 'ACT-103', user: 'Sari Wulandari', action: 'Menonaktifkan menu Cokelat Panas', module: 'Menu & Resep', time: '11:37' },
  { id: 'ACT-104', user: 'Budi Santoso', action: 'Mengajukan stock opname mingguan', module: 'Stock Opname', time: '13:20' },
  { id: 'ACT-105', user: 'Rina Maharani', action: 'Menambahkan pengeluaran listrik', module: 'Pengeluaran', time: '15:48' },
];

export const recentTransactions: TransactionItem[] = [
  { id: 'TRX-20261103-186', time: '16:42', itemsSummary: 'Kopi Susu Gula Aren x2, Americano x1', paymentMethod: 'QRIS', total: 62_000 },
  { id: 'TRX-20261103-185', time: '16:31', itemsSummary: 'Matcha Latte x1', paymentMethod: 'Tunai', total: 26_000 },
  { id: 'TRX-20261103-184', time: '16:18', itemsSummary: 'Americano x3', paymentMethod: 'Kartu Debit', total: 54_000 },
  { id: 'TRX-20261103-183', time: '16:05', itemsSummary: 'Cafe Latte x2', paymentMethod: 'QRIS', total: 48_000 },
  { id: 'TRX-20261103-182', time: '15:52', itemsSummary: 'Kopi Susu Gula Aren x1', paymentMethod: 'Tunai', total: 22_000 },
];
