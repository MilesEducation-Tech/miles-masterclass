-- =============================================================================
-- 1. Prune the role catalog to three roles + 2. delete_admin_user() RPC
-- =============================================================================
-- Kept roles: super_admin (system), partner_network_admin (Tracker + Vendor
-- Users), partner_subcompany_admin (Vendor Users only). Everything else is
-- removed: seo_manager, leads_manager, reports_viewer, partner_users_manager,
-- partner_platform_admin (Miles ops just uses super_admin).
--
-- admin_user_roles.role_id is ON DELETE RESTRICT, so assignments go first.
-- Any admin holding a removed role keeps their login but loses all role-derived
-- permissions (they land on /admin/forbidden) — re-provision them with a kept
-- role, or delete them with the new RPC below.
-- =============================================================================

delete from public.admin_user_roles
where role_id in (
  select id from public.admin_roles
  where slug in ('seo_manager', 'leads_manager', 'reports_viewer',
                 'partner_users_manager', 'partner_platform_admin')
);

-- admin_role_permissions rows cascade with the role.
delete from public.admin_roles
where slug in ('seo_manager', 'leads_manager', 'reports_viewer',
               'partner_users_manager', 'partner_platform_admin');

-- =============================================================================
-- delete_admin_user() — permanently remove an admin login from the app
-- =============================================================================
-- SECURITY DEFINER for the same reason as provision_admin_user: deleting from
-- auth.users needs elevated privileges. Deleting the auth row cascades to
-- admin_users -> admin_user_roles / admin_user_permissions /
-- admin_user_email_domains, and to auth.identities (GoTrue FK).
--
-- Guards: caller needs admin:users:manage; no self-delete; the target must be
-- an admin_users row (never an arbitrary auth user — students live in
-- auth.users too).
-- =============================================================================

create or replace function public.delete_admin_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_admin_permission('admin:users:manage') then
    raise exception 'not authorized to delete an admin user';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'you cannot delete your own account';
  end if;

  if not exists (select 1 from admin_users where user_id = p_user_id) then
    raise exception 'not an admin user';
  end if;

  delete from auth.users where id = p_user_id;
end;
$$;

grant execute on function public.delete_admin_user(uuid) to authenticated;
