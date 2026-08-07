-- =============================================================================
-- Bootstrap super_admin
-- =============================================================================
-- Run this AFTER:
--   1. Creating the auth user in Supabase Dashboard:
--      Authentication -> Users -> "Add user" -> Email + password
--      (Use a real admin email + a strong password >= 12 chars)
--   2. Copy that user's UUID from the dashboard.
--   3. Replace BOTH placeholders below with that UUID and the email, then run.
-- =============================================================================

-- ⚠️  REPLACE THESE BEFORE RUNNING ⚠️
-- :super_admin_user_id  = uuid copied from auth.users
-- :super_admin_email    = the email you signed up with
-- :super_admin_name     = display name

-- Example (uncomment + edit):
do $$
declare
  v_user_id   uuid := 'a1ecdc0d-3056-4219-a62b-169b09b4bf1f'::uuid;  -- <-- replace
  v_email     text := 'sachin.singh@mileseducation.com';                            -- <-- replace
  v_full_name text := 'Super Admin';                                  -- <-- replace
begin
  -- Insert into admin_users
  insert into public.admin_users (user_id, email, full_name, is_active)
  values (v_user_id, v_email, v_full_name, true)
  on conflict (user_id) do update
    set email = excluded.email,
        full_name = excluded.full_name,
        is_active = true;

  -- Assign super_admin role
  insert into public.admin_user_roles (user_id, role_id)
  select v_user_id, r.id
    from public.admin_roles r
   where r.slug = 'super_admin'
  on conflict (user_id) do update
    set role_id = excluded.role_id;
end $$;

-- =============================================================================
-- Verification queries (after running the block above)
-- =============================================================================
-- 1. Confirm the row exists:
--    select * from public.admin_users where email = 'sachin.singh@mileseducation.com';
--
-- 2. Confirm the role link:
   select au.email, ar.slug
     from public.admin_users au
     join public.admin_user_roles ur on ur.user_id = au.user_id
     join public.admin_roles ar on ar.id = ur.role_id
    where au.email = 'sachin.singh@mileseducation.com';
--
-- 3. Confirm the user has all permissions (run while signed in as that user
--    via the SQL editor's "Run as authenticated user" option):
--    select * from public.get_my_admin_profile();
