import { createClient } from '@/lib/supabase/client';
import type {
  AuditEntry,
  DailySales,
  Expense,
  ExpenseCategory,
  MonthlySales,
  SalesLine,
  Shift,
  ShiftSales,
  StockItem,
  StockItemInput,
  StockTake,
  StockTakeKind,
} from '@/types/operations';

const DATE_FORMAT = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' });
const AUDIT_TIME_FORMAT = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Jakarta',
});

export function todayJakarta(): string {
  return DATE_FORMAT.format(new Date());
}

function throwIfError(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

async function selectAll<T>(
  queryPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await queryPage(from, from + 999);
    throwIfError(error);
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < 1000) return rows;
  }
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function fetchStockItems(): Promise<StockItem[]> {
  const supabase = createClient();
  const rows = await selectAll((from, to) => supabase.from('stock_items').select('*').order('name').range(from, to));
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    stock: Number(row.stock),
    minStock: Number(row.min_stock),
    unit: row.unit,
    unitCost: Number(row.unit_cost),
    price: Number(row.price),
    available: row.available,
  }));
}

export async function saveStockItem(
  input: StockItemInput,
  userId: string,
  userName: string,
  id?: string,
): Promise<StockItem> {
  const supabase = createClient();
  const values = {
    name: input.name,
    category: input.category,
    stock: input.stock,
    min_stock: input.minStock,
    unit: input.unit,
    unit_cost: input.unitCost,
    price: input.price,
    available: input.available,
    updated_at: new Date().toISOString(),
  };
  const result = id
    ? await supabase.from('stock_items').update(values).eq('id', id).select('*').single()
    : await supabase.from('stock_items').insert(values).select('*').single();
  throwIfError(result.error);
  const row = result.data;
  if (!row) throw new Error('Supabase tidak mengembalikan stok yang disimpan.');
  await addAudit(
    userId,
    userName,
    `${id ? 'Memperbarui' : 'Menambahkan'} stok ${row.name}`,
    'Stok & Menu',
    { stock_item_id: row.id },
  );
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    stock: Number(row.stock),
    minStock: Number(row.min_stock),
    unit: row.unit,
    unitCost: Number(row.unit_cost),
    price: Number(row.price),
    available: row.available,
  };
}

export async function fetchExpenses(): Promise<Expense[]> {
  const supabase = createClient();
  const rows = await selectAll((from, to) =>
    supabase.from('expenses').select('*').order('date', { ascending: false }).order('id', { ascending: false }).range(from, to),
  );
  return rows.map((row) => ({
    id: row.id,
    date: row.date,
    description: row.description,
    category: row.category as ExpenseCategory,
    amount: Number(row.amount),
  }));
}

export async function createExpense(
  input: Omit<Expense, 'id'>,
  userId: string,
  userName: string,
): Promise<void> {
  const { data, error } = await createClient()
    .from('expenses')
    .insert({
      date: input.date,
      description: input.description,
      category: input.category,
      amount: input.amount,
      created_by: userId,
    })
    .select('id')
    .single();
  throwIfError(error);
  if (!data) throw new Error('Supabase tidak mengembalikan pengeluaran yang disimpan.');
  await addAudit(userId, userName, `Menambah pengeluaran ${input.description} Rp${input.amount}`, 'Pengeluaran', { expense_id: data.id });
}

export async function fetchStockTakes(): Promise<StockTake[]> {
  const supabase = createClient();
  const rows = await selectAll((from, to) =>
    supabase.from('stock_takes').select('*').order('datetime', { ascending: false }).order('id', { ascending: false }).range(from, to),
  );
  return rows.map((row) => ({
    id: row.id,
    datetime: row.datetime,
    itemId: row.item_id ?? '',
    itemName: row.item_name,
    qty: Number(row.qty),
    kind: row.kind as StockTakeKind,
    reason: row.reason ?? undefined,
    staffName: row.staff_name,
    photo: row.photo ?? undefined,
    notes: row.notes ?? undefined,
  }));
}

