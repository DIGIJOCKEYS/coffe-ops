-- ============================================================
-- NESTATION - FULL DATABASE RESET (Clerk + Supabase)
-- Jalankan sekali di Supabase Dashboard > SQL Editor.
-- PERINGATAN: skrip ini menghapus semua data dan tabel aplikasi.
-- Jangan jalankan pada project yang datanya masih ingin disimpan.
-- ============================================================

begin;

drop function if exists public.save_stock_item_with_expense(uuid, text, text, numeric, numeric, text, numeric, numeric, boolean, text);
drop function if exists public.record_shift_sale(date, text, text, text, jsonb);
drop function if exists public.record_stock_movement(uuid, numeric, text, text, text, text, text, text, text);
drop function if exists public.get_inventory_snapshot(date);
drop function if exists public.capture_daily_inventory_snapshot();

do $$
begin
  if to_regclass('public.expenses') is not null then
    execute 'drop trigger if exists expenses_sync_totals on public.expenses';
    execute 'drop trigger if exists expenses_staff_category_guard on public.expenses';
  end if;
end;
$$;

drop function if exists public.get_expense_summary(text, text, date, date);
drop function if exists public.sync_expense_totals();
drop function if exists public.get_notifications(text, integer);
drop function if exists public.get_unread_notification_count(text);
drop function if exists public.mark_notification_read(text, uuid);
drop function if exists public.mark_all_notifications_read(text);
drop function if exists public.set_profile_active(text, text, boolean);
drop function if exists public.enforce_staff_operational_expense();

-- Drop children before parents. No CASCADE: unrelated dependencies are preserved.
drop table if exists public.sales_lines;
drop table if exists public.shift_sales;
drop table if exists public.expenses;
drop table if exists public.expense_totals;
drop table if exists public.audit_entry_reads;
drop table if exists public.stock_takes;
drop table if exists public.audit_entries;
drop table if exists public.daily_inventory_snapshots;
drop table if exists public.stock_items;
drop table if exists public.profiles;

