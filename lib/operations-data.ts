import { createClient } from '@/lib/supabase/client';
import type {
  AuditEntry,
  DailySales,
  Expense,
  ExpenseCategory,
  MonthlySales,
  SaleMenu,
  SalesLine,
  Shift,
  ShiftSales,
  StockItem,
  StockItemInput,
  StockTake,
  StockTakeKind,
  UserProfile,
} from '@/types/operations';

// Type untuk token getter — bisa dari useSession().session.getToken
type TokenGetter = () => Promise<string | null> | string | null;

// Singleton sederhana: simpan token getter yang di-set dari component
let _getToken: TokenGetter | undefined;

/**
 * Daftarkan token getter dari Clerk session.
 * Panggil ini sekali dari AuthProvider atau provider teratas.
 * Contoh: setSupabaseTokenGetter(() => session.getToken())
 */
export function setSupabaseTokenGetter(getter: TokenGetter | undefined) {
  _getToken = getter;
}

/** Buat Supabase client dengan Clerk token jika tersedia */
function getSupabaseClient() {
  return createClient(_getToken);
}

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

function startOfJakartaDate(date: string): string {
  return new Date(`${date}T00:00:00+07:00`).toISOString();
}

function endOfJakartaDate(date: string): string {
  return new Date(new Date(`${date}T00:00:00+07:00`).getTime() + 24 * 60 * 60 * 1000).toISOString();
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
  const supabase = getSupabaseClient();
  const rows = await selectAll((from, to) => supabase.from('stock_items').select('*').order('name').range(from, to));
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    stock: Number(row.stock),
    outletStock: Number(row.outlet_stock ?? 0),
    minStock: Number(row.min_stock),
    unit: row.unit,
    unitCost: Number(row.unit_cost),
    price: Number(row.price),
    available: row.available,
  }));
}

export async function fetchSaleMenus(): Promise<SaleMenu[]> {
  const supabase = getSupabaseClient();
  const rows = await selectAll((from, to) =>
    supabase.from('stock_items').select('id, name, price, available').order('name').range(from, to),
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    price: Number(row.price),
    available: row.available,
  }));
}

export type StockMutationItem = {
  id: string;
  name: string;
  unit: string;
  stock?: number;
  outletStock?: number;
};

export async function fetchStockItemNames(): Promise<StockMutationItem[]> {
  const supabase = getSupabaseClient();
  const rows = await selectAll((from, to) =>
    supabase.from('stock_items').select('id, name, unit').order('name').range(from, to),
  );
  return rows.map((row) => ({ id: row.id, name: row.name, unit: row.unit }));
}

export async function saveStockItem(
  input: StockItemInput,
  userId: string,
  id?: string,
): Promise<StockItem> {
  const supabase = getSupabaseClient();
  const result = await supabase.rpc('save_stock_item_with_expense', {
    p_item_id: id ?? null,
    p_name: input.name,
    p_category: input.category ?? 'Lainnya',
    p_stock: input.stock,
    p_min_stock: input.minStock,
    p_unit: input.unit ?? 'porsi',
    p_unit_cost: input.unitCost,
    p_price: input.price,
    p_available: input.available,
    p_user_id: userId,
  });
  throwIfError(result.error);
  const row = Array.isArray(result.data) ? result.data[0] : null;
  if (!row) throw new Error('Supabase tidak mengembalikan stok yang disimpan.');
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    stock: Number(row.stock),
    outletStock: Number(row.outlet_stock ?? 0),
    minStock: Number(row.min_stock),
    unit: row.unit,
    unitCost: Number(row.unit_cost),
    price: Number(row.price),
    available: row.available,
  };
}

export type ExpensesPage = {
  records: Expense[];
  totalCount: number;
  totalAmount: number;
};