export async function createStockTake(
  input: Omit<StockTake, 'id' | 'datetime'>,
  userId: string,
): Promise<void> {
  const supabase = createClient();
  const { data: current, error: readError } = await supabase
    .from('stock_items')
    .select('stock')
    .eq('id', input.itemId)
    .single();
  throwIfError(readError);
  if (!current) throw new Error('Item stok tidak ditemukan.');
  const currentStock = Number(current.stock);
  if (input.qty > currentStock) throw new Error('Jumlah pengambilan melebihi stok yang tersedia.');

  const { data: take, error: takeError } = await supabase
    .from('stock_takes')
    .insert({
      item_id: input.itemId,
      item_name: input.itemName,
      qty: input.qty,
      kind: input.kind,
      reason: input.reason ?? null,
      staff_name: input.staffName,
      staff_id: userId,
      photo: input.photo ?? null,
      notes: input.notes ?? null,
    })
    .select('id')
    .single();
  throwIfError(takeError);
  if (!take) throw new Error('Supabase tidak mengembalikan catatan pengambilan yang disimpan.');

  const { data: updated, error: updateError } = await supabase
    .from('stock_items')
    .update({ stock: currentStock - input.qty, updated_at: new Date().toISOString() })
    .eq('id', input.itemId)
    .eq('stock', currentStock)
    .select('id')
    .maybeSingle();

  if (updateError || !updated) {
    const { error: rollbackError } = await supabase.from('stock_takes').delete().eq('id', take.id);
    if (rollbackError) {
      throw new Error(`Stok gagal diperbarui dan catatan pengambilan gagal dibatalkan: ${rollbackError.message}`);
    }
    throw new Error(updateError?.message ?? 'Stok berubah bersamaan. Muat ulang data lalu coba lagi.');
  }

  await addAudit(
    userId,
    input.staffName,
    `${input.kind === 'rusak' ? 'Mencatat kerusakan' : 'Mengambil'} ${input.qty} ${input.itemName}`,
    'Ambil Barang',
    { stock_take_id: take.id },
  );
}

export async function saveStockCounts(
  updates: Array<{ id: string; name: string; before: number; after: number }>,
  userId: string,
  userName: string,
): Promise<void> {
  const supabase = createClient();
  for (const item of updates) {
    if (item.before === item.after) continue;
    const { data, error } = await supabase
      .from('stock_items')
      .update({ stock: item.after, updated_at: new Date().toISOString() })
      .eq('id', item.id)
      .eq('stock', item.before)
      .select('id')
      .maybeSingle();
    throwIfError(error);
    if (!data) throw new Error(`Stok ${item.name} berubah di sesi lain. Muat ulang dan lakukan opname kembali.`);
    await addAudit(userId, userName, `Opname stok ${item.name}: ${item.before} menjadi ${item.after}`, 'Stok & Menu');
  }
}

export async function fetchShiftSales(fromDate?: string): Promise<ShiftSales[]> {
  const supabase = createClient();
  const sales = await selectAll((from, to) => {
    let query = supabase.from('shift_sales').select('*').order('date', { ascending: false }).order('id', { ascending: false });
    if (fromDate) query = query.gte('date', fromDate);
    return query.range(from, to);
  });
  const ids = sales.map((sale) => sale.id);
  if (ids.length === 0) return [];

  const [lines, profiles] = await Promise.all([
    Promise.all(
      Array.from({ length: Math.ceil(ids.length / 200) }, (_, index) => {
        const saleIds = ids.slice(index * 200, (index + 1) * 200);
        return selectAll((from, to) =>
          supabase.from('sales_lines').select('*').in('sale_id', saleIds).range(from, to),
        );
      }),
    ).then((batches) => batches.flat()),
    (async () => {
      const profileIds = Array.from(new Set(sales.map((sale) => sale.recorded_by).filter(Boolean)));
      if (profileIds.length === 0) return [];
      const batches = await Promise.all(
        Array.from({ length: Math.ceil(profileIds.length / 200) }, (_, index) => {
          const idsForBatch = profileIds.slice(index * 200, (index + 1) * 200);
          return selectAll((from, to) =>
            supabase.from('profiles').select('id, name').in('id', idsForBatch).range(from, to),
          );
        }),
      );
      return batches.flat();
    })(),
  ]);

  const profileNames = new Map(profiles.map((profile) => [profile.id, profile.name]));
  const linesBySale = new Map<string, SalesLine[]>();
  for (const line of lines) {
    const current = linesBySale.get(line.sale_id) ?? [];
    current.push({
      itemId: line.item_id ?? '',
      name: line.name,
      qty: Number(line.qty),
      price: Number(line.price),
    });
    linesBySale.set(line.sale_id, current);
  }
  return sales.map((sale) => ({
    id: sale.id,
    date: sale.date,
    shift: sale.shift as Shift,
    total: Number(sale.total),
    recordedBy: profileNames.get(sale.recorded_by) ?? sale.recorded_by ?? '—',
    notes: sale.notes ?? undefined,
    lines: linesBySale.get(sale.id) ?? [],
  }));
}

