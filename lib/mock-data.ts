// ============================================================
// Coffee Ops — model data disederhanakan:
// Stok = porsi menu yang sudah dipaketkan suplier
// (1 bungkus = 1 porsi menu). Input stok = definisi menu.
// ============================================================

export type StockStatus = 'aman' | 'menipis' | 'habis' | 'kritis';

// Stok sekaligus menu. available = true berarti item dijual sebagai menu.
export type StockItem = {
  id: string;
  name: string;
  category: string;
  stock: number;
  minStock: number;
  unit: string; // umumnya "porsi" atau "bungkus"
  unitCost: number; // harga beli per bungkus (dari suplier)
  price: number; // harga jual per porsi (0 jika bukan menu)
  available: boolean; // apakah dijadikan menu yang dijual
};

export type StockItemInput = Omit<StockItem, 'id'>;

// Penjualan per shift (sinkron audit dengan sistem kasir)
export type Shift = 'pagi-siang' | 'siang-sore';

export type SalesLine = { itemId: string; name: string; qty: number; price: number };

export type ShiftSales = {
  id: string;
  date: string; // ISO date, mis. 2026-11-03
  shift: Shift;
  lines: SalesLine[];
  total: number;
  recordedBy: string;
  notes?: string;
};

// Pengeluaran (beli stok dari suplier, es batu, cup, sedotan, air, dll)
export type ExpenseCategory = 'Pembelian Stok' | 'Operasional' | 'Lainnya';

export type Expense = {
  id: string;
  date: string;
  description: string;
  category: ExpenseCategory;
  amount: number;
};

// Ambil barang oleh staff (mengurangi stok, sumber audit).
// kind: 'pemakaian' = dipakai untuk produksi, 'rusak' = rusak/tumpah/hilang.
export type StockTakeKind = 'pemakaian' | 'rusak';
export type StockTake = {
  id: string;
  datetime: string; // ISO, mis. 2026-11-03T09:12
  itemId: string;
  itemName: string;
  qty: number;
  kind: StockTakeKind;
  reason?: string; // alasan, wajib untuk kind 'rusak'
  staffName: string;
  photo?: string; // data URL (prototype, tidak persisten)
  notes?: string;
};

// Audit log = linimasa aktivitas (ambil barang, penjualan, pengeluaran, stok)
export type AuditEntry = {
  id: string;
  user: string;
  action: string;
  module: string;
  time: string;
};

// Agregat untuk grafik (7 hari & bulanan) — nantinya dari database
export type DailySales = { date: string; omzet: number };
export type MonthlySales = { month: string; omzet: number };

export type NotificationItem = {
  id: string;
  title: string;
  description: string;
  time: string;
  read: boolean;
};

export const currentUser = {
  name: 'Hendra Wijaya',
  email: 'hendra@coffeeops.id',
  roleLabel: 'Admin / Pemilik',
  initials: 'HW',
};

export const notifications: NotificationItem[] = [
  { id: 'NTF-1', title: 'Stok Cokelat Panas habis', description: 'Item dinonaktifkan dari menu hingga stok tersedia.', time: '10 menit lalu', read: false },
  { id: 'NTF-2', title: 'Matcha Latte menipis', description: 'Sisa 9 porsi dari minimum 15 porsi.', time: '1 jam lalu', read: false },
  { id: 'NTF-3', title: 'Ambil barang menunggu konfirmasi', description: 'Dimas Pratama mengambil 40 porsi Kopi Susu Gula Aren.', time: '3 jam lalu', read: true },
];

export const stockItems: StockItem[] = [
  { id: 'STK-001', name: 'Kopi Susu Gula Aren', category: 'Signature', stock: 24, minStock: 20, unit: 'porsi', unitCost: 6_500, price: 22_000, available: true },
  { id: 'STK-002', name: 'Americano', category: 'Espresso', stock: 41, minStock: 20, unit: 'porsi', unitCost: 4_000, price: 18_000, available: true },
  { id: 'STK-003', name: 'Cafe Latte', category: 'Espresso', stock: 33, minStock: 20, unit: 'porsi', unitCost: 8_000, price: 24_000, available: true },
  { id: 'STK-004', name: 'Matcha Latte', category: 'Non-Kopi', stock: 9, minStock: 15, unit: 'porsi', unitCost: 9_500, price: 26_000, available: true },
  { id: 'STK-005', name: 'Cokelat Panas', category: 'Non-Kopi', stock: 0, minStock: 10, unit: 'porsi', unitCost: 7_000, price: 22_000, available: false },
  { id: 'STK-006', name: 'Espresso Tonic', category: 'Signature', stock: 12, minStock: 15, unit: 'porsi', unitCost: 9_000, price: 28_000, available: true },
];

