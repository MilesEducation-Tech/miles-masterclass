-- Custom Access Token hook — embeds admin claims into every Supabase JWT
--
-- Adds `app_metadata.admin_role` (role slug) and `app_metadata.email_domains`
-- (partner domains from admin_user_email_domains) to access tokens at
-- issue/refresh time, so the Django backend can authorize admin API calls and
-- derive domain scope from the *verified* token instead of trusting the
-- client-supplied X-Email-Domain header.
--
-- See: miles-masterclass-backend/docs/ADR_Supabase_JWT_Admin_API_Auth.md
--
-- ENABLING (migration alone is not enough):
--   Hosted: Dashboard → Authentication → Hooks → Custom Access Token
--           → Postgres function → public.custom_access_token_hook
--   Local:  supabase/config.toml →
--           [auth.hook.custom_access_token]
--           enabled = true
--           uri = "pg-functions://postgres/public/custom_access_token_hook"
--
-- Notes:
--   * Non-admin users (no active admin_users row) get NO extra claims — their
--     tokens are unchanged, and the backend's IsSupabaseAdmin rejects them.
--   * Claims refresh only when the access token does (~1h default). Revoking a
--     role or changing domains needs a forced sign-out to apply immediately.
--   * Fine-grained permission keys intentionally stay OUT of the token (size);
--     the frontend keeps using get_my_admin_profile() for those.

-- 1. Hook function -------------------------------------------------------------
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  claims    jsonb := event->'claims';
  uid       uuid  := (event->>'user_id')::uuid;
  v_role    text;
  v_domains jsonb;
begin
  -- Active admin? Mirror the single-role-per-user model of get_my_admin_profile.
  select r.slug
    into v_role
    from admin_users u
    join admin_user_roles ur on ur.user_id = u.user_id
    join admin_roles r on r.id = ur.role_id
   where u.user_id = uid
     and u.is_active
   limit 1;

  if v_role is null then
    return event;  -- not an admin: token unchanged
  end if;

  select coalesce(jsonb_agg(distinct d.domain), '[]'::jsonb)
    into v_domains
    from admin_user_email_domains d
   where d.user_id = uid;

  -- Ensure app_metadata exists before setting nested keys (jsonb_set is a
  -- silent no-op when the parent path is missing).
  claims := jsonb_set(claims, '{app_metadata}', coalesce(claims->'app_metadata', '{}'::jsonb));
  claims := jsonb_set(claims, '{app_metadata,admin_role}', to_jsonb(v_role));
  claims := jsonb_set(claims, '{app_metadata,email_domains}', v_domains);

  return jsonb_set(event, '{claims}', claims);
end;
$$;

-- 2. Access control ------------------------------------------------------------
-- The hook is executed by the supabase_auth_admin role; nobody else may call it.
grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;

-- supabase_auth_admin must be able to read the RBAC tables (RLS applies to it).
grant select on public.admin_users, public.admin_user_roles,
                public.admin_roles, public.admin_user_email_domains
  to supabase_auth_admin;

drop policy if exists admin_users_auth_hook_read on public.admin_users;
create policy admin_users_auth_hook_read on public.admin_users
  for select to supabase_auth_admin using (true);

drop policy if exists admin_user_roles_auth_hook_read on public.admin_user_roles;
create policy admin_user_roles_auth_hook_read on public.admin_user_roles
  for select to supabase_auth_admin using (true);

drop policy if exists admin_roles_auth_hook_read on public.admin_roles;
create policy admin_roles_auth_hook_read on public.admin_roles
  for select to supabase_auth_admin using (true);

drop policy if exists admin_user_email_domains_auth_hook_read on public.admin_user_email_domains;
create policy admin_user_email_domains_auth_hook_read on public.admin_user_email_domains
  for select to supabase_auth_admin using (true);
