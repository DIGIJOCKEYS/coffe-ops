-- Non-destructive migration for separate warehouse and outlet balances.
-- Existing stock_items.stock remains warehouse stock; outlet_stock starts at 0.
-- Reconcile the physical outlet balance with a stock take after applying this migration.

begin;

alter table public.profiles
  add column if not exists is_active boolean not null default true;

alter table public.stock_items
  add column if not exists outlet_stock numeric not null default 0 check (outlet_stock >= 0);

alter table public.stock_takes
  add column if not exists photo_thumbnail text;

alter table public.stock_takes
  add column if not exists has_photo boolean generated always as (photo is not null) stored;

alter table public.stock_takes
  add column if not exists unit_cost numeric;

update public.stock_takes as take
set unit_cost = stock_items.unit_cost
from public.stock_items
where take.item_id = stock_items.id
  and take.unit_cost is null;

update public.stock_takes set unit_cost = 0 where unit_cost is null;
alter table public.stock_takes alter column unit_cost set default 0;
alter table public.stock_takes alter column unit_cost set not null;

alter table public.stock_takes
  drop constraint if exists stock_takes_kind_check;
alter table public.stock_takes
  add constraint stock_takes_kind_check check (kind in ('transfer', 'pemakaian', 'rusak'));

create or replace function public.record_stock_movement(
  p_item_id uuid,
  p_qty numeric,
  p_kind text,
  p_reason text,
  p_staff_id text,
  p_staff_name text,
  p_photo text,
  p_photo_thumbnail text,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  warehouse_balance numeric;
  outlet_balance numeric;
  current_unit_cost numeric;
  current_item_name text;
  movement_id uuid;
  audit_action text;
  actor_role text;
  actor_active boolean;
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

  select role, is_active into actor_role, actor_active
  from public.profiles where id = p_staff_id;
  if actor_role is null or actor_active is distinct from true then
    raise exception 'Akun Staff tidak aktif atau tidak ditemukan.';
  end if;
  if actor_role <> 'staff' then
    raise exception 'Mutasi stok hanya dapat dicatat oleh Staff.';
  end if;

  select stock, outlet_stock, unit_cost, name
    into warehouse_balance, outlet_balance, current_unit_cost, current_item_name
  from public.stock_items
  where id = p_item_id
  for update;

  if not found then
    raise exception 'Item stok tidak ditemukan.';
  end if;

  if p_kind = 'transfer' then
    if p_qty > warehouse_balance then
      raise exception 'Stok gudang % tersisa %, jumlah transfer %.', current_item_name, warehouse_balance, p_qty;
    end if;

    update public.stock_items
    set stock = stock - p_qty,
        outlet_stock = outlet_stock + p_qty,
        updated_at = now(),
        updated_by = p_staff_id
    where id = p_item_id;
    audit_action := format('Transfer %s %s dari gudang ke outlet', p_qty, current_item_name);
  else
    if p_qty > outlet_balance then
      raise exception 'Stok outlet % tersisa %, jumlah mutasi %.', current_item_name, outlet_balance, p_qty;
    end if;

    update public.stock_items
    set outlet_stock = outlet_stock - p_qty,
        updated_at = now(),
        updated_by = p_staff_id
    where id = p_item_id;
    audit_action := format('%s %s %s di outlet',
      case when p_kind = 'rusak' then 'Mencatat kerusakan' else 'Mencatat pemakaian' end,
      p_qty,
      current_item_name
    );
  end if;

  insert into public.stock_takes (
    item_id, item_name, qty, kind, unit_cost, reason, staff_name, staff_id,
    photo, photo_thumbnail, notes
  ) values (
    p_item_id, current_item_name, p_qty, p_kind, current_unit_cost, p_reason, p_staff_name, p_staff_id,
    p_photo, p_photo_thumbnail, p_notes
  ) returning id into movement_id;

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