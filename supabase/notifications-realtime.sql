-- Non-destructive migration: per-user notification read state and realtime tables.
-- Run once in Supabase SQL Editor. Existing audit entries are preserved.

begin;

create table if not exists public.audit_entry_reads (
  audit_entry_id uuid not null references public.audit_entries (id) on delete cascade,
  user_id text not null references public.profiles (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (audit_entry_id, user_id)
);

alter table public.audit_entry_reads enable row level security;
create index if not exists idx_audit_entry_reads_user on public.audit_entry_reads (user_id, read_at desc);
drop policy if exists "audit_entry_reads_testing_select" on public.audit_entry_reads;
create policy "audit_entry_reads_testing_select" on public.audit_entry_reads
  for select to anon, authenticated using (true);

create or replace function public.get_notifications(p_user_id text, p_limit integer default 10)
returns table (
  id uuid,
  user_name text,
  action text,
  module text,
  created_at timestamptz,
  is_read boolean
)
language sql
stable
security definer
set search_path = pg_catalog, public
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
returns bigint
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select count(*)::bigint
  from public.audit_entries as a
  where not exists (
    select 1
    from public.audit_entry_reads as r
    where r.audit_entry_id = a.id and r.user_id = p_user_id
  )
    and (
      (select p.role from public.profiles as p where p.id = p_user_id) = 'admin'
      or a.user_id = p_user_id
    );
$$;

create or replace function public.mark_notification_read(p_user_id text, p_audit_entry_id uuid)
returns void
language sql
security definer
set search_path = pg_catalog, public
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
returns void
language sql
security definer
set search_path = pg_catalog, public
as $$
  insert into public.audit_entry_reads (audit_entry_id, user_id)
  select a.id, p_user_id
  from public.audit_entries as a
    where (select p.role from public.profiles as p where p.id = p_user_id) = 'admin'
      or a.user_id = p_user_id
  on conflict (audit_entry_id, user_id) do nothing;
$$;

revoke all on function public.get_notifications(text, integer) from public;
revoke all on function public.get_unread_notification_count(text) from public;
revoke all on function public.mark_notification_read(text, uuid) from public;
revoke all on function public.mark_all_notifications_read(text) from public;
grant execute on function public.get_notifications(text, integer) to anon, authenticated;
grant execute on function public.get_unread_notification_count(text) to anon, authenticated;
grant execute on function public.mark_notification_read(text, uuid) to anon, authenticated;
grant execute on function public.mark_all_notifications_read(text) to anon, authenticated;

do $$
declare
  table_name text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach table_name in array array[
      'stock_items', 'shift_sales', 'sales_lines', 'expenses',
      'stock_takes', 'audit_entries', 'audit_entry_reads'
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