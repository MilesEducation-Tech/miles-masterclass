-- =============================================================================
-- Normalize admin_user_email_domains — surrogate id primary key
-- =============================================================================
-- The table linked admin users to partner domains with a composite primary key
-- (user_id, domain). This swaps that for a surrogate `id` PK while KEEPING the
-- many-to-many shape: an admin can still have many domains, and a domain can
-- still be assigned to several admins. The (user_id, domain) pair stays unique
-- (a domain is listed at most once per admin).
--
-- Purely structural — no behavior change. The get_my_admin_profile() RPC and
-- the admin-onboarding SQL both address rows by user_id / (user_id, domain), so
-- nothing downstream needs updating. Additive & safe on empty data.
-- =============================================================================

-- 1. Surrogate id (backfills any existing rows via the default).
alter table public.admin_user_email_domains
  add column if not exists id uuid not null default gen_random_uuid();

-- 2. Swap the primary key: composite (user_id, domain) -> id.
alter table public.admin_user_email_domains
  drop constraint if exists admin_user_email_domains_pkey;

alter table public.admin_user_email_domains
  add constraint admin_user_email_domains_pkey primary key (id);

-- 3. Preserve pair-uniqueness so a domain can't be listed twice for one admin
--    (also keeps the `on conflict do nothing` in the onboarding SQL working).
create unique index if not exists admin_user_email_domains_user_domain_uniq
  on public.admin_user_email_domains (user_id, domain);

-- 4. Index the FK side for fast "domains for this user" lookups (the RPC path).
create index if not exists admin_user_email_domains_user_id_idx
  on public.admin_user_email_domains (user_id);

-- RLS policies and the user_id FK (on delete cascade) are unchanged.
