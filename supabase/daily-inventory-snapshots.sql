-- Non-destructive migration for historical daily warehouse/outlet balances.
-- Historical inventory is available from the migration date forward.

begin;

create table if not exists public.daily_inventory_snapshots (
  item_id uuid not null references public.stock_items (id) on delete cascade,
  snapshot_date date not null,
  warehouse_stock numeric not null default 0 check (warehouse_stock >= 0),
  outlet_stock numeric not null default 0 check (outlet_stock >= 0),
  updated_at timestamptz not null default now(),
  primary key (item_id, snapshot_date)
);

alter table public.daily_inventory_snapshots enable row level security;

insert into public.daily_inventory_snapshots (
  item_id, snapshot_date, warehouse_stock, outlet_stock, updated_at
)
select id, (now() at time zone 'Asia/Jakarta')::date, stock, outlet_stock, now()
from public.stock_items
on conflict (item_id, snapshot_date) do update
set warehouse_stock = excluded.warehouse_stock,
    outlet_stock = excluded.outlet_stock,
    updated_at = excluded.updated_at;

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

drop trigger if exists stock_items_capture_daily_snapshot on public.stock_items;
create trigger stock_items_capture_daily_snapshot
after insert or update of stock, outlet_stock on public.stock_items
for each row execute function public.capture_daily_inventory_snapshot();

create or replace function public.get_inventory_snapshot(p_date date)
returns table (
  item_id uuid,
  warehouse_stock numeric,
  outlet_stock numeric,
  snapshot_date date
)
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

revoke all on function public.get_inventory_snapshot(date) from public;
grant execute on function public.get_inventory_snapshot(date) to anon, authenticated;
revoke all on function public.capture_daily_inventory_snapshot() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'daily_inventory_snapshots'
     ) then
    execute 'alter publication supabase_realtime add table public.daily_inventory_snapshots';
  end if;
end;
$$;

commit;