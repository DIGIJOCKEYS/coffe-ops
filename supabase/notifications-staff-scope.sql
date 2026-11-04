-- Non-destructive migration: staff see only their own audit notifications;
-- admins continue to see all audit notifications.

begin;

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

commit;