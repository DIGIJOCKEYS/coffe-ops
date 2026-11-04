-- Non-destructive migration: enforce available menu stock when recording sales.
-- Run once in Supabase SQL Editor. Existing sales and stock are preserved.

begin;

alter table public.sales_lines
  add column if not exists unit_cost numeric;

update public.sales_lines as line
set unit_cost = stock_items.unit_cost
from public.stock_items
where line.item_id = stock_items.id
  and line.unit_cost is null;

update public.sales_lines set unit_cost = 0 where unit_cost is null;
alter table public.sales_lines alter column unit_cost set default 0;
alter table public.sales_lines alter column unit_cost set not null;

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
      raise exception 'Stok outlet untuk % tidak mencukupi.', item_name;
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

revoke all on function public.record_shift_sale(date, text, text, text, jsonb) from public;
grant execute on function public.record_shift_sale(date, text, text, text, jsonb) to anon, authenticated;

commit;