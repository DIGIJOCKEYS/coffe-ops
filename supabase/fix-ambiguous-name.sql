-- ============================================================
-- PATCH: Jalankan seluruh file ini di Supabase SQL Editor
-- 1. Fix "column reference name is ambiguous" di save_stock_item_with_expense
-- 2. Rusak/tumpah → otomatis masuk pengeluaran kategori 'Kerugian Stok'
-- 3. Transfer → catat transfer_cost untuk estimasi HPP
-- ============================================================

begin;

-- ── Kolom baru di stock_takes ─────────────────────────────────────────────
alter table public.stock_takes
  add column if not exists transfer_cost numeric not null default 0;

-- ── Fungsi 1: save_stock_item_with_expense (fix ambiguous name) ───────────
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
  -- Qualify ALL columns with table alias to avoid ambiguity with return-table columns
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

revoke all on function public.save_stock_item_with_expense(uuid, text, text, numeric, numeric, text, numeric, numeric, boolean, text) from public;
grant execute on function public.save_stock_item_with_expense(uuid, text, text, numeric, numeric, text, numeric, numeric, boolean, text) to anon, authenticated;

-- ── Fungsi 2: record_stock_movement (rusak → expense, transfer → transfer_cost) ──
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

  -- ── Transfer Gudang → Outlet ────────────────────────────────────────────
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

  -- ── Rusak / Tumpah di Outlet ────────────────────────────────────────────
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

revoke all on function public.record_stock_movement(uuid, numeric, text, text, text, text, text, text, text) from public;
grant execute on function public.record_stock_movement(uuid, numeric, text, text, text, text, text, text, text) to anon, authenticated;

commit;