export async function fetchExpensesPage(
  userId: string | undefined,
  userRole: 'admin' | 'staff',
  page: number,
  pageSize: number,
  fromDate: string,
  toDate: string,
): Promise<ExpensesPage> {
  const supabase = getSupabaseClient();
  let query = supabase
    .from('expenses')
    .select('id, date, description, category, amount, created_by, created_at, has_photo, photo_thumbnail, profiles:profiles!expenses_created_by_fkey (id, name, role)')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });

  if (userRole === 'staff' && userId) {
    query = query.eq('created_by', userId);
    query = query.eq('category', 'Operasional');
  }
  query = query.gte('date', fromDate).lte('date', toDate);

  const [pageResult, summaryResult] = await Promise.all([
    query.range((page - 1) * pageSize, page * pageSize - 1),
    supabase.rpc('get_expense_summary', {
      p_user_id: userId ?? null,
      p_user_role: userRole,
      p_from_date: fromDate,
      p_to_date: toDate,
    }),
  ]);
  throwIfError(pageResult.error);
  throwIfError(summaryResult.error);

  const rows = pageResult.data ?? [];
  const summary = summaryResult.data?.[0];
  const records = rows.map((row) => {
    const relation = row.profiles as
      | { name?: string; role?: string }
      | { name?: string; role?: string }[]
      | null;
    const profile = Array.isArray(relation) ? relation[0] : relation;

    return {
      id: row.id,
      date: row.date,
      description: row.description,
      category: row.category as ExpenseCategory,
      amount: Number(row.amount),
      createdBy: row.created_by ?? undefined,
      createdByName: profile?.name ?? row.created_by ?? 'Unknown',
      createdByRole: (profile?.role as 'admin' | 'staff') ?? 'staff',
      createdAt: row.created_at,
      photoThumbnail: row.photo_thumbnail ?? undefined,
      hasPhoto: row.has_photo,
    };
  });

  return {
    records,
    totalCount: Number(summary?.total_count ?? 0),
    totalAmount: Number(summary?.total_amount ?? 0),
  };
}

export async function fetchExpenses(): Promise<Expense[]> {
  const supabase = getSupabaseClient();
  const rows = await selectAll((from, to) =>
    supabase
      .from('expenses')
      .select('id, date, description, category, amount, created_by, created_at, has_photo, photo_thumbnail, profiles:profiles!expenses_created_by_fkey (id, name, role)')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to),
  );

  return rows.map((row) => {
    const relation = row.profiles as
      | { name?: string; role?: string }
      | { name?: string; role?: string }[]
      | null;
    const profile = Array.isArray(relation) ? relation[0] : relation;

    return {
      id: row.id,
      date: row.date,
      description: row.description,
      category: row.category as ExpenseCategory,
      amount: Number(row.amount),
      createdBy: row.created_by ?? undefined,
      createdByName: profile?.name ?? row.created_by ?? 'Unknown',
      createdByRole: (profile?.role as 'admin' | 'staff') ?? 'staff',
      createdAt: row.created_at,
      photoThumbnail: row.photo_thumbnail ?? undefined,
      hasPhoto: row.has_photo,
    };
  });
}

export async function fetchExpensePhoto(expenseId: string): Promise<string | undefined> {
  const { data, error } = await getSupabaseClient()
    .from('expenses')
    .select('photo')
    .eq('id', expenseId)
    .maybeSingle();
  throwIfError(error);
  return data?.photo ?? undefined;
}

export async function fetchExpensePhotoPreview(expenseId: string): Promise<string | undefined> {
  const { data, error } = await getSupabaseClient()
    .from('expenses')
    .select('photo_thumbnail, photo')
    .eq('id', expenseId)
    .maybeSingle();
  throwIfError(error);
  return data?.photo_thumbnail ?? data?.photo ?? undefined;
}

export async function createExpense(
  input: Omit<Expense, 'id'>,
  userId: string,
  userName: string,
): Promise<void> {
  const { data, error } = await getSupabaseClient()
    .from('expenses')
    .insert({
      date: input.date,
      description: input.description,
      category: input.category,
      amount: input.amount,
      photo: input.photo ?? null,
      photo_thumbnail: input.photoThumbnail ?? null,
      created_by: userId,
    })
    .select('id')
    .single();
  throwIfError(error);
  if (!data) throw new Error('Supabase tidak mengembalikan pengeluaran yang disimpan.');
  await addAudit(userId, userName, `Menambah pengeluaran ${input.description} Rp${input.amount}`, 'Pengeluaran', { expense_id: data.id });
}

