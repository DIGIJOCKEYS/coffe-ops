-- ============================================================
-- Coffee Ops — Skema Database Supabase (Terhubung dengan Clerk)
-- Jalankan seluruh skrip ini di: Supabase Dashboard > SQL Editor > Run
-- ============================================================

-- Bersihkan fungsi lama Supabase Auth jika pernah terpasang
drop function if exists public.handle_new_user() cascade;
drop function if exists public.guard_profile_role() cascade;
drop function if exists public.is_admin() cascade;

-- 1. PROFILES (Menyimpan data pengguna dari Clerk)
create table if not exists public.profiles (
  id text primary key, -- Clerk User ID (misal: user_2s8...)
  name text not null default '',
  email text not null default '',
  role text not null default 'staff' check (role in ('admin', 'staff')),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. STOCK ITEMS (Katalog bahan & menu kedai kopi)
create table if not exists public.stock_items (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text not null default 'Lainnya',
  stock numeric not null default 0,
  min_stock numeric not null default 0,
  unit text not null default 'porsi',
  unit_cost numeric not null default 0,
  price numeric not null default 0,
  available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. SHIFT SALES (Rekap penjualan kasir per shift)
create table if not exists public.shift_sales (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  shift text not null check (shift in ('pagi-siang', 'siang-sore')),
  total numeric not null default 0,
  recorded_by text references public.profiles (id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

-- 4. SALES LINES (Rincian menu yang terjual dalam shift)
create table if not exists public.sales_lines (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.shift_sales (id) on delete cascade,
  item_id uuid references public.stock_items (id) on delete set null,
  name text not null,
  qty numeric not null default 0,
  price numeric not null default 0
);

-- 5. EXPENSES (Pengeluaran operasional kedai)
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  description text not null,
  category text not null check (category in ('Pembelian Stok', 'Operasional', 'Lainnya')),
  amount numeric not null default 0,
  created_by text references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- 6. STOCK TAKES (Catatan pemakaian bahan atau barang rusak)
create table if not exists public.stock_takes (
  id uuid primary key default gen_random_uuid(),
  datetime timestamptz not null default now(),
  item_id uuid references public.stock_items (id) on delete set null,
  item_name text not null,
  qty numeric not null default 0,
  kind text not null default 'pemakaian' check (kind in ('pemakaian', 'rusak')),
  reason text,
  staff_name text not null,
  staff_id text references public.profiles (id) on delete set null,
  photo text,
  notes text,
  created_at timestamptz not null default now()
);

-- 7. AUDIT ENTRIES (Linimasa riwayat aktivitas sistem)
create table if not exists public.audit_entries (
  id uuid primary key default gen_random_uuid(),
  user_id text references public.profiles (id) on delete set null,
  user_name text not null,
  action text not null,
  module text not null,
  details jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- INDEXES UNTUK PERFORMA QUERY
create index if not exists idx_stock_items_category on public.stock_items(category);
create index if not exists idx_shift_sales_date on public.shift_sales(date desc);
create index if not exists idx_expenses_date on public.expenses(date desc);
create index if not exists idx_takes_datetime on public.stock_takes(datetime desc);
create index if not exists idx_audit_created_at on public.audit_entries(created_at desc);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

alter table public.profiles enable row level security;
alter table public.stock_items enable row level security;
alter table public.shift_sales enable row level security;
alter table public.sales_lines enable row level security;
alter table public.expenses enable row level security;
alter table public.stock_takes enable row level security;
alter table public.audit_entries enable row level security;

-- Policies: Mengizinkan akses operasi data yang sudah diautentikasi oleh aplikasi
drop policy if exists "allow_all_profiles" on public.profiles;
create policy "allow_all_profiles" on public.profiles for all using (true) with check (true);

drop policy if exists "allow_all_stock" on public.stock_items;
create policy "allow_all_stock" on public.stock_items for all using (true) with check (true);

drop policy if exists "allow_all_sales" on public.shift_sales;
create policy "allow_all_sales" on public.shift_sales for all using (true) with check (true);

drop policy if exists "allow_all_sales_lines" on public.sales_lines;
create policy "allow_all_sales_lines" on public.sales_lines for all using (true) with check (true);

drop policy if exists "allow_all_expenses" on public.expenses;
create policy "allow_all_expenses" on public.expenses for all using (true) with check (true);

drop policy if exists "allow_all_takes" on public.stock_takes;
create policy "allow_all_takes" on public.stock_takes for all using (true) with check (true);

drop policy if exists "allow_all_audit" on public.audit_entries;
create policy "allow_all_audit" on public.audit_entries for all using (true) with check (true);

-- ============================================================
-- SEED DATA — Menu & Stok Awal
-- ============================================================
insert into public.stock_items (name, category, stock, min_stock, unit, unit_cost, price, available) values
  ('Kopi Susu Gula Aren', 'Signature', 24, 20, 'porsi', 6500, 22000, true),
  ('Americano', 'Espresso', 41, 20, 'porsi', 4000, 18000, true),
  ('Cafe Latte', 'Espresso', 33, 20, 'porsi', 8000, 24000, true),
  ('Matcha Latte', 'Non-Kopi', 9, 15, 'porsi', 9500, 26000, true),
  ('Cokelat Panas', 'Non-Kopi', 0, 10, 'porsi', 7000, 22000, false),
  ('Espresso Tonic', 'Signature', 12, 15, 'porsi', 9000, 28000, true)
on conflict (name) do nothing;
