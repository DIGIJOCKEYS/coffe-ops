-- Migration: Kerugian stok (rusak/tumpah) otomatis masuk pengeluaran.
-- Transfer ke outlet mencatat transfer_cost untuk estimasi HPP di dashboard/laporan.
-- Jalankan di Supabase SQL Editor.

begin;

-- 1. Tambah kolom transfer_cost di stock_takes (nilai modal yang keluar saat transfer)
alter table public.stock_takes
  add column if not exists transfer_cost numeric not null default 0;

-- 2. Pastikan kategori Kerugian Stok bisa masuk ke expenses
--    (tidak ada constraint enum, jadi cukup dipakai di aplikasi)

-- 3. Ganti fungsi record_stock_movement:
--    - kind=rusak → insert expenses kategori 'Kerugian Stok'
--    - kind=transfer → catat transfer_cost = qty * unit_cost (tidak masuk expenses)
create or replace function public.record_stock_movement(
  p_item_id        uuid,
  p_qty            numeric,
  p_kind           text,
  p_reason         text,
  p_staff_id       text,
  p_staff_name     text,
  p_photo          text,
  p_photo_thumbnail text,
  p_notes          text
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
  -- Validasi input dasar
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

  -- Validasi aktor
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

  -- Ambil data item (lock baris untuk atomisitas)
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
        format('Kerugian stok: %s rusak/tumpah %s %s', current_item_name, p_qty, 'porsi'),
        'Kerugian Stok',
        loss_amount,
        p_staff_id
      );
    end if;
  end if;

  -- Audit log
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