export async function fetchStockTakes(
  fromDate?: string,
  toDate?: string,
  userId?: string,
  userRole?: 'admin' | 'staff',
): Promise<StockTake[]> {
  const supabase = getSupabaseClient();
  const rows = await selectAll((from, to) => {
    let query = supabase
      .from('stock_takes')
      .select('id, datetime, item_id, item_name, qty, kind, unit_cost, transfer_cost, reason, staff_name, notes, has_photo, photo_thumbnail')
      .order('datetime', { ascending: false })
      .order('id', { ascending: false });
    if (userRole === 'staff' && userId) query = query.eq('staff_id', userId);
    if (fromDate) {
      query = query.gte('datetime', startOfJakartaDate(fromDate));
    }
    if (toDate) query = query.lt('datetime', endOfJakartaDate(toDate));
    return query.range(from, to);
  });
  return rows.map((row) => ({
    id: row.id,
    datetime: row.datetime,
    itemId: row.item_id ?? '',
    itemName: row.item_name,
    qty: Number(row.qty),
    kind: row.kind as StockTakeKind,
    unitCost: row.unit_cost === null || row.unit_cost === undefined ? undefined : Number(row.unit_cost),
    transferCost: row.transfer_cost === null || row.transfer_cost === undefined ? undefined : Number(row.transfer_cost),
    reason: row.reason ?? undefined,
    staffName: row.staff_name,
    photoThumbnail: row.photo_thumbnail ?? undefined,
    hasPhoto: row.has_photo,
    notes: row.notes ?? undefined,
  }));
}

export async function fetchStockTakePhoto(stockTakeId: string): Promise<string | undefined> {
  const { data, error } = await getSupabaseClient()
    .from('stock_takes')
    .select('photo')
    .eq('id', stockTakeId)
    .maybeSingle();
  throwIfError(error);
  return data?.photo ?? undefined;
}

export async function fetchStockTakePhotoPreview(stockTakeId: string): Promise<string | undefined> {
  const { data, error } = await getSupabaseClient()
    .from('stock_takes')
    .select('photo_thumbnail, photo')
    .eq('id', stockTakeId)
    .maybeSingle();
  throwIfError(error);
  return data?.photo_thumbnail ?? data?.photo ?? undefined;
}

export async function createStockTake(
  input: Omit<StockTake, 'id' | 'datetime'>,
  userId: string,
): Promise<void> {
  const { error } = await getSupabaseClient().rpc('record_stock_movement', {
    p_item_id: input.itemId,
    p_qty: input.qty,
    p_kind: input.kind,
    p_reason: input.reason ?? null,
    p_staff_id: userId,
    p_staff_name: input.staffName,
    p_photo: input.photo ?? null,
    p_photo_thumbnail: input.photoThumbnail ?? null,
    p_notes: input.notes ?? null,
  });
  throwIfError(error);
}

export async function saveStockCounts(
  updates: Array<{ id: string; name: string; before: number; after: number }>,
  userId: string,
  userName: string,
  location: 'warehouse' | 'outlet' = 'warehouse',
): Promise<void> {
  const supabase = getSupabaseClient();
  for (const item of updates) {
    if (item.before === item.after) continue;
    const { data, error } = await supabase
      .from('stock_items')
      .update(location === 'outlet'
        ? { outlet_stock: item.after, updated_at: new Date().toISOString(), updated_by: userId }
        : { stock: item.after, updated_at: new Date().toISOString(), updated_by: userId })
      .eq('id', item.id)
      .eq(location === 'outlet' ? 'outlet_stock' : 'stock', item.before)
      .select('id')
      .maybeSingle();
    throwIfError(error);
    if (!data) throw new Error(`Stok ${item.name} berubah di sesi lain. Muat ulang dan lakukan opname kembali.`);
    await addAudit(userId, userName, `Opname stok ${location === 'outlet' ? 'outlet' : 'gudang'} ${item.name}: ${item.before} menjadi ${item.after}`, 'Stock Opname');
  }
}

