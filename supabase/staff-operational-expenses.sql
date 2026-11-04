-- Non-destructive migration: Staff may only create Operational expenses.

begin;

create or replace function public.enforce_staff_operational_expense()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  creator_role text;
begin
  select role into creator_role
  from public.profiles
  where id = new.created_by;

  if creator_role = 'staff' and new.category not in ('Operasional', 'Kerugian Stok') then
    raise exception 'Staff hanya dapat mencatat kategori Operasional.';
  end if;

  return new;
end;
$$;

drop trigger if exists expenses_staff_category_guard on public.expenses;
create trigger expenses_staff_category_guard
before insert or update of category, created_by on public.expenses
for each row execute function public.enforce_staff_operational_expense();

revoke all on function public.enforce_staff_operational_expense() from public, anon, authenticated;

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

commit;