-- =============================================================================
-- User Onboarding permission
-- =============================================================================
-- Gate for the /admin/user-onboarding section (create/edit learner users +
-- record offline payments via the Django internal APIs). The TS `PERM` constant
-- (admin-rbac.model.ts) and this catalog row must stay in sync.
--
-- Deliberately NOT assigned to any role here: assigning would silently widen a
-- role's access. Grant it to the intended role(s) through the Roles & Permissions
-- admin UI, or add an explicit `admin_role_permissions` insert in a follow-up
-- migration. `super_admin` already reaches it via its catch-all short-circuit.
insert into public.admin_permissions (key, category, label, description) values
  ('users:create', 'users', 'Create Users', 'Onboard/edit learner users and record offline invoice payments')
on conflict (key) do nothing;
