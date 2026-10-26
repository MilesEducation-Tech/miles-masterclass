-- =============================================================================
-- seo_pages: row-level security of its own
-- =============================================================================
-- RLS on `seo_pages` used to be enabled by `20260428000000_admin_rbac.sql`, with
-- writes gated on `has_admin_permission()`. The admin panel and its migrations
-- were removed on 2026-10-23 (MIL-120 / MIL-121), so without this file a
-- database built from the repo would leave `seo_pages` writable by anyone
-- holding the public anon key.
--
-- After this migration:
--   - everyone may read (the app reads rows anonymously, on the server and in
--     the browser);
--   - nobody may write through the API: there is no insert/update/delete
--     policy, so only the service role (the Supabase dashboard) edits rows;
--   - nothing on the table depends on the admin schema, so the admin tables,
--     functions and audit log can be dropped later without breaking SEO.
--
-- Idempotent and safe on the live project, where the admin policies and the
-- audit trigger still exist.
-- =============================================================================

alter table public.seo_pages enable row level security;

drop policy if exists seo_public_read on public.seo_pages;
create policy seo_public_read on public.seo_pages for select using (true);

drop policy if exists seo_admin_write on public.seo_pages;
drop policy if exists seo_admin_update on public.seo_pages;
drop policy if exists seo_admin_delete on public.seo_pages;

drop trigger if exists seo_pages_audit on public.seo_pages;
