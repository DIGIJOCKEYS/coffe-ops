-- ==============================================================================
-- NESTATION V2: MUTASI OUTLET-KE-GUDANG, DELETE DENGAN ALASAN, & OPTIMASI ATOMIK
-- ==============================================================================

-- 1. Perbarui constraint kind pada tabel stock_takes
alter table public.stock_takes
  drop constraint if exists stock_takes_kind_check;

alter table public.stock_takes
  add constraint stock_takes_kind_check
  check (kind in ('transfer', 'rusak', 'outlet_to_warehouse', 'pemakaian'));

-- 2. Fungsi record_stock_movement (Mendukung Transfer, Rusak, & Outlet ke Gudang)
create or replace function public.record_stock_movement(
  p_item_id         uuid,
  p_qty             numeric,
  p_kind            text,
  p_reason          text default null,
  p_staff_id        text default null,
  p_staff_name      text default null,
  p_photo           text default null,
  p_photo_thumbnail text default null,
  p_notes           text default null
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
  t_cost             numeric := 0;
  loss_amount        numeric := 0;
  audit_action       text;
  expense_desc       text;
begin
  if p_qty is null or p_qty <= 0 then
    raise exception 'Jumlah mutasi harus lebih besar dari 0.';
  end if;

  if p_kind not in ('transfer', 'rusak', 'outlet_to_warehouse', 'pemakaian') then
    raise exception 'Jenis mutasi % tidak dikenal.', p_kind;
  end if;

  select
    stock_items.stock,
    stock_items.outlet_stock,
    stock_items.unit_cost,
    stock_items.name
  into
    warehouse_balance,
    outlet_balance,
    current_unit_cost,
    current_item_name
  from public.stock_items
  where stock_items.id = p_item_id
  for update;

  if not found then
    raise exception 'Item stok tidak ditemukan.';
  end if;

  current_unit_cost := coalesce(current_unit_cost, 0);

  -- ── A. Transfer Gudang → Outlet ──────────────────────────────────────────
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

  -- ── B. Outlet → Gudang (Pengembalian Kelebihan Stok Shift) ────────────────
  elsif p_kind = 'outlet_to_warehouse' then
    if p_qty > outlet_balance then
      raise exception 'Stok outlet % tersisa %, jumlah pengembalian ke gudang %.', current_item_name, outlet_balance, p_qty;
    end if;

    update public.stock_items
    set outlet_stock = outlet_stock - p_qty,
        stock        = stock + p_qty,
        updated_at   = now(),
        updated_by   = p_staff_id
    where stock_items.id = p_item_id;

    audit_action := format('Pengembalian kelebihan stok %s %s dari outlet ke gudang', p_qty, current_item_name);

    insert into public.stock_takes (
      item_id, item_name, qty, kind, unit_cost, transfer_cost,
      reason, staff_name, staff_id, photo, photo_thumbnail, notes
    ) values (
      p_item_id, current_item_name, p_qty, p_kind, current_unit_cost, 0,
      p_reason, p_staff_name, p_staff_id, p_photo, p_photo_thumbnail, p_notes
    ) returning stock_takes.id into movement_id;

  -- ── C. Rusak / Tumpah di Outlet ──────────────────────────────────────────
  else
    if p_qty > outlet_balance then
      raise exception 'Stok outlet % tersisa %, jumlah rusak %.', current_item_name, outlet_balance, p_qty;
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
      expense_desc := format('Kerugian stok: %s rusak/tumpah %s porsi', current_item_name, p_qty);
      insert into public.expenses (date, description, category, amount, created_by)
      values (
        (now() at time zone 'Asia/Jakarta')::date,
        expense_desc,
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
    jsonb_build_object('stock_take_id', movement_id, 'kind', p_kind, 'qty', p_qty, 'notes', p_notes)
  );

  return movement_id;
end;
$$;

revoke all on function public.record_stock_movement(uuid, numeric, text, text, text, text, text, text, text) from public;
grant execute on function public.record_stock_movement(uuid, numeric, text, text, text, text, text, text, text) to anon, authenticated;


-- 3. Fungsi Hapus Mutasi Stok dengan Alasan (Otomatis Restore Stok & Hapus Kerugian)
create or replace function public.delete_stock_take_with_reason(
  p_take_id    uuid,
  p_user_id    text,
  p_user_name  text,
  p_reason     text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  take_rec record;
  target_item record;
  expense_match_desc text;
begin
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'Alasan penghapusan wajib diisi.';
  end if;

  select * into take_rec
  from public.stock_takes
  where stock_takes.id = p_take_id
  for update;

  if not found then
    raise exception 'Data mutasi stok tidak ditemukan.';
  end if;

  if take_rec.item_id is not null then
    select * into target_item
    from public.stock_items
    where stock_items.id = take_rec.item_id
    for update;

    if found then
      -- Jika yang dihapus adalah transfer (gudang -> outlet):
      -- Stok kembali ke gudang, dan outlet dikurangi!
      if take_rec.kind = 'transfer' then
        update public.stock_items
        set stock        = stock + take_rec.qty,
            outlet_stock = greatest(0, outlet_stock - take_rec.qty),
            updated_at   = now(),
            updated_by   = p_user_id
        where id = take_rec.item_id;

      -- Jika yang dihapus adalah pengembalian (outlet -> gudang):
      -- Stok kembali ke outlet, dan gudang dikurangi!
      elsif take_rec.kind = 'outlet_to_warehouse' then
        update public.stock_items
        set outlet_stock = outlet_stock + take_rec.qty,
            stock        = greatest(0, stock - take_rec.qty),
            updated_at   = now(),
            updated_by   = p_user_id
        where id = take_rec.item_id;

      -- Jika yang dihapus adalah rusak/tumpah:
      -- Stok outlet dipulihkan kembali!
      elsif take_rec.kind = 'rusak' or take_rec.kind = 'pemakaian' then
        update public.stock_items
        set outlet_stock = outlet_stock + take_rec.qty,
            updated_at   = now(),
            updated_by   = p_user_id
        where id = take_rec.item_id;

        -- Hapus pembukuan otomatis pengeluaran Kerugian Stok yang bersesuaian jika ada
        expense_match_desc := format('Kerugian stok: %s rusak/tumpah %s porsi', take_rec.item_name, take_rec.qty);
        delete from public.expenses
        where category = 'Kerugian Stok'
          and description = expense_match_desc
          and date = (take_rec.datetime at time zone 'Asia/Jakarta')::date;
      end if;
    end if;
  end if;

  delete from public.stock_takes where id = p_take_id;

  insert into public.audit_entries (user_id, user_name, action, module, details)
  values (
    p_user_id,
    p_user_name,
    format('Menghapus mutasi stok %s %s: %s porsi (Alasan: %s)', take_rec.kind, take_rec.item_name, take_rec.qty, trim(p_reason)),
    'Mutasi Stok',
    jsonb_build_object(
      'stock_take_id', p_take_id,
      'kind', take_rec.kind,
      'item_name', take_rec.item_name,
      'qty', take_rec.qty,
      'reason', trim(p_reason)
    )
  );
end;
$$;

revoke all on function public.delete_stock_take_with_reason(uuid, text, text, text) from public;
grant execute on function public.delete_stock_take_with_reason(uuid, text, text, text) to anon, authenticated;


-- 4. Fungsi Hapus Penjualan Shift dengan Alasan (Otomatis Restore Stok Outlet)
create or replace function public.delete_shift_sale_with_reason(
  p_sale_id    uuid,
  p_user_id    text,
  p_user_name  text,
  p_reason     text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  sale_rec record;
  line_rec record;
begin
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'Alasan penghapusan wajib diisi.';
  end if;

  select * into sale_rec
  from public.shift_sales
  where id = p_sale_id
  for update;

  if not found then
    raise exception 'Penjualan shift tidak ditemukan.';
  end if;

  -- Kembalikan stok outlet untuk setiap baris menu yang terjual
  for line_rec in
    select item_id, qty from public.sales_lines where sale_id = p_sale_id
  loop
    if line_rec.item_id is not null and line_rec.qty > 0 then
      update public.stock_items
      set outlet_stock = outlet_stock + line_rec.qty,
          updated_at   = now(),
          updated_by   = p_user_id
      where id = line_rec.item_id;
    end if;
  end loop;

  delete from public.sales_lines where sale_id = p_sale_id;
  delete from public.shift_sales where id = p_sale_id;

  insert into public.audit_entries (user_id, user_name, action, module, details)
  values (
    p_user_id,
    p_user_name,
    format('Menghapus penjualan shift %s tanggal %s total Rp%s (Alasan: %s)', sale_rec.shift, sale_rec.date, sale_rec.total, trim(p_reason)),
    'Penjualan',
    jsonb_build_object(
      'sale_id', p_sale_id,
      'shift', sale_rec.shift,
      'date', sale_rec.date,
      'total', sale_rec.total,
      'reason', trim(p_reason)
    )
  );
end;
$$;

revoke all on function public.delete_shift_sale_with_reason(uuid, text, text, text) from public;
grant execute on function public.delete_shift_sale_with_reason(uuid, text, text, text) to anon, authenticated;


-- 5. Fungsi Hapus Pengeluaran dengan Alasan
create or replace function public.delete_expense_with_reason(
  p_expense_id uuid,
  p_user_id    text,
  p_user_name  text,
  p_reason     text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  exp_rec record;
begin
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'Alasan penghapusan wajib diisi.';
  end if;

  select * into exp_rec
  from public.expenses
  where id = p_expense_id
  for update;

  if not found then
    raise exception 'Pengeluaran tidak ditemukan.';
  end if;

  delete from public.expenses where id = p_expense_id;

  insert into public.audit_entries (user_id, user_name, action, module, details)
  values (
    p_user_id,
    p_user_name,
    format('Menghapus pengeluaran "%s" Rp%s (Alasan: %s)', exp_rec.description, exp_rec.amount, trim(p_reason)),
    'Pengeluaran',
    jsonb_build_object(
      'expense_id', p_expense_id,
      'description', exp_rec.description,
      'amount', exp_rec.amount,
      'category', exp_rec.category,
      'reason', trim(p_reason)
    )
  );
end;
$$;

revoke all on function public.delete_expense_with_reason(uuid, text, text, text) from public;
grant execute on function public.delete_expense_with_reason(uuid, text, text, text) to anon, authenticated;


-- 6. Fungsi Hapus Item Stok dengan Alasan
create or replace function public.delete_stock_item_with_reason(
  p_item_id    uuid,
  p_user_id    text,
  p_user_name  text,
  p_reason     text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  item_rec record;
begin
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'Alasan penghapusan wajib diisi.';
  end if;

  select * into item_rec
  from public.stock_items
  where id = p_item_id
  for update;

  if not found then
    raise exception 'Item stok tidak ditemukan.';
  end if;

  delete from public.stock_items where id = p_item_id;

  insert into public.audit_entries (user_id, user_name, action, module, details)
  values (
    p_user_id,
    p_user_name,
    format('Menghapus item stok "%s" (Alasan: %s)', item_rec.name, trim(p_reason)),
    'Stok & Menu',
    jsonb_build_object(
      'item_id', p_item_id,
      'name', item_rec.name,
      'category', item_rec.category,
      'reason', trim(p_reason)
    )
  );
end;
$$;

revoke all on function public.delete_stock_item_with_reason(uuid, text, text, text) from public;
grant execute on function public.delete_stock_item_with_reason(uuid, text, text, text) to anon, authenticated;

