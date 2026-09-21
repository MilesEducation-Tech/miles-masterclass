-- =============================================================================
-- admin_audit_log — who did what in the admin panel
-- =============================================================================
-- The admin panel had no audit trail: the only record of a deleted account, a
-- rewritten role or a granted subscription was a toast that disappeared.
--
-- Two tiers, and every row says which one it came from, because they are not
-- equally trustworthy:
--
--   source='trigger'  Written by the triggers below, on the committed write.
--                     Cannot be bypassed by the browser, and also catches
--                     changes made straight from the Supabase dashboard.
--                     This is the tier that stands up in a security review.
--
--   source='client'   Written by the Angular app through log_admin_activity()
--                     for things Postgres cannot see: Django API calls, page
--                     views, auth events, CSV exports. The actor, timestamp and
--                     source are stamped HERE from auth.uid(), so identity
--                     cannot be forged; the action description is client-
--                     asserted and an admin with devtools could withhold it.
--
-- The Django half stays best-effort until the backend logs server-side in the
-- partners/* app. Do not present source='client' rows as proof of anything.
--
-- Retention: NONE. Rows are kept indefinitely by decision of the repo owner.
-- If that ever hurts, the upgrade path is declarative monthly partitioning on
-- occurred_at, which also makes archiving a partition-drop.
-- ponytail: no partitioning now — ~15 active admins is ~1M rows/year, which
-- these indexes handle comfortably on a 13 MB database.
--
-- This is the FIRST trigger in this schema. Matching house style: security
-- definer, set search_path = public, explicit grants, and safe to paste twice
-- (migrations here are applied by hand in the SQL Editor).
-- =============================================================================

-- 1. The log ------------------------------------------------------------------
create table if not exists public.admin_audit_log (
  id           bigint generated always as identity primary key,
  occurred_at  timestamptz not null default now(),

  -- Actor. NULLABLE on purpose: dashboard, service-role and migration writes
  -- have no auth.uid(), and a NULL actor is itself worth recording. actor_email
  -- and actor_roles are denormalised snapshots — admin_users cascades away when
  -- the auth.users row is deleted, and a log that loses its actor is useless.
  -- Deliberately NO foreign key to admin_users for the same reason.
  actor_id     uuid,
  actor_email  text,
  actor_roles  text[],

  source       text not null check (source in ('trigger', 'client')),
  category     text not null check (category in ('mutation', 'auth', 'navigation', 'export', 'api')),
  action       text not null,

  entity_type  text,
  entity_id    text,

  -- For updates: {column: {old, new}} of ONLY the columns that changed.
  -- For insert/delete: the row. For client rows: whatever payload was sent.
  changed      jsonb,
  -- Request shape: url, http status, outcome, etc.
  context      jsonb
);

create index if not exists admin_audit_log_occurred_at_idx on public.admin_audit_log (occurred_at desc);
create index if not exists admin_audit_log_actor_idx       on public.admin_audit_log (actor_id, occurred_at desc);
create index if not exists admin_audit_log_entity_idx      on public.admin_audit_log (entity_type, entity_id);
create index if not exists admin_audit_log_category_idx    on public.admin_audit_log (category, occurred_at desc);

-- 2. Grants -------------------------------------------------------------------
-- Supabase's default privileges hand ALL on new public tables to anon and
-- authenticated, so the REVOKE is doing the real work here — without it the
-- grant layer stays wide open even though RLS denies. Read-only for admins;
-- writes arrive only through the definer trigger/RPC below, which run as the
-- table owner and bypass both layers.
revoke all on public.admin_audit_log from anon, authenticated;
grant select on public.admin_audit_log to authenticated;

-- 3. RLS ----------------------------------------------------------------------
alter table public.admin_audit_log enable row level security;

-- SELECT is the ONLY policy, deliberately. With RLS on and no insert/update/
-- delete policy, nobody can alter or erase a row through PostgREST — not even a
-- super admin. That immutability is what makes this an audit log rather than a
-- table. Purging, if it is ever needed, is a service-role job outside the app.
drop policy if exists admin_audit_log_read on public.admin_audit_log;
create policy admin_audit_log_read on public.admin_audit_log
  for select using (public.has_admin_permission('audit:read'));

-- 4. Permission ---------------------------------------------------------------
-- get_my_admin_profile() builds the client's permission list by scanning this
-- catalog, so seeding the key is all it takes to reach the browser. super_admin
-- short-circuits has_admin_permission() and needs no explicit grant.
insert into public.admin_permissions (key, category, label, description) values
  ('audit:read', 'Audit', 'View audit log', 'Read the admin activity and audit trail')
on conflict (key) do nothing;

-- 5. Client write path --------------------------------------------------------
-- The browser never inserts into admin_audit_log directly; it calls this. The
-- fields a client must not control are stamped server-side. Mirrors the
-- fire-and-forget shape of touch_admin_login().
create or replace function public.log_admin_activity(
  p_category    text,
  p_action      text,
  p_entity_type text default null,
  p_entity_id   text default null,
  p_changed     jsonb default null,
  p_context     jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
begin
  -- No session, no row. Keeps unauthenticated noise out of the log entirely.
  if v_actor is null then
    return;
  end if;

  insert into public.admin_audit_log (
    actor_id, actor_email, actor_roles,
    source, category, action, entity_type, entity_id, changed, context
  ) values (
    v_actor,
    coalesce(
      (select u.email from public.admin_users u where u.user_id = v_actor),
      auth.jwt() ->> 'email'
    ),
    array(
      select r.slug
        from public.admin_user_roles ur
        join public.admin_roles r on r.id = ur.role_id
       where ur.user_id = v_actor
       order by r.slug
    ),
    'client',
    p_category,
    p_action,
    p_entity_type,
    p_entity_id,
    p_changed,
    p_context
  );
end;
$$;

grant execute on function public.log_admin_activity(text, text, text, text, jsonb, jsonb) to authenticated;

-- 6. Trigger function ---------------------------------------------------------
-- One generic function for every audited table.
--   TG_ARGV[0]  comma-separated column(s) forming the human-readable entity key
--   TG_ARGV[1]  comma-separated columns to ignore (optional)
--
-- auth.uid() is correct inside a SECURITY DEFINER trigger: definer swaps the
-- executing role, not the request-scoped JWT claims, so the acting admin is
-- still attributed — including for writes made inside provision_admin_user()
-- and the other definer RPCs.
--
-- Roles are read from the tables rather than the JWT's app_metadata.admin_roles,
-- because the custom access token hook needs a dashboard toggle that this repo
-- cannot verify is on.
--
-- FAIL-CLOSED: any error in here aborts the admin's write. That is the right
-- default for an audit trail — a write that cannot be recorded should not
-- happen — but it does mean a bug here breaks the admin panel, which is why
-- this is validated on a Supabase branch before production.
create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_keys    text[] := string_to_array(coalesce(nullif(TG_ARGV[0], ''), 'id'), ',');
  v_exclude text[] := case
                        when coalesce(TG_ARGV[1], '') = '' then '{}'::text[]
                        else string_to_array(TG_ARGV[1], ',')
                      end;
  v_old     jsonb  := case when TG_OP = 'INSERT' then null else to_jsonb(OLD) end;
  v_new     jsonb  := case when TG_OP = 'DELETE' then null else to_jsonb(NEW) end;
  v_row     jsonb  := coalesce(v_new, v_old);
  v_actor   uuid   := auth.uid();
  v_entity  text;
  v_changed jsonb;
begin
  -- Readable entity key; composite keys join with ':'.
  select string_agg(coalesce(v_row ->> k.col, ''), ':' order by k.ord)
    into v_entity
    from unnest(v_keys) with ordinality as k(col, ord);

  if TG_OP = 'UPDATE' then
    -- Only the columns that actually changed. Keeps rows small and limits how
    -- much personal data this table holds forever.
    select jsonb_object_agg(t.k, jsonb_build_object('old', v_old -> t.k, 'new', v_new -> t.k))
      into v_changed
      from jsonb_object_keys(v_new) as t(k)
     where not (t.k = any(v_exclude))
       and (v_old -> t.k) is distinct from (v_new -> t.k);

    -- Nothing changed but ignored columns (e.g. last_login_at on every sign-in)
    -- — don't write a row that says nothing.
    if v_changed is null then
      return null;
    end if;
  else
    select jsonb_object_agg(t.key, t.value)
      into v_changed
      from jsonb_each(v_row) as t(key, value)
     where not (t.key = any(v_exclude));
  end if;

  -- Size guard: one oversized payload (a big json_ld blob, a bulk SEO import)
  -- should not bloat a table with no retention limit.
  if length(v_changed::text) > 8000 then
    v_changed := jsonb_build_object(
      '_truncated', true,
      '_columns', (select jsonb_agg(t.k order by t.k) from jsonb_object_keys(v_changed) as t(k))
    );
  end if;

  insert into public.admin_audit_log (
    actor_id, actor_email, actor_roles,
    source, category, action, entity_type, entity_id, changed, context
  ) values (
    v_actor,
    coalesce(
      (select u.email from public.admin_users u where u.user_id = v_actor),
      auth.jwt() ->> 'email'
    ),
    array(
      select r.slug
        from public.admin_user_roles ur
        join public.admin_roles r on r.id = ur.role_id
       where ur.user_id = v_actor
       order by r.slug
    ),
    'trigger',
    'mutation',
    lower(TG_OP),
    TG_TABLE_NAME,
    v_entity,
    v_changed,
    jsonb_build_object('schema', TG_TABLE_SCHEMA)
  );

  return null;  -- AFTER trigger: return value is ignored
end;
$$;

-- Nothing calls this directly — no grant to authenticated, on purpose.
revoke all on function public.audit_row_change() from anon, authenticated, public;

-- 7. Triggers -----------------------------------------------------------------
-- Entity keys are chosen for readability in the viewer (slug/key/domain rather
-- than an opaque uuid) wherever the table has a unique natural key.

drop trigger if exists admin_users_audit on public.admin_users;
create trigger admin_users_audit
  after insert or update or delete on public.admin_users
  for each row execute function public.audit_row_change('user_id', 'last_login_at');

drop trigger if exists admin_roles_audit on public.admin_roles;
create trigger admin_roles_audit
  after insert or update or delete on public.admin_roles
  for each row execute function public.audit_row_change('slug');

drop trigger if exists admin_permissions_audit on public.admin_permissions;
create trigger admin_permissions_audit
  after insert or update or delete on public.admin_permissions
  for each row execute function public.audit_row_change('key');

drop trigger if exists admin_role_permissions_audit on public.admin_role_permissions;
create trigger admin_role_permissions_audit
  after insert or update or delete on public.admin_role_permissions
  for each row execute function public.audit_row_change('role_id,permission_id');

drop trigger if exists admin_user_roles_audit on public.admin_user_roles;
create trigger admin_user_roles_audit
  after insert or update or delete on public.admin_user_roles
  for each row execute function public.audit_row_change('user_id,role_id');

drop trigger if exists admin_user_permissions_audit on public.admin_user_permissions;
create trigger admin_user_permissions_audit
  after insert or update or delete on public.admin_user_permissions
  for each row execute function public.audit_row_change('user_id,permission_id');

drop trigger if exists admin_user_email_domains_audit on public.admin_user_email_domains;
create trigger admin_user_email_domains_audit
  after insert or update or delete on public.admin_user_email_domains
  for each row execute function public.audit_row_change('user_id,domain');

drop trigger if exists seo_pages_audit on public.seo_pages;
create trigger seo_pages_audit
  after insert or update or delete on public.seo_pages
  for each row execute function public.audit_row_change('page_slug');

-- =============================================================================
-- Verification (run in the SQL Editor, ideally on a branch, as an authenticated
-- super admin via "run as authenticated user")
-- =============================================================================
-- -- 1. Trigger tier writes, with a changed-columns-only diff:
-- insert into public.admin_roles (slug, name) values ('audit_probe', 'Audit probe');
-- update public.admin_roles set description = 'touched' where slug = 'audit_probe';
-- delete from public.admin_roles where slug = 'audit_probe';
-- select action, entity_type, entity_id, actor_email, changed
--   from public.admin_audit_log where entity_id = 'audit_probe' order by id;
-- --   expect 3 rows; the update row's `changed` holds ONLY {description:{old,new}}
--
-- -- 2. Immutability — both must fail / affect zero rows:
-- update public.admin_audit_log set action = 'tampered' where id = (select max(id) from public.admin_audit_log);
-- delete from public.admin_audit_log where id = (select max(id) from public.admin_audit_log);
--
-- -- 3. Client tier stamps the actor server-side:
-- select public.log_admin_activity('navigation', 'page_view', null, null, null,
--                                  jsonb_build_object('url', '/admin/probe'));
-- select source, actor_id, actor_email, category, action, context
--   from public.admin_audit_log order by id desc limit 1;
--
-- -- 4. A sign-in must NOT create a mutation row (last_login_at is excluded):
-- select public.touch_admin_login();
-- select count(*) from public.admin_audit_log
--  where entity_type = 'admin_users' and occurred_at > now() - interval '1 minute';
-- --   expect 0
