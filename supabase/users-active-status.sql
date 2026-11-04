-- Non-destructive migration for admin-managed user access status.
-- Existing profiles remain active by default.

begin;

alter table public.profiles
  add column if not exists is_active boolean not null default true;

create or replace function public.set_profile_active(
  p_actor_id text,
  p_target_id text,
  p_is_active boolean
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor_role text;
  actor_active boolean;
  actor_name text;
  target_role text;
  target_active boolean;
  target_name text;
  active_admin_count integer;
begin
  select role, is_active, name
    into actor_role, actor_active, actor_name
  from public.profiles
  where id = p_actor_id;

  if actor_role is distinct from 'admin' or actor_active is distinct from true then
    raise exception 'Hanya Admin aktif yang dapat mengubah status pengguna.';
  end if;

  select role, is_active, name
    into target_role, target_active, target_name
  from public.profiles
  where id = p_target_id
  for update;

  if not found then
    raise exception 'Pengguna tidak ditemukan.';
  end if;

  if p_actor_id = p_target_id and p_is_active = false then
    raise exception 'Admin tidak dapat menonaktifkan akunnya sendiri.';
  end if;

  if target_role = 'admin' and target_active and not p_is_active then
    perform pg_advisory_xact_lock(hashtext('nestation-active-admin-status'));
    select count(*) into active_admin_count
    from public.profiles
    where role = 'admin' and is_active = true;

    if active_admin_count <= 1 then
      raise exception 'Admin aktif terakhir tidak dapat dinonaktifkan.';
    end if;
  end if;

  if target_active = p_is_active then
    return false;
  end if;

  update public.profiles
  set is_active = p_is_active,
      updated_at = now()
  where id = p_target_id;

  insert into public.audit_entries (user_id, user_name, action, module, details)
  values (
    p_actor_id,
    coalesce(actor_name, p_actor_id),
    format('%s akun %s', case when p_is_active then 'Mengaktifkan' else 'Menonaktifkan' end, coalesce(target_name, p_target_id)),
    'Pengguna',
    jsonb_build_object('target_user_id', p_target_id, 'is_active', p_is_active)
  );

  return true;
end;
$$;

revoke all on function public.set_profile_active(text, text, boolean) from public;
grant execute on function public.set_profile_active(text, text, boolean) to anon, authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'profiles'
     ) then
    execute 'alter publication supabase_realtime add table public.profiles';
  end if;
end;
$$;

commit;