// Penjualan shift hari ini (2026-11-03)
export const shiftSales: ShiftSales[] = [
  {
    id: 'SLS-001',
    date: '2026-11-03',
    shift: 'pagi-siang',
    recordedBy: 'Hendra Wijaya',
    notes: 'Sync dari kasir',
    lines: [
      { itemId: 'STK-001', name: 'Kopi Susu Gula Aren', qty: 40, price: 22_000 },
      { itemId: 'STK-002', name: 'Americano', qty: 26, price: 18_000 },
      { itemId: 'STK-003', name: 'Cafe Latte', qty: 22, price: 24_000 },
      { itemId: 'STK-004', name: 'Matcha Latte', qty: 16, price: 26_000 },
      { itemId: 'STK-006', name: 'Espresso Tonic', qty: 12, price: 28_000 },
    ],
    total: 2_628_000,
  },
  {
    id: 'SLS-002',
    date: '2026-11-03',
    shift: 'siang-sore',
    recordedBy: 'Hendra Wijaya',
    lines: [
      { itemId: 'STK-001', name: 'Kopi Susu Gula Aren', qty: 28, price: 22_000 },
      { itemId: 'STK-002', name: 'Americano', qty: 16, price: 18_000 },
      { itemId: 'STK-003', name: 'Cafe Latte', qty: 14, price: 24_000 },
      { itemId: 'STK-004', name: 'Matcha Latte', qty: 8, price: 26_000 },
      { itemId: 'STK-006', name: 'Espresso Tonic', qty: 4, price: 28_000 },
    ],
    total: 1_560_000,
  },
];

export const expenses: Expense[] = [
  { id: 'EXP-001', date: '2026-11-03', description: 'Restock Biji Kopi Arabica - 10 karung', category: 'Pembelian Stok', amount: 1_850_000 },
  { id: 'EXP-002', date: '2026-11-03', description: 'Es batu 20 kg', category: 'Operasional', amount: 60_000 },
  { id: 'EXP-003', date: '2026-11-03', description: 'Cup 12oz + sedotan', category: 'Operasional', amount: 115_000 },
  { id: 'EXP-004', date: '2026-11-02', description: 'Air galon 5 buah', category: 'Operasional', amount: 120_000 },
];

export const stockTakes: StockTake[] = [
  { id: 'TK-001', datetime: '2026-11-03T09:12', itemId: 'STK-001', itemName: 'Kopi Susu Gula Aren', qty: 40, kind: 'pemakaian', staffName: 'Dimas Pratama', notes: 'Ambil untuk shift pagi' },
  { id: 'TK-002', datetime: '2026-11-03T13:05', itemId: 'STK-002', itemName: 'Americano', qty: 26, kind: 'pemakaian', staffName: 'Rina Maharani' },
  { id: 'TK-003', datetime: '2026-11-03T15:40', itemId: 'STK-004', itemName: 'Matcha Latte', qty: 16, kind: 'pemakaian', staffName: 'Dimas Pratama' },
  { id: 'TK-004', datetime: '2026-11-03T16:20', itemId: 'STK-004', itemName: 'Matcha Latte', qty: 2, kind: 'rusak', reason: 'Tumpah saat disiapkan', staffName: 'Dimas Pratama' },
];

export const auditEntries: AuditEntry[] = [
  { id: 'AUD-001', user: 'Dimas Pratama', action: 'Mengambil 40 porsi Kopi Susu Gula Aren', module: 'Ambil Barang', time: '09:12' },
  { id: 'AUD-002', user: 'Rina Maharani', action: 'Mengambil 26 porsi Americano', module: 'Ambil Barang', time: '13:05' },
  { id: 'AUD-003', user: 'Hendra Wijaya', action: 'Mencatat penjualan shift pagi-siang Rp2.628.000', module: 'Penjualan', time: '14:00' },
  { id: 'AUD-004', user: 'Rina Maharani', action: 'Mengambil 16 porsi Matcha Latte', module: 'Ambil Barang', time: '15:40' },
  { id: 'AUD-005', user: 'Hendra Wijaya', action: 'Menambah pengeluaran Es batu 20 kg Rp60.000', module: 'Pengeluaran', time: '15:48' },
  { id: 'AUD-006', user: 'Hendra Wijaya', action: 'Menambah pengeluaran Restock Biji Kopi Arabica Rp1.850.000', module: 'Pengeluaran', time: '16:10' },
  { id: 'AUD-007', user: 'Hendra Wijaya', action: 'Memperbarui stok Cafe Latte menjadi 33 porsi', module: 'Stok & Menu', time: '16:45' },
  { id: 'AUD-008', user: 'Hendra Wijaya', action: 'Mencatat penjualan shift siang-sore Rp1.560.000', module: 'Penjualan', time: '18:30' },
  { id: 'AUD-009', user: 'Dimas Pratama', action: 'Mencatat 2 porsi Matcha Latte rusak/tumpah', module: 'Ambil Barang', time: '16:20' },
];

export const dailySales: DailySales[] = [
  { date: '2026-10-28', omzet: 3_610_000 },
  { date: '2026-10-29', omzet: 3_975_000 },
  { date: '2026-10-30', omzet: 3_420_000 },
  { date: '2026-10-31', omzet: 4_285_000 },
  { date: '2026-11-01', omzet: 4_640_000 },
  { date: '2026-11-02', omzet: 4_105_000 },
  { date: '2026-11-03', omzet: 4_188_000 },
];

export const monthlySales: MonthlySales[] = [
  { month: 'Mei', omzet: 92_400_000 },
  { month: 'Jun', omzet: 98_750_000 },
  { month: 'Jul', omzet: 104_200_000 },
  { month: 'Agu', omzet: 101_600_000 },
  { month: 'Sep', omzet: 112_900_000 },
  { month: 'Okt', omzet: 118_350_000 },
];
