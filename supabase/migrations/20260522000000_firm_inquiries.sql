-- =============================================================================
-- firm_inquiries — public lead-capture table for the enquiry form
-- =============================================================================
-- Mirrors the EnquiryPayload shape in
-- src/app/shared/core/services/enquiry/enquiry.ts. The enquiry form on the
-- marketing site posts here as the `anon` role, so we need a public INSERT
-- policy. Reads/updates/deletes are gated by the existing `leads:*` permissions
-- seeded in 20260428000000_admin_rbac.sql.
-- =============================================================================

create table if not exists public.firm_inquiries (
  id            uuid primary key default gen_random_uuid(),

  full_name     text not null,
  email         text not null,
  firm_name     text not null,
  -- `help_type` is jsonb (not text[]) to match the existing live schema and
  -- because the Supabase JS client serializes JS arrays directly to JSON. A
  -- jsonb column accepts `["demo", "pricing"]` from the client transparently.
  help_type     jsonb not null default '[]'::jsonb,
  enquiry_type  text not null default 'General Enquiry',
  keep_updated  boolean not null default false,
  status        text not null default 'new',

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists firm_inquiries_email_idx        on public.firm_inquiries (email);
create index if not exists firm_inquiries_status_idx       on public.firm_inquiries (status);
create index if not exists firm_inquiries_enquiry_type_idx on public.firm_inquiries (enquiry_type);
create index if not exists firm_inquiries_created_at_idx   on public.firm_inquiries (created_at desc);

-- =============================================================================
-- Table-level GRANTs
-- =============================================================================
-- Critical: Supabase's default-privileges setup (ALTER DEFAULT PRIVILEGES) only
-- attaches GRANTs to tables created by the `postgres` role. Tables created via
-- the dashboard's Table Editor, or by extensions/migrations that switch role,
-- can land WITHOUT INSERT/SELECT/etc. grants for `anon`/`authenticated` — in
-- which case PostgREST returns the same 42501 ("row violates RLS policy") even
-- when the policy is `WITH CHECK (true)`. Granting explicitly here makes the
-- migration role-agnostic and idempotent.
grant insert on public.firm_inquiries to anon, authenticated;
grant select, update, delete on public.firm_inquiries to authenticated;
grant usage on schema public to anon, authenticated;

-- =============================================================================
-- RLS
-- =============================================================================
alter table public.firm_inquiries enable row level security;

-- Drop every existing policy on the table, regardless of name. This guarantees
-- a clean slate when re-running against an environment where someone created
-- policies via the dashboard with ad-hoc names ("Allow anonymous inserts",
-- "anon can insert firm inquiries", etc.) whose WITH CHECK / USING expressions
-- may have drifted. Without this, leftover RESTRICTIVE policies or policies
-- with a failing WITH CHECK would still block legitimate inserts.
do $$
declare pol record;
begin
  for pol in
    select polname from pg_policy where polrelid = 'public.firm_inquiries'::regclass
  loop
    execute format('drop policy %I on public.firm_inquiries', pol.polname);
  end loop;
end $$;

-- Public INSERT: the marketing site submits via the anon key. We intentionally
-- allow any anon/authenticated client to insert a row — this is a public
-- contact form. `with check (true)` lets PostgREST accept the row regardless of
-- who's signed in.
create policy firm_inquiries_public_insert on public.firm_inquiries
  for insert
  to anon, authenticated
  with check (true);

-- Admin read: leads:read permission required.
create policy firm_inquiries_admin_read on public.firm_inquiries
  for select using (public.has_admin_permission('leads:read'));

-- Admin update: leads:write permission required.
create policy firm_inquiries_admin_update on public.firm_inquiries
  for update using (public.has_admin_permission('leads:write'))
  with check (public.has_admin_permission('leads:write'));

-- Admin delete: leads:write permission required.
create policy firm_inquiries_admin_delete on public.firm_inquiries
  for delete using (public.has_admin_permission('leads:write'));
