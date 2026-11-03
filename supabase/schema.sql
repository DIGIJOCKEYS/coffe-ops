-- ============================================================
-- Coffee Ops — skema database Supabase
-- Jalankan seluruh skrip ini sekali di: Supabase Dashboard > SQL Editor
-- ============================================================

-- ---------- PROFILES (1:1 dengan auth.users) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  role text not null default 'staff' check (role in ('admin', 'staff')),
  created_at timestamptz not null default now()
);

-- Buat profil otomatis saat signup. User pertama -> admin, sisanya -> staff.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cnt int;
begin
  select count(*) into cnt from public.profiles;
  insert into public.profiles (id, name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    case when cnt = 0 then 'admin' else 'staff' end
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- STOCK ITEMS (stok & menu) ----------
create table if not exists public.stock_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'Lainnya',
  stock numeric not null default 0,
  min_stock numeric not null default 0,
  unit text not null default 'porsi',
  unit_cost numeric not null default 0,
  price numeric not null default 0,
  available boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- SHIFT SALES + LINES (penjualan per shift) ----------
create table if not exists public.shift_sales (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  shift text not null check (shift in ('pagi-siang', 'siang-sore')),
  total numeric not null default 0,
  recorded_by uuid references public.profiles (id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.sales_lines (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.shift_sales (id) on delete cascade,
  item_id uuid references public.stock_items (id) on delete set null,
  name text not null,
  qty numeric not null default 0,
  price numeric not null default 0
);

-- ---------- EXPENSES (pengeluaran) ----------
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  description text not null,
  category text not null check (category in ('Pembelian Stok', 'Operasional', 'Lainnya')),
  amount numeric not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------- STOCK TAKES (ambil barang: pemakaian / rusak) ----------
create table if not exists public.stock_takes (
  id uuid primary key default gen_random_uuid(),
  datetime timestamptz not null default now(),
  item_id uuid references public.stock_items (id) on delete set null,
  item_name text not null,
  qty numeric not null default 0,
  kind text not null default 'pemakaian' check (kind in ('pemakaian', 'rusak')),
  reason text,
  staff_name text not null,
  photo text,
  notes text,
  created_at timestamptz not null default now()
);

-- ---------- AUDIT ENTRIES (linimasa aktivitas) ----------
create table if not exists public.audit_entries (
  id uuid primary key default gen_random_uuid(),
  user_name text not null,
  action text not null,
  module text not null,
  created_at timestamptz not null default now()
);

-- ---------- helper: cek admin ----------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ---------- cegah ubah role oleh non-admin ----------
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    new.role := old.role;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profile_role on public.profiles;
create trigger guard_profile_role
  before update on public.profiles
  for each row execute function public.guard_profile_role();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles enable row level security;
alter table public.stock_items enable row level security;
alter table public.shift_sales enable row level security;
alter table public.sales_lines enable row level security;
alter table public.expenses enable row level security;
alter table public.stock_takes enable row level security;
alter table public.audit_entries enable row level security;

-- profiles: baca sendiri atau admin; update sendiri (role dijaga trigger)
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "profiles_admin_all" on public.profiles;
create policy "profiles_admin_all" on public.profiles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- stock_items: semua authenticated bisa baca; hanya admin tulis
drop policy if exists "stock_select" on public.stock_items;
create policy "stock_select" on public.stock_items
  for select to authenticated using (true);

drop policy if exists "stock_admin_write" on public.stock_items;
create policy "stock_admin_write" on public.stock_items
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- shift_sales: baca semua; insert semua; update/delete admin
drop policy if exists "sales_select" on public.shift_sales;
create policy "sales_select" on public.shift_sales
  for select to authenticated using (true);

drop policy if exists "sales_insert" on public.shift_sales;
create policy "sales_insert" on public.shift_sales
  for insert to authenticated with check (true);

drop policy if exists "sales_admin_update" on public.shift_sales;
create policy "sales_admin_update" on public.shift_sales
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "sales_admin_delete" on public.shift_sales;
create policy "sales_admin_delete" on public.shift_sales
  for delete to authenticated using (public.is_admin());

-- sales_lines: baca semua; insert semua; update/delete admin
drop policy if exists "lines_select" on public.sales_lines;
create policy "lines_select" on public.sales_lines
  for select to authenticated using (true);

drop policy if exists "lines_insert" on public.sales_lines;
create policy "lines_insert" on public.sales_lines
  for insert to authenticated with check (true);

drop policy if exists "lines_admin_update" on public.sales_lines;
create policy "lines_admin_update" on public.sales_lines
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "lines_admin_delete" on public.sales_lines;
create policy "lines_admin_delete" on public.sales_lines
  for delete to authenticated using (public.is_admin());

-- expenses: baca semua; insert semua; delete admin
drop policy if exists "expenses_select" on public.expenses;
create policy "expenses_select" on public.expenses
  for select to authenticated using (true);

drop policy if exists "expenses_insert" on public.expenses;
create policy "expenses_insert" on public.expenses
  for insert to authenticated with check (true);

drop policy if exists "expenses_admin_delete" on public.expenses;
create policy "expenses_admin_delete" on public.expenses
  for delete to authenticated using (public.is_admin());

-- stock_takes: baca semua; insert semua; update/delete admin
drop policy if exists "takes_select" on public.stock_takes;
create policy "takes_select" on public.stock_takes
  for select to authenticated using (true);

drop policy if exists "takes_insert" on public.stock_takes;
create policy "takes_insert" on public.stock_takes
  for insert to authenticated with check (true);

drop policy if exists "takes_admin_update" on public.stock_takes;
create policy "takes_admin_update" on public.stock_takes
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "takes_admin_delete" on public.stock_takes;
create policy "takes_admin_delete" on public.stock_takes
  for delete to authenticated using (public.is_admin());

-- audit_entries: hanya admin baca; semua authenticated insert
drop policy if exists "audit_select" on public.audit_entries;
create policy "audit_select" on public.audit_entries
  for select to authenticated using (public.is_admin());

drop policy if exists "audit_insert" on public.audit_entries;
create policy "audit_insert" on public.audit_entries
  for insert to authenticated with check (true);

-- ============================================================
-- SEED DATA — stok awal (stok & menu)
-- ============================================================
insert into public.stock_items (name, category, stock, min_stock, unit, unit_cost, price, available) values
  ('Kopi Susu Gula Aren', 'Signature', 24, 20, 'porsi', 6500, 22000, true),
  ('Americano', 'Espresso', 41, 20, 'porsi', 4000, 18000, true),
  ('Cafe Latte', 'Espresso', 33, 20, 'porsi', 8000, 24000, true),
  ('Matcha Latte', 'Non-Kopi', 9, 15, 'porsi', 9500, 26000, true),
  ('Cokelat Panas', 'Non-Kopi', 0, 10, 'porsi', 7000, 22000, false),
  ('Espresso Tonic', 'Signature', 12, 15, 'porsi', 9000, 28000, true)
on conflict do nothing;
