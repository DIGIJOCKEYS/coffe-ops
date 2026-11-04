-- Non-destructive performance migration for the expenses page.
-- Run once in Supabase SQL Editor. Existing expense rows are preserved.

begin;

alter table public.expenses
  add column if not exists photo text;

alter table public.expenses
  add column if not exists photo_thumbnail text;

alter table public.expenses
  add column if not exists has_photo boolean generated always as (photo is not null) stored;

create table if not exists public.expense_totals (
  user_key text primary key,
  total_count bigint not null default 0 check (total_count >= 0),
  total_amount numeric not null default 0 check (total_amount >= 0),
  updated_at timestamptz not null default now()
);

alter table public.expense_totals enable row level security;

create index if not exists idx_expenses_page_admin
  on public.expenses (date desc, created_at desc, id desc);
create index if not exists idx_expenses_page_staff
  on public.expenses (created_by, date desc, created_at desc, id desc);
create index if not exists idx_expenses_staff_operational
  on public.expenses (created_by, category, date desc, created_at desc, id desc);

drop trigger if exists expenses_sync_totals on public.expenses;
truncate table public.expense_totals;

insert into public.expense_totals (user_key, total_count, total_amount)
select coalesce(created_by, '__unattributed__'), count(*), coalesce(sum(amount), 0)
from public.expenses
group by coalesce(created_by, '__unattributed__');

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

drop function if exists public.get_expense_summary(text, text);

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

commit;