export async function fetchShiftSales(fromDate?: string, toDate?: string): Promise<ShiftSales[]> {
  const supabase = getSupabaseClient();
  const sales = await selectAll((from, to) => {
    let query = supabase
      .from('shift_sales')
      .select('*')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false });
    if (fromDate) query = query.gte('date', fromDate);
    if (toDate) query = query.lte('date', toDate);
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
      unitCost: line.unit_cost === null || line.unit_cost === undefined ? undefined : Number(line.unit_cost),
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
  notes?: string;
  lines: SalesLine[];
  userId: string;
}): Promise<number> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('record_shift_sale', {
    p_date: input.date,
    p_shift: input.shift,
    p_recorded_by: input.userId,
    p_notes: input.notes ?? null,
    p_lines: input.lines,
  });
  throwIfError(error);
  const sale = Array.isArray(data) ? data[0] : null;
  if (!sale?.sale_id) throw new Error('Supabase tidak mengembalikan penjualan yang disimpan.');
  return Number(sale.total);
}

export async function fetchAuditEntries(
  limit?: number,
  userId?: string,
  userRole?: 'admin' | 'staff',
  fromDate?: string,
  toDate?: string,
): Promise<AuditEntry[]> {
  const supabase = getSupabaseClient();
  const queryPage = (from: number, to: number) => {
    let query = supabase
      .from('audit_entries')
      .select('*')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false });
    if (userRole === 'staff' && userId) query = query.eq('user_id', userId);
    if (fromDate) query = query.gte('created_at', startOfJakartaDate(fromDate));
    if (toDate) query = query.lt('created_at', endOfJakartaDate(toDate));
    return query.range(from, to);
  };
  const data = limit
    ? await (async () => {
        let query = supabase
          .from('audit_entries')
          .select('*')
          .order('created_at', { ascending: false })
          .order('id', { ascending: false });
        if (userRole === 'staff' && userId) query = query.eq('user_id', userId);
        if (fromDate) query = query.gte('created_at', startOfJakartaDate(fromDate));
        if (toDate) query = query.lt('created_at', endOfJakartaDate(toDate));
        const { data: rows, error } = await query.limit(limit);
        throwIfError(error);
        return rows ?? [];
      })()
    : await selectAll(queryPage);
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

export async function fetchUserProfiles(): Promise<UserProfile[]> {
  const supabase = getSupabaseClient();
  const rows = await selectAll((from, to) =>
    supabase
      .from('profiles')
      .select('id, name, email, role, is_active, created_at')
      .order('name')
      .range(from, to),
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role as 'admin' | 'staff',
    isActive: row.is_active,
    createdAt: row.created_at,
  }));
}

export async function setUserActiveStatus(
  actorId: string,
  targetId: string,
  isActive: boolean,
): Promise<void> {
  const { error } = await getSupabaseClient().rpc('set_profile_active', {
    p_actor_id: actorId,
    p_target_id: targetId,
    p_is_active: isActive,
  });
  throwIfError(error);
}

export type NotificationItem = AuditEntry & { isRead: boolean; href: string };

const NOTIFICATION_ROUTES: Record<string, string> = {
  'Stok & Menu': '/stock',
  'Ambil Barang': '/stock-takes',
  'Mutasi Stok': '/stock-takes',
  Pengguna: '/users',
  'Stock Opname': '/stock-opname',
  Penjualan: '/sales',
  Pengeluaran: '/expenses',
};

export async function fetchNotifications(userId: string): Promise<NotificationItem[]> {
  const { data, error } = await getSupabaseClient().rpc('get_notifications', {
    p_user_id: userId,
    p_limit: 10,
  });
  throwIfError(error);
  const rows = (data ?? []) as Array<{
    id: string;
    user_name: string;
    action: string;
    module: string;
    created_at: string;
    is_read: boolean;
  }>;
  return rows.map((row) => ({
    id: row.id,
    user: row.user_name,
    action: row.action,
    module: row.module,
    time: AUDIT_TIME_FORMAT.format(new Date(row.created_at)),
    createdAt: row.created_at,
    isRead: row.is_read,
    href: NOTIFICATION_ROUTES[row.module] ?? '/audit-logs',
  }));
}

export async function fetchUnreadNotificationCount(userId: string): Promise<number> {
  const { data, error } = await getSupabaseClient().rpc('get_unread_notification_count', {
    p_user_id: userId,
  });
  throwIfError(error);
  return Number(data ?? 0);
}