create table public.profiles (
  id text primary key,
  name text not null default '',
  email text not null default '',
  role text not null default 'staff' check (role in ('admin', 'staff')),
  is_active boolean not null default true,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.stock_items (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text not null default 'Lainnya',
  stock numeric not null default 0 check (stock >= 0),
  min_stock numeric not null default 0 check (min_stock >= 0),
  outlet_stock numeric not null default 0 check (outlet_stock >= 0),
  unit text not null default 'porsi',
  unit_cost numeric not null default 0 check (unit_cost >= 0),
  price numeric not null default 0 check (price >= 0),
  available boolean not null default true,
  created_by text constraint stock_items_created_by_fkey references public.profiles (id) on delete set null,
  updated_by text constraint stock_items_updated_by_fkey references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.daily_inventory_snapshots (
  item_id uuid not null references public.stock_items (id) on delete cascade,
  snapshot_date date not null,
  warehouse_stock numeric not null default 0 check (warehouse_stock >= 0),
  outlet_stock numeric not null default 0 check (outlet_stock >= 0),
  updated_at timestamptz not null default now(),
  primary key (item_id, snapshot_date)
);

create table public.shift_sales (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  shift text not null check (shift in ('pagi-siang', 'siang-sore')),
  total numeric not null default 0 check (total >= 0),
  recorded_by text constraint shift_sales_recorded_by_fkey references public.profiles (id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create table public.sales_lines (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.shift_sales (id) on delete cascade,
  item_id uuid references public.stock_items (id) on delete set null,
  name text not null,
  qty numeric not null check (qty > 0),
  price numeric not null check (price >= 0),
  unit_cost numeric not null default 0 check (unit_cost >= 0)
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  description text not null,
  category text not null check (category in ('Pembelian Stok', 'Operasional', 'Kerugian Stok', 'Lainnya')),
  amount numeric not null check (amount > 0),
  photo text,
  photo_thumbnail text,
  has_photo boolean generated always as (photo is not null) stored,
  created_by text constraint expenses_created_by_fkey references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create or replace function public.enforce_staff_operational_expense()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  creator_role text;
begin
  select role into creator_role from public.profiles where id = new.created_by;
  if creator_role = 'staff' and new.category not in ('Operasional', 'Kerugian Stok') then
    raise exception 'Staff hanya dapat mencatat kategori Operasional.';
  end if;
  return new;
end;
$$;

create trigger expenses_staff_category_guard
before insert or update of category, created_by on public.expenses
for each row execute function public.enforce_staff_operational_expense();

create table public.expense_totals (
  user_key text primary key,
  total_count bigint not null default 0 check (total_count >= 0),
  total_amount numeric not null default 0 check (total_amount >= 0),
  updated_at timestamptz not null default now()
);

create table public.stock_takes (
  id uuid primary key default gen_random_uuid(),
  datetime timestamptz not null default now(),
  item_id uuid references public.stock_items (id) on delete set null,
  item_name text not null,
  qty numeric not null check (qty > 0),
  kind text not null default 'pemakaian' check (kind in ('transfer', 'pemakaian', 'rusak')),
  unit_cost numeric not null default 0 check (unit_cost >= 0),
  transfer_cost numeric not null default 0 check (transfer_cost >= 0),
  reason text,
  staff_name text not null,
  staff_id text constraint stock_takes_staff_id_fkey references public.profiles (id) on delete set null,
  photo text,
  photo_thumbnail text,
  has_photo boolean generated always as (photo is not null) stored,
  notes text,
  created_at timestamptz not null default now()
);

create table public.audit_entries (
  id uuid primary key default gen_random_uuid(),
  user_id text constraint audit_entries_user_id_fkey references public.profiles (id) on delete set null,
  user_name text not null,
  action text not null,
  module text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.audit_entry_reads (
  audit_entry_id uuid not null references public.audit_entries (id) on delete cascade,
  user_id text not null references public.profiles (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (audit_entry_id, user_id)
);

create or replace function public.capture_daily_inventory_snapshot()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.daily_inventory_snapshots (
    item_id, snapshot_date, warehouse_stock, outlet_stock, updated_at
  ) values (
    new.id,
    (now() at time zone 'Asia/Jakarta')::date,
    new.stock,
    new.outlet_stock,
    now()
  )
  on conflict (item_id, snapshot_date) do update
  set warehouse_stock = excluded.warehouse_stock,
      outlet_stock = excluded.outlet_stock,
      updated_at = excluded.updated_at;
  return new;
end;
$$;

create trigger stock_items_capture_daily_snapshot
after insert or update of stock, outlet_stock on public.stock_items
for each row execute function public.capture_daily_inventory_snapshot();

create or replace function public.get_inventory_snapshot(p_date date)
returns table (item_id uuid, warehouse_stock numeric, outlet_stock numeric, snapshot_date date)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if p_date >= (now() at time zone 'Asia/Jakarta')::date then
    return query
    select item.id, item.stock, item.outlet_stock, (now() at time zone 'Asia/Jakarta')::date
    from public.stock_items as item;
  else
    return query
    select latest.item_id, latest.warehouse_stock, latest.outlet_stock, latest.snapshot_date
    from (
      select distinct on (snapshot.item_id)
        snapshot.item_id,
        snapshot.warehouse_stock,
        snapshot.outlet_stock,
        snapshot.snapshot_date
      from public.daily_inventory_snapshots as snapshot
      where snapshot.snapshot_date <= p_date
      order by snapshot.item_id, snapshot.snapshot_date desc
    ) as latest;
  end if;
end;
$$;

create or replace function public.record_shift_sale(
  p_date date,
  p_shift text,
  p_recorded_by text,
  p_notes text,
  p_lines jsonb
)
returns table (sale_id uuid, total numeric)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  requested_item record;
  available_stock numeric;
  item_name text;
  calculated_total numeric;
  created_sale_id uuid;
begin
  if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Tambahkan minimal satu menu untuk dicatat.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_lines) as line
    where nullif(line->>'itemId', '') is null
       or coalesce((line->>'qty')::numeric, 0) <= 0
       or coalesce((line->>'price')::numeric, -1) < 0
  ) then
    raise exception 'Rincian penjualan tidak valid.';
  end if;

  for requested_item in
    select (line->>'itemId')::uuid as item_id,
           sum((line->>'qty')::numeric) as qty
    from jsonb_array_elements(p_lines) as line
    group by (line->>'itemId')::uuid
    order by (line->>'itemId')::uuid
  loop
    select stock_items.outlet_stock, stock_items.name
      into available_stock, item_name
    from public.stock_items
    where stock_items.id = requested_item.item_id
      and stock_items.available = true
    for update;

    if not found then
      raise exception 'Menu tidak tersedia. Muat ulang data lalu coba lagi.';
    end if;

    if requested_item.qty > available_stock then
      raise exception 'Stok % tersisa %, jumlah yang diminta %.', item_name, available_stock, requested_item.qty;
    end if;

    update public.stock_items
    set outlet_stock = outlet_stock - requested_item.qty,
        updated_at = now(),
        updated_by = p_recorded_by
    where id = requested_item.item_id;
  end loop;

  calculated_total := (
    select coalesce(sum((line->>'qty')::numeric * item.price), 0)
    from jsonb_array_elements(p_lines) as line
    join public.stock_items as item on item.id = (line->>'itemId')::uuid
  );

  insert into public.shift_sales (date, shift, total, recorded_by, notes)
  values (p_date, p_shift, calculated_total, p_recorded_by, p_notes)
  returning id into created_sale_id;

  insert into public.sales_lines (sale_id, item_id, name, qty, price, unit_cost)
  select created_sale_id, item.id, item.name, (line->>'qty')::numeric, item.price, item.unit_cost
  from jsonb_array_elements(p_lines) as line
  join public.stock_items as item on item.id = (line->>'itemId')::uuid;

  insert into public.audit_entries (user_id, user_name, action, module, details)
  select p_recorded_by,
         coalesce(profile.name, p_recorded_by),
         format('Mencatat penjualan shift %s Rp%s', p_shift, calculated_total),
         'Penjualan',
         jsonb_build_object('sale_id', created_sale_id)
  from (select 1) as singleton
  left join public.profiles as profile on profile.id = p_recorded_by;

  return query select created_sale_id, calculated_total;
end;
$$;

create or replace function public.save_stock_item_with_expense(
  p_item_id   uuid,
  p_name      text,
  p_category  text,
  p_stock     numeric,
  p_min_stock numeric,
  p_unit      text,
  p_unit_cost numeric,
  p_price     numeric,
  p_available boolean,
  p_user_id   text
)
returns table (
  id          uuid,
  name        text,
  category    text,
  stock       numeric,
  outlet_stock numeric,
  min_stock   numeric,
  unit        text,
  unit_cost   numeric,
  price       numeric,
  available   boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor_role    text;
  actor_active  boolean;
  actor_name    text;
  previous_stock numeric := 0;
  stock_delta   numeric;
  saved_item    public.stock_items%rowtype;
  purchase_amount      numeric;
  purchase_description text;
begin
  select profiles.role, profiles.is_active, profiles.name
    into actor_role, actor_active, actor_name
  from public.profiles
  where profiles.id = p_user_id;

  if actor_role is distinct from 'admin' or actor_active is distinct from true then
    raise exception 'Hanya Admin aktif yang dapat mengelola stok gudang.';
  end if;
  if p_stock is null or p_stock < 0 or p_min_stock is null or p_min_stock < 0 then
    raise exception 'Jumlah stok tidak valid.';
  end if;
  if p_unit_cost is null or p_unit_cost < 0 or p_price is null or p_price < 0 then
    raise exception 'Harga tidak valid.';
  end if;

  if p_item_id is null then
    insert into public.stock_items (
      name, category, stock, min_stock, unit, unit_cost, price, available, created_by, updated_by
    ) values (
      p_name, p_category, p_stock, p_min_stock, p_unit, p_unit_cost, p_price, p_available, p_user_id, p_user_id
    ) returning * into saved_item;
  else
    select * into saved_item
    from public.stock_items
    where stock_items.id = p_item_id
    for update;
    if not found then raise exception 'Item stok tidak ditemukan.'; end if;
    previous_stock := saved_item.stock;

    update public.stock_items
    set name       = p_name,
        category   = p_category,
        stock      = p_stock,
        min_stock  = p_min_stock,
        unit       = p_unit,
        unit_cost  = p_unit_cost,
        price      = p_price,
        available  = p_available,
        updated_by = p_user_id,
        updated_at = now()
    where stock_items.id = p_item_id
    returning * into saved_item;
  end if;

  stock_delta := p_stock - previous_stock;
  if stock_delta > 0 and p_unit_cost > 0 then
    purchase_amount      := stock_delta * p_unit_cost;
    purchase_description := format('Restock %s (%s %s)', p_name, stock_delta, p_unit);

    insert into public.expenses (date, description, category, amount, created_by)
    values (
      (now() at time zone 'Asia/Jakarta')::date,
      purchase_description,
      'Pembelian Stok',
      purchase_amount,
      p_user_id
    );

    insert into public.audit_entries (user_id, user_name, action, module, details)
    values (
      p_user_id,
      coalesce(actor_name, p_user_id),
      format('Mencatat pembelian stok %s Rp%s', p_name, purchase_amount),
      'Pengeluaran',
      jsonb_build_object(
        'category',      'Pembelian Stok',
        'stock_item_id', saved_item.id,
        'quantity',      stock_delta
      )
    );
  end if;

  insert into public.audit_entries (user_id, user_name, action, module, details)
  values (
    p_user_id,
    coalesce(actor_name, p_user_id),
    format('%s stok %s', case when p_item_id is null then 'Menambahkan' else 'Memperbarui' end, p_name),
    'Stok & Menu',
    jsonb_build_object('stock_item_id', saved_item.id, 'warehouse_stock', saved_item.stock)
  );

  return query
    select saved_item.id,
           saved_item.name,
           saved_item.category,
           saved_item.stock,
           saved_item.outlet_stock,
           saved_item.min_stock,
           saved_item.unit,
           saved_item.unit_cost,
           saved_item.price,
           saved_item.available;
end;
$$;

create or replace function public.record_stock_movement(
  p_item_id         uuid,
  p_qty             numeric,
  p_kind            text,
  p_reason          text,
  p_staff_id        text,
  p_staff_name      text,
  p_photo           text,
  p_photo_thumbnail text,
  p_notes           text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  warehouse_balance  numeric;
  outlet_balance     numeric;
  current_unit_cost  numeric;
  current_item_name  text;
  movement_id        uuid;
  audit_action       text;
  actor_role         text;
  actor_active       boolean;
  loss_amount        numeric;
  t_cost             numeric;
begin
  if p_qty is null or p_qty <= 0 then
    raise exception 'Jumlah mutasi harus lebih dari 0.';
  end if;
  if p_kind not in ('transfer', 'rusak') then
    raise exception 'Jenis mutasi tidak valid.';
  end if;
  if p_kind in ('transfer', 'rusak') and p_photo is null then
    raise exception 'Foto bukti wajib untuk transfer atau kerusakan stok.';
  end if;
  if p_kind = 'rusak' and nullif(trim(p_reason), '') is null then
    raise exception 'Alasan kerusakan wajib diisi.';
  end if;

  select profiles.role, profiles.is_active
    into actor_role, actor_active
  from public.profiles
  where profiles.id = p_staff_id;

  if actor_role is null or actor_active is distinct from true then
    raise exception 'Akun tidak aktif atau tidak ditemukan.';
  end if;
  if actor_role not in ('admin', 'staff') then
    raise exception 'Mutasi stok hanya dapat dicatat oleh Admin atau Staff.';
  end if;

  select stock_items.stock,
         stock_items.outlet_stock,
         stock_items.unit_cost,
         stock_items.name
    into warehouse_balance, outlet_balance, current_unit_cost, current_item_name
  from public.stock_items
  where stock_items.id = p_item_id
  for update;

  if not found then
    raise exception 'Item stok tidak ditemukan.';
  end if;

  -- ── Transfer Gudang → Outlet ─────────────────────────────────────────────
  if p_kind = 'transfer' then
    if p_qty > warehouse_balance then
      raise exception 'Stok gudang % tersisa %, jumlah transfer %.', current_item_name, warehouse_balance, p_qty;
    end if;

    update public.stock_items
    set stock        = stock - p_qty,
        outlet_stock = outlet_stock + p_qty,
        updated_at   = now(),
        updated_by   = p_staff_id
    where stock_items.id = p_item_id;

    t_cost       := p_qty * current_unit_cost;
    audit_action := format('Transfer %s %s dari gudang ke outlet (modal Rp%s)', p_qty, current_item_name, t_cost);

    insert into public.stock_takes (
      item_id, item_name, qty, kind, unit_cost, transfer_cost,
      reason, staff_name, staff_id, photo, photo_thumbnail, notes
    ) values (
      p_item_id, current_item_name, p_qty, p_kind, current_unit_cost, t_cost,
      p_reason, p_staff_name, p_staff_id, p_photo, p_photo_thumbnail, p_notes
    ) returning stock_takes.id into movement_id;

  -- ── Rusak / Tumpah di Outlet ─────────────────────────────────────────────
  else
    if p_qty > outlet_balance then
      raise exception 'Stok outlet % tersisa %, jumlah mutasi %.', current_item_name, outlet_balance, p_qty;
    end if;

    update public.stock_items
    set outlet_stock = outlet_stock - p_qty,
        updated_at   = now(),
        updated_by   = p_staff_id
    where stock_items.id = p_item_id;

    loss_amount  := p_qty * current_unit_cost;
    audit_action := format('Mencatat kerusakan %s %s di outlet (kerugian Rp%s)', p_qty, current_item_name, loss_amount);

    insert into public.stock_takes (
      item_id, item_name, qty, kind, unit_cost, transfer_cost,
      reason, staff_name, staff_id, photo, photo_thumbnail, notes
    ) values (
      p_item_id, current_item_name, p_qty, p_kind, current_unit_cost, 0,
      p_reason, p_staff_name, p_staff_id, p_photo, p_photo_thumbnail, p_notes
    ) returning stock_takes.id into movement_id;

    -- Otomatis catat sebagai pengeluaran Kerugian Stok
    if loss_amount > 0 then
      insert into public.expenses (date, description, category, amount, created_by)
      values (
        (now() at time zone 'Asia/Jakarta')::date,
        format('Kerugian stok: %s rusak/tumpah %s porsi', current_item_name, p_qty),
        'Kerugian Stok',
        loss_amount,
        p_staff_id
      );
    end if;
  end if;

  insert into public.audit_entries (user_id, user_name, action, module, details)
  values (
    p_staff_id,
    p_staff_name,
    audit_action,
    'Mutasi Stok',
    jsonb_build_object('stock_take_id', movement_id, 'kind', p_kind, 'qty', p_qty)
  );

  return movement_id;
end;
$$;

create index idx_stock_items_category on public.stock_items (category);
create index idx_inventory_snapshots_date on public.daily_inventory_snapshots (snapshot_date desc);
create index idx_stock_items_created_by on public.stock_items (created_by);
create index idx_shift_sales_date on public.shift_sales (date desc);
create index idx_shift_sales_created_at on public.shift_sales (created_at desc);
create index idx_expenses_date on public.expenses (date desc);
create index idx_expenses_created_at on public.expenses (created_at desc);
create index idx_expenses_created_by on public.expenses (created_by);
create index idx_expenses_page_admin on public.expenses (date desc, created_at desc, id desc);
create index idx_expenses_page_staff on public.expenses (created_by, date desc, created_at desc, id desc);
create index idx_expenses_staff_operational on public.expenses (created_by, category, date desc, created_at desc, id desc);
create index idx_takes_datetime on public.stock_takes (datetime desc);
create index idx_takes_staff_id on public.stock_takes (staff_id);
create index idx_audit_created_at on public.audit_entries (created_at desc);
create index idx_audit_entry_reads_user on public.audit_entry_reads (user_id, read_at desc);

alter table public.profiles enable row level security;
alter table public.stock_items enable row level security;
alter table public.daily_inventory_snapshots enable row level security;
alter table public.shift_sales enable row level security;
alter table public.sales_lines enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_totals enable row level security;
alter table public.stock_takes enable row level security;
alter table public.audit_entries enable row level security;
alter table public.audit_entry_reads enable row level security;

-- TEMPORARY FOR TESTING ONLY:
-- The current browser client authenticates with Clerk, not Supabase Auth.
-- These policies keep the existing client working but do not protect rows by role.
-- Before production, connect Clerk identity to trusted server-side access or JWT claims,
-- then replace these permissive policies with per-role policies.
create policy "profiles_testing_access" on public.profiles
  for all to anon, authenticated using (true) with check (true);
create policy "stock_items_testing_access" on public.stock_items
  for all to anon, authenticated using (true) with check (true);
create policy "shift_sales_testing_access" on public.shift_sales
  for all to anon, authenticated using (true) with check (true);
create policy "sales_lines_testing_access" on public.sales_lines
  for all to anon, authenticated using (true) with check (true);
create policy "expenses_testing_access" on public.expenses
  for all to anon, authenticated using (true) with check (true);
create policy "stock_takes_testing_access" on public.stock_takes
  for all to anon, authenticated using (true) with check (true);
create policy "audit_entries_testing_access" on public.audit_entries
  for all to anon, authenticated using (true) with check (true);
create policy "audit_entry_reads_testing_select" on public.audit_entry_reads
  for select to anon, authenticated using (true);
create policy "daily_inventory_snapshots_testing_access" on public.daily_inventory_snapshots
  for all to anon, authenticated using (true) with check (true);
create policy "expense_totals_testing_access" on public.expense_totals
  for all to anon, authenticated using (true) with check (true);

revoke all on function public.save_stock_item_with_expense(uuid, text, text, numeric, numeric, text, numeric, numeric, boolean, text) from public;
grant execute on function public.save_stock_item_with_expense(uuid, text, text, numeric, numeric, text, numeric, numeric, boolean, text) to anon, authenticated;
revoke all on function public.record_shift_sale(date, text, text, text, jsonb) from public;
grant execute on function public.record_shift_sale(date, text, text, text, jsonb) to anon, authenticated;
revoke all on function public.record_stock_movement(uuid, numeric, text, text, text, text, text, text, text) from public;
grant execute on function public.record_stock_movement(uuid, numeric, text, text, text, text, text, text, text) to anon, authenticated;

create or replace function public.get_notifications(p_user_id text, p_limit integer default 10)
returns table (id uuid, user_name text, action text, module text, created_at timestamptz, is_read boolean)
language sql stable security definer set search_path = pg_catalog, public
as $$
  select a.id, a.user_name, a.action, a.module, a.created_at,
         (r.audit_entry_id is not null) as is_read
  from public.audit_entries as a
  left join public.audit_entry_reads as r
    on r.audit_entry_id = a.id and r.user_id = p_user_id
  where (select p.role from public.profiles as p where p.id = p_user_id) = 'admin'
     or a.user_id = p_user_id
  order by a.created_at desc, a.id desc
  limit greatest(1, least(coalesce(p_limit, 10), 50));
$$;

create or replace function public.get_unread_notification_count(p_user_id text)
returns bigint language sql stable security definer set search_path = pg_catalog, public
as $$
  select count(*)::bigint from public.audit_entries as a
  where not exists (
    select 1 from public.audit_entry_reads as r
    where r.audit_entry_id = a.id and r.user_id = p_user_id
  )
    and (
      (select p.role from public.profiles as p where p.id = p_user_id) = 'admin'
      or a.user_id = p_user_id
    );
$$;

create or replace function public.mark_notification_read(p_user_id text, p_audit_entry_id uuid)
returns void language sql security definer set search_path = pg_catalog, public
as $$
  insert into public.audit_entry_reads (audit_entry_id, user_id)
  select a.id, p_user_id
  from public.audit_entries as a
  where a.id = p_audit_entry_id
    and (
      (select p.role from public.profiles as p where p.id = p_user_id) = 'admin'
      or a.user_id = p_user_id
    )
  on conflict (audit_entry_id, user_id) do nothing;
$$;

create or replace function public.mark_all_notifications_read(p_user_id text)
returns void language sql security definer set search_path = pg_catalog, public
as $$
  insert into public.audit_entry_reads (audit_entry_id, user_id)
    select a.id, p_user_id
    from public.audit_entries as a
    where (select p.role from public.profiles as p where p.id = p_user_id) = 'admin'
      or a.user_id = p_user_id
  on conflict (audit_entry_id, user_id) do nothing;
$$;

create or replace function public.set_profile_active(
  p_actor_id text,
  p_target_id text,
  p_is_active boolean
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor_role text;
  actor_active boolean;
  actor_name text;
  target_role text;
  target_active boolean;
  target_name text;
  active_admin_count integer;
begin
  select role, is_active, name into actor_role, actor_active, actor_name
  from public.profiles where id = p_actor_id;
  if actor_role is distinct from 'admin' or actor_active is distinct from true then
    raise exception 'Hanya Admin aktif yang dapat mengubah status pengguna.';
  end if;

  select role, is_active, name into target_role, target_active, target_name
  from public.profiles where id = p_target_id for update;
  if not found then raise exception 'Pengguna tidak ditemukan.'; end if;
  if p_actor_id = p_target_id and p_is_active = false then
    raise exception 'Admin tidak dapat menonaktifkan akunnya sendiri.';
  end if;

  if target_role = 'admin' and target_active and not p_is_active then
    perform pg_advisory_xact_lock(hashtext('nestation-active-admin-status'));
    select count(*) into active_admin_count from public.profiles where role = 'admin' and is_active = true;
    if active_admin_count <= 1 then raise exception 'Admin aktif terakhir tidak dapat dinonaktifkan.'; end if;
  end if;

  if target_active = p_is_active then return false; end if;
  update public.profiles set is_active = p_is_active, updated_at = now() where id = p_target_id;
  insert into public.audit_entries (user_id, user_name, action, module, details)
  values (
    p_actor_id,
    coalesce(actor_name, p_actor_id),
    format('%s akun %s', case when p_is_active then 'Mengaktifkan' else 'Menonaktifkan' end, coalesce(target_name, p_target_id)),
    'Pengguna',
    jsonb_build_object('target_user_id', p_target_id, 'is_active', p_is_active)
  );
  return true;
end;
$$;

create or replace function public.sync_expense_totals()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  old_user_key text;
  new_user_key text;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    old_user_key := coalesce(old.created_by, '__unattributed__');
    update public.expense_totals
    set total_count = greatest(total_count - 1, 0),
        total_amount = greatest(total_amount - old.amount, 0),
        updated_at = now()
    where user_key = old_user_key;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    new_user_key := coalesce(new.created_by, '__unattributed__');
    insert into public.expense_totals (user_key, total_count, total_amount, updated_at)
    values (new_user_key, 1, new.amount, now())
    on conflict (user_key) do update
    set total_count = public.expense_totals.total_count + 1,
        total_amount = public.expense_totals.total_amount + excluded.total_amount,
        updated_at = now();
    return new;
  end if;

  return old;
end;
$$;

create trigger expenses_sync_totals
after insert or update or delete on public.expenses
for each row execute function public.sync_expense_totals();

create or replace function public.get_expense_summary(
  p_user_id text,
  p_user_role text,
  p_from_date date,
  p_to_date date
)
returns table (total_count bigint, total_amount numeric)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select count(*)::bigint, coalesce(sum(e.amount), 0)::numeric
  from public.expenses as e
  where e.date between p_from_date and p_to_date
    and (
      p_user_role is distinct from 'staff'
      or (e.created_by = p_user_id and e.category = 'Operasional')
    );
$$;

revoke all on function public.get_expense_summary(text, text, date, date) from public;
grant execute on function public.get_expense_summary(text, text, date, date) to anon, authenticated;
revoke all on function public.sync_expense_totals() from public, anon, authenticated;
revoke all on function public.enforce_staff_operational_expense() from public, anon, authenticated;
revoke all on function public.get_notifications(text, integer) from public;
revoke all on function public.get_unread_notification_count(text) from public;
revoke all on function public.mark_notification_read(text, uuid) from public;
revoke all on function public.mark_all_notifications_read(text) from public;
revoke all on function public.set_profile_active(text, text, boolean) from public;
grant execute on function public.get_notifications(text, integer) to anon, authenticated;
grant execute on function public.get_unread_notification_count(text) to anon, authenticated;
grant execute on function public.mark_notification_read(text, uuid) to anon, authenticated;
grant execute on function public.mark_all_notifications_read(text) to anon, authenticated;
grant execute on function public.set_profile_active(text, text, boolean) to anon, authenticated;
revoke all on function public.get_inventory_snapshot(date) from public;
grant execute on function public.get_inventory_snapshot(date) to anon, authenticated;
revoke all on function public.capture_daily_inventory_snapshot() from public, anon, authenticated;

do $$
declare
  table_name text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach table_name in array array[
      'stock_items', 'shift_sales', 'sales_lines', 'expenses',
      'stock_takes', 'audit_entries', 'audit_entry_reads', 'profiles', 'daily_inventory_snapshots'
    ] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = table_name
      ) then
        execute format('alter publication supabase_realtime add table public.%I', table_name);
      end if;
    end loop;
  end if;
end;
$$;

commit;