export async function createShiftSale(input: {
  date: string;
  shift: Shift;
  total: number;
  notes?: string;
  lines: SalesLine[];
  userId: string;
  userName: string;
}): Promise<void> {
  const supabase = createClient();
  const { data: sale, error } = await supabase
    .from('shift_sales')
    .insert({
      date: input.date,
      shift: input.shift,
      total: input.total,
      recorded_by: input.userId,
      notes: input.notes ?? null,
    })
    .select('id')
    .single();
  throwIfError(error);
  if (!sale) throw new Error('Supabase tidak mengembalikan penjualan yang disimpan.');

  const { error: linesError } = await supabase.from('sales_lines').insert(
    input.lines.map((line) => ({
      sale_id: sale.id,
      item_id: line.itemId || null,
      name: line.name,
      qty: line.qty,
      price: line.price,
    })),
  );
  if (linesError) {
    const { error: rollbackError } = await supabase.from('shift_sales').delete().eq('id', sale.id);
    if (rollbackError) {
      throw new Error(`Penjualan tersimpan tanpa rincian, dan rollback gagal: ${rollbackError.message}`);
    }
    throw new Error(linesError.message);
  }
  await addAudit(input.userId, input.userName, `Mencatat penjualan shift ${input.shift} Rp${input.total}`, 'Penjualan', { sale_id: sale.id });
}

export async function fetchAuditEntries(limit?: number): Promise<AuditEntry[]> {
  const supabase = createClient();
  const rows = limit
    ? await supabase.from('audit_entries').select('*').order('created_at', { ascending: false }).order('id', { ascending: false }).limit(limit)
    : null;
  const data = rows
    ? (throwIfError(rows.error), rows.data ?? [])
    : await selectAll((from, to) =>
        supabase.from('audit_entries').select('*').order('created_at', { ascending: false }).order('id', { ascending: false }).range(from, to),
      );
  return data.map((row) => ({
    id: row.id,
    user: row.user_name,
    action: row.action,
    module: row.module,
    time: AUDIT_TIME_FORMAT.format(new Date(row.created_at)),
    createdAt: row.created_at,
  }));
}

export function fetchRecentAuditEntries(): Promise<AuditEntry[]> {
  return fetchAuditEntries(5);
}

async function addAudit(
  userId: string,
  userName: string,
  action: string,
  module: string,
  details: Record<string, string> = {},
): Promise<void> {
  const { error } = await createClient().from('audit_entries').insert({
    user_id: userId,
    user_name: userName,
    action,
    module,
    details,
  });
  if (error) throw new Error(`Data utama berhasil disimpan, tetapi audit log gagal: ${error.message}`);
}

export async function fetchDailySales(days = 7): Promise<DailySales[]> {
  const [year, month, day] = todayJakarta().split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, day - (days - 1)));
  const from = dateKey(start);
  const supabase = createClient();
  const data = await selectAll((pageFrom, pageTo) =>
    supabase.from('shift_sales').select('date, total').gte('date', from).range(pageFrom, pageTo),
  );
  const totals = new Map<string, number>();
  for (const row of data) totals.set(row.date, (totals.get(row.date) ?? 0) + Number(row.total));
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    const key = dateKey(date);
    return { date: key, omzet: totals.get(key) ?? 0 };
  });
}

export async function fetchMonthlySales(monthCount = 6): Promise<MonthlySales[]> {
  const [year, month] = todayJakarta().split('-').map(Number);
  const start = new Date(Date.UTC(year, month - monthCount, 1));
  const supabase = createClient();
  const data = await selectAll((from, to) =>
    supabase.from('shift_sales').select('date, total').gte('date', dateKey(start)).range(from, to),
  );
  const totals = new Map<string, number>();
  for (const row of data) {
    const key = row.date.slice(0, 7);
    totals.set(key, (totals.get(key) ?? 0) + Number(row.total));
  }
  const labelFormat = new Intl.DateTimeFormat('id-ID', { month: 'short', timeZone: 'Asia/Jakarta' });
  return Array.from({ length: monthCount }, (_, index) => {
    const date = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + index, 1));
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    return { month: labelFormat.format(date), omzet: totals.get(key) ?? 0 };
  });
}

export async function fetchTodayExpenses(): Promise<Expense[]> {
  const supabase = createClient();
  const rows = await selectAll((from, to) =>
    supabase.from('expenses').select('*').eq('date', todayJakarta()).range(from, to),
  );
  return rows.map((row) => ({
    id: row.id,
    date: row.date,
    description: row.description,
    category: row.category as ExpenseCategory,
    amount: Number(row.amount),
  }));
}

export async function fetchDashboardData() {
  const [stockItems, sales, expenses, auditEntries, daily, monthly] = await Promise.all([
    fetchStockItems(),
    fetchShiftSales(todayJakarta()),
    fetchTodayExpenses(),
    fetchAuditEntries(6),
    fetchDailySales(),
    fetchMonthlySales(),
  ]);
  return { stockItems, sales, expenses, auditEntries, daily, monthly };
}

export async function fetchReportData() {
  const [stockItems, shiftSales, expenses, stockTakes] = await Promise.all([
    fetchStockItems(),
    fetchShiftSales(),
    fetchExpenses(),
    fetchStockTakes(),
  ]);
  return { stockItems, shiftSales, expenses, stockTakes };
}

export function formatAuditTime(value: string): string {
  return AUDIT_TIME_FORMAT.format(new Date(value));
}