export async function markNotificationRead(userId: string, entryId: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('mark_notification_read', {
    p_user_id: userId,
    p_audit_entry_id: entryId,
  });
  throwIfError(error);
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('mark_all_notifications_read', {
    p_user_id: userId,
  });
  throwIfError(error);
}

async function addAudit(
  userId: string,
  userName: string,
  action: string,
  module: string,
  details: Record<string, string> = {},
): Promise<void> {
  const { error } = await getSupabaseClient().from('audit_entries').insert({
    user_id: userId,
    user_name: userName,
    action,
    module,
    details,
  });
  if (error) throw new Error(`Data utama berhasil disimpan, tetapi audit log gagal: ${error.message}`);
}

export async function fetchDailySales(days = 7, throughDate = todayJakarta()): Promise<DailySales[]> {
  const [year, month, day] = throughDate.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, day - (days - 1)));
  const from = dateKey(start);
  const supabase = getSupabaseClient();
  const data = await selectAll((pageFrom, pageTo) =>
    supabase.from('shift_sales').select('date, total').gte('date', from).lte('date', throughDate).range(pageFrom, pageTo),
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

export async function fetchMonthlySales(monthCount = 6, throughDate = todayJakarta()): Promise<MonthlySales[]> {
  const [year, month] = throughDate.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - monthCount, 1));
  const supabase = getSupabaseClient();
  const data = await selectAll((from, to) =>
    supabase.from('shift_sales').select('date, total').gte('date', dateKey(start)).lte('date', throughDate).range(from, to),
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

export async function fetchTodayExpenses(
  date = todayJakarta(),
  userId?: string,
  userRole?: 'admin' | 'staff',
): Promise<Expense[]> {
  const supabase = getSupabaseClient();
  const rows = await selectAll((from, to) => {
    let query = supabase.from('expenses').select('id, date, description, category, amount').eq('date', date);
    if (userRole === 'staff' && userId) {
      query = query.eq('created_by', userId).eq('category', 'Operasional');
    }
    return query.range(from, to);
  });
  return rows.map((row) => ({
    id: row.id,
    date: row.date,
    description: row.description,
    category: row.category as ExpenseCategory,
    amount: Number(row.amount),
  }));
}

export type DashboardInventorySnapshot = {
  item_id: string;
  warehouse_stock: number;
  outlet_stock: number;
  snapshot_date: string;
};

export async function fetchInventorySnapshot(date: string): Promise<DashboardInventorySnapshot[]> {
  const { data, error } = await getSupabaseClient().rpc('get_inventory_snapshot', { p_date: date });
  throwIfError(error);
  return ((data ?? []) as DashboardInventorySnapshot[]).map((snapshot) => ({
    ...snapshot,
    warehouse_stock: Number(snapshot.warehouse_stock),
    outlet_stock: Number(snapshot.outlet_stock),
  }));
}

export async function fetchDashboardData(
  userId?: string,
  userRole?: 'admin' | 'staff',
  date = todayJakarta(),
) {
  const today = todayJakarta();
  const [currentStockItems, sales, expenses, auditEntries, daily, monthly, stockTakes, inventorySnapshot] = await Promise.all([
    userRole === 'admin' ? fetchStockItems() : Promise.resolve([]),
    fetchShiftSales(date, date),
    fetchTodayExpenses(date, userId, userRole),
    fetchAuditEntries(6, userId, userRole, date, date),
    fetchDailySales(7, date),
    fetchMonthlySales(6, date),
    fetchStockTakes(date, date, userId, userRole),
    userRole === 'admin' ? fetchInventorySnapshot(date) : Promise.resolve([]),
  ]);
  const snapshotByItem = new Map(inventorySnapshot.map((snapshot) => [snapshot.item_id, snapshot]));
  const stockItems = currentStockItems
    .filter((item) => date === today || snapshotByItem.has(item.id))
    .map((item) => {
      const snapshot = snapshotByItem.get(item.id);
      return snapshot
        ? { ...item, stock: snapshot.warehouse_stock, outletStock: snapshot.outlet_stock }
        : item;
    });
  const inventorySnapshotAvailable = userRole === 'admin' && (date === today || inventorySnapshot.length > 0);
  return { stockItems, sales, expenses, auditEntries, daily, monthly, stockTakes, inventorySnapshotAvailable };
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

// ─── DELETE / UPDATE SHIFT SALE ──────────────────────────────────────────────

export async function deleteShiftSale(saleId: string, userId: string, userName: string): Promise<void> {
  const supabase = getSupabaseClient();
  // Fetch sale info for audit first
  const { data: saleRow, error: fetchErr } = await supabase
    .from('shift_sales')
    .select('date, shift, total')
    .eq('id', saleId)
    .maybeSingle();
  throwIfError(fetchErr);

  // Fetch lines before deletion to restore outlet stock
  const { data: lineRows } = await supabase
    .from('sales_lines')
    .select('item_id, qty')
    .eq('sale_id', saleId);

  // Delete lines first (cascade might handle this, but explicit is safer)
  const { error: linesErr } = await supabase.from('sales_lines').delete().eq('sale_id', saleId);
  throwIfError(linesErr);

  const { error: saleErr } = await supabase.from('shift_sales').delete().eq('id', saleId);
  throwIfError(saleErr);

  // Restore outlet stock for returned items
  if (lineRows && lineRows.length > 0) {
    for (const line of lineRows) {
      if (line.item_id && line.qty > 0) {
        const { data: item } = await supabase
          .from('stock_items')
          .select('outlet_stock')
          .eq('id', line.item_id)
          .single();
        if (item) {
          await supabase
            .from('stock_items')
            .update({
              outlet_stock: Number(item.outlet_stock) + Number(line.qty),
              updated_at: new Date().toISOString(),
              updated_by: userId,
            })
            .eq('id', line.item_id);
        }
      }
    }
  }

  if (saleRow) {
    await addAudit(userId, userName, `Menghapus penjualan ${saleRow.shift} tanggal ${saleRow.date} total Rp${saleRow.total}`, 'Penjualan', { sale_id: saleId });
  }
}

export async function updateShiftSale(
  saleId: string,
  input: { date: string; shift: Shift; notes?: string; lines: SalesLine[] },
  userId: string,
  userName: string,
): Promise<number> {
  const supabase = getSupabaseClient();
  // Recalculate total
  const total = input.lines.reduce((sum, l) => sum + l.qty * l.price, 0);

  // Fetch old lines to adjust stock difference
  const { data: oldLines } = await supabase
    .from('sales_lines')
    .select('item_id, qty')
    .eq('sale_id', saleId);

  // Fetch unit_costs for items
  const itemIds = Array.from(new Set(input.lines.map((l) => l.itemId).filter(Boolean)));
  const { data: stockItems } = itemIds.length > 0
    ? await supabase.from('stock_items').select('id, unit_cost').in('id', itemIds)
    : { data: [] };
  const costMap = new Map((stockItems ?? []).map((i) => [i.id, Number(i.unit_cost)]));

  const { error: saleErr } = await supabase
    .from('shift_sales')
    .update({ date: input.date, shift: input.shift, notes: input.notes ?? null, total })
    .eq('id', saleId);
  throwIfError(saleErr);

  // Replace lines
  const { error: delErr } = await supabase.from('sales_lines').delete().eq('sale_id', saleId);
  throwIfError(delErr);

  const newLines = input.lines.map((l) => ({
    sale_id: saleId,
    item_id: l.itemId,
    name: l.name,
    qty: l.qty,
    price: l.price,
    unit_cost: costMap.get(l.itemId) ?? l.unitCost ?? 0,
  }));
  const { error: insErr } = await supabase.from('sales_lines').insert(newLines);
  throwIfError(insErr);

  // Adjust stock delta: old qty returned (+), new qty deducted (-)
  const oldQtyMap = new Map<string, number>();
  for (const ol of oldLines ?? []) {
    if (ol.item_id) oldQtyMap.set(ol.item_id, (oldQtyMap.get(ol.item_id) ?? 0) + Number(ol.qty));
  }
  const newQtyMap = new Map<string, number>();
  for (const nl of input.lines) {
    if (nl.itemId) newQtyMap.set(nl.itemId, (newQtyMap.get(nl.itemId) ?? 0) + Number(nl.qty));
  }
  const allAffected = new Set([...oldQtyMap.keys(), ...newQtyMap.keys()]);
  for (const itemId of allAffected) {
    const diff = (oldQtyMap.get(itemId) ?? 0) - (newQtyMap.get(itemId) ?? 0);
    if (diff !== 0) {
      const { data: item } = await supabase.from('stock_items').select('outlet_stock').eq('id', itemId).single();
      if (item) {
        await supabase
          .from('stock_items')
          .update({
            outlet_stock: Math.max(0, Number(item.outlet_stock) + diff),
            updated_at: new Date().toISOString(),
            updated_by: userId,
          })
          .eq('id', itemId);
      }
    }
  }

  await addAudit(userId, userName, `Mengedit penjualan ${input.shift} tanggal ${input.date}`, 'Penjualan', { sale_id: saleId });
  return total;
}

// ─── DELETE / UPDATE EXPENSE ─────────────────────────────────────────────────

export async function deleteExpense(expenseId: string, userId: string, userName: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { data: row, error: fetchErr } = await supabase
    .from('expenses')
    .select('description, amount')
    .eq('id', expenseId)
    .maybeSingle();
  throwIfError(fetchErr);

  const { error } = await supabase.from('expenses').delete().eq('id', expenseId);
  throwIfError(error);

  if (row) {
    await addAudit(userId, userName, `Menghapus pengeluaran "${row.description}" Rp${row.amount}`, 'Pengeluaran', { expense_id: expenseId });
  }
}

export async function updateExpense(
  expenseId: string,
  input: { date: string; description: string; category: ExpenseCategory; amount: number },
  userId: string,
  userName: string,
): Promise<void> {
  const { error } = await getSupabaseClient()
    .from('expenses')
    .update({ date: input.date, description: input.description, category: input.category, amount: input.amount })
    .eq('id', expenseId);
  throwIfError(error);
  await addAudit(userId, userName, `Mengedit pengeluaran "${input.description}" Rp${input.amount}`, 'Pengeluaran', { expense_id: expenseId });
}

// ─── DELETE / UPDATE STOCK TAKE (MUTASI STOK) ────────────────────────────────

export async function deleteStockTake(takeId: string, userId: string, userName: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { data: row, error: fetchErr } = await supabase
    .from('stock_takes')
    .select('item_id, item_name, qty, kind')
    .eq('id', takeId)
    .maybeSingle();
  throwIfError(fetchErr);

  const { error } = await supabase.from('stock_takes').delete().eq('id', takeId);
  throwIfError(error);

  if (row) {
    if (row.item_id) {
      const { data: item } = await supabase.from('stock_items').select('stock, outlet_stock').eq('id', row.item_id).single();
      if (item) {
        if (row.kind === 'transfer') {
          // Reverse transfer: return to warehouse, deduct from outlet
          await supabase.from('stock_items').update({
            stock: Number(item.stock) + Number(row.qty),
            outlet_stock: Math.max(0, Number(item.outlet_stock) - Number(row.qty)),
            updated_at: new Date().toISOString(),
            updated_by: userId,
          }).eq('id', row.item_id);
        } else if (row.kind === 'rusak' || row.kind === 'pemakaian') {
          // Reverse damage: return to outlet stock
          await supabase.from('stock_items').update({
            outlet_stock: Number(item.outlet_stock) + Number(row.qty),
            updated_at: new Date().toISOString(),
            updated_by: userId,
          }).eq('id', row.item_id);
        }
      }
    }

    await addAudit(userId, userName, `Menghapus mutasi stok ${row.kind} ${row.item_name} sebanyak ${row.qty}`, 'Mutasi Stok', { stock_take_id: takeId });
  }
}

export async function updateStockTake(
  takeId: string,
  input: { qty: number; reason?: string; notes?: string },
  userId: string,
  userName: string,
): Promise<void> {
  const { error } = await getSupabaseClient()
    .from('stock_takes')
    .update({ qty: input.qty, reason: input.reason ?? null, notes: input.notes ?? null })
    .eq('id', takeId);
  throwIfError(error);
  await addAudit(userId, userName, `Mengedit mutasi stok id ${takeId}`, 'Mutasi Stok', { stock_take_id: takeId });
}
