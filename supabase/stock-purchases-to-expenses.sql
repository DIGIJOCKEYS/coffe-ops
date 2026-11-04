-- Non-destructive migration: stock increases create a matching stock-purchase expense.

begin;

create or replace function public.save_stock_item_with_expense(
  p_item_id uuid,
  p_name text,
  p_category text,
  p_stock numeric,
  p_min_stock numeric,
  p_unit text,
  p_unit_cost numeric,
  p_price numeric,
  p_available boolean,
  p_user_id text
)
returns table (
  id uuid,
  name text,
  category text,
  stock numeric,
  outlet_stock numeric,
  min_stock numeric,
  unit text,
  unit_cost numeric,
  price numeric,
  available boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor_role text;
  actor_active boolean;
  actor_name text;
  previous_stock numeric := 0;
  stock_delta numeric;
  saved_item public.stock_items%rowtype;
  purchase_amount numeric;
  purchase_description text;
begin
  select profiles.role, profiles.is_active, profiles.name
    into actor_role, actor_active, actor_name
  from public.profiles where profiles.id = p_user_id;

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
    select * into saved_item from public.stock_items where stock_items.id = p_item_id for update;
    if not found then raise exception 'Item stok tidak ditemukan.'; end if;
    previous_stock := saved_item.stock;

    update public.stock_items
    set name = p_name,
        category = p_category,
        stock = p_stock,
        min_stock = p_min_stock,
        unit = p_unit,
        unit_cost = p_unit_cost,
        price = p_price,
        available = p_available,
        updated_by = p_user_id,
        updated_at = now()
    where stock_items.id = p_item_id
    returning * into saved_item;
  end if;

  stock_delta := p_stock - previous_stock;
  if stock_delta > 0 and p_unit_cost > 0 then
    purchase_amount := stock_delta * p_unit_cost;
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
      jsonb_build_object('category', 'Pembelian Stok', 'stock_item_id', saved_item.id, 'quantity', stock_delta)
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

  return query select saved_item.id, saved_item.name, saved_item.category, saved_item.stock,
      saved_item.outlet_stock, saved_item.min_stock, saved_item.unit, saved_item.unit_cost,
      saved_item.price, saved_item.available;
end;
$$;

revoke all on function public.save_stock_item_with_expense(uuid, text, text, numeric, numeric, text, numeric, numeric, boolean, text) from public;
grant execute on function public.save_stock_item_with_expense(uuid, text, text, numeric, numeric, text, numeric, numeric, boolean, text) to anon, authenticated;

commit;