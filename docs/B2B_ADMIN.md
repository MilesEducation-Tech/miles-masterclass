# B2B Admin — features & functionality

The Partner Platform is the B2B side of the admin console: Miles licenses seats to partner **networks** (alliances, CPA societies) and to standalone **firms**, who then hand those seats to their own people.

This doc is a **walkthrough of what is built today**, screen by screen and role by role. Anything not yet wired is marked **⚠️ Gap**.

Code: [src/app/admin/partner-platform](../src/app/admin/partner-platform) · [src/app/admin/seat-tracker](../src/app/admin/seat-tracker) · routes: [admin.routes.ts](../src/app/admin/admin.routes.ts)

**Related docs — read these for what this one deliberately does not repeat:**

| Doc                                                | What it owns                                                                                |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| [PARTNER_PLATFORM_API.md](PARTNER_PLATFORM_API.md) | The API contract — every endpoint with curl + real response, the mock dataset, backend gaps |
| [ADMIN_PANEL.md](ADMIN_PANEL.md)                   | The whole admin console — shell, auth, and the non-B2B sections                             |
| [api-and-routes.md](api-and-routes.md)             | Every backend path and Angular route in the app                                             |

Skills with the deeper conventions: `partner-platform`, `admin-panel`, `angular-conventions`, `supabase`.

---

## Contents

1. [The model in one page](#1-the-model-in-one-page)
2. [The dual RBAC model](#2-the-dual-rbac-model)
3. [Screens](#3-screens)
4. [Provisioning flows](#4-provisioning-flows)
5. [Running it locally](#5-running-it-locally)
6. [Gaps, divergences and open dependencies](#6-gaps-divergences-and-open-dependencies)
7. [Planned: B2B Reports module](#7-planned-b2b-reports-module)

---

## 1. The model in one page

Four actors, one flow:

```
SUPER ADMIN (Miles)                NETWORK ADMIN (partner HQ)        FIRM ADMIN        END USER
─────────────────────              ──────────────────────────        ──────────        ────────
1 Create a NETWORK (seat budget)
2 Create PARTNER CODES (plans)
3 Create ADMIN LOGINS ───────────► 4 Create SUB-COMPANY
                                     + allocate seats  ──► SEATS minted
                                   5 SEND seat ──────────────────► SEND seat ────► 6 Redeem
```

**Two distinctions that cause every misunderstanding.** Both are load-bearing — most confusion about this product traces back to one of them:

> ### ⚠️ A partner **code** is not a **seat**
>
> A **partner code** is a _price plan / template_. Creating one mints **nothing** and it **never appears in the seat tracker**.
> A **seat** is a _real voucher_. Seats exist only after an **allocation**.
>
> So: `create code (plan)` → `allocate seats → mints seats` → `send a seat to a person` → `person redeems`.

> ### ⚠️ A **sub-company** is not a **standalone firm**
>
> A **sub-company** belongs to a network. It is created by a **super admin** on the Networks page — the panel API has no firm-creation endpoint, so network admins cannot self-serve one.
> A **standalone firm** has `network === null` — a single company (e.g. Deloitte) with no network above it, created from the Networks page by the _super admin_.
>
> Their admins are provisioned through different roles. See [§4](#4-provisioning-flows).

**Scope is server-side.** The backend decides what a user sees from their login. A `firm_id` on the tracker only _filters_; it never widens scope. Never send a network/firm id to try to see more.

`seat.firm` **can be `null`** — a seat minted directly into a network pool. Render `—` and guard every `firm.name` with `?.`.

---

## 2. The dual RBAC model

**Understand this before touching anything here.** Two independent permission systems stack, and they answer different questions.

| Layer                   | Answers                        | Source                       | Read via                                                   |
| ----------------------- | ------------------------------ | ---------------------------- | ---------------------------------------------------------- |
| **Supabase `PERM`**     | _Which pages exist for me?_    | `get_my_admin_profile()` RPC | `permissionGuard` on routes, `*hasPermission` in templates |
| **Django capabilities** | _Which actions can I perform?_ | `GET partners/panel/me/`     | `me.can('seat:send')`                                      |

### 2.1 Layer 1 — Supabase `PERM` (page-level)

Defined in [`PERM`](../src/app/shared/core/models/admin/admin-rbac.model.ts). **Never hardcode the string** — always `PERM.X`.

| Key                       | Intended holder                                               |
| ------------------------- | ------------------------------------------------------------- |
| `partner:platform:manage` | Super-admin console — networks, partner codes, provisioning   |
| `partner:platform:read`   | Partner dashboard + network tracker (Miles ops)               |
| `partner:tracker:read`    | Network admin — seat tracker + vendor users, **no** dashboard |
| `partner:users:read`      | Sub-company admin — vendor users **only**                     |

**Live roles** (after `20260908000000_multi_role_admins.sql` — one per sidenav section, an admin may hold several): `super_admin`, `seo_manager`, `leads_manager`, `reports_viewer`, `partner_platform_admin` (Miles ops — the v2 super-admin console; also registered as a Django `super`), `partner_network_admin`, `partner_subcompany_admin`, `admin_manager`. The four Django-mapped ones are mutually exclusive. See `ADMIN_PANEL.md` §1.4.

Partner roles hold **no** `dashboard:view`, `reports:*`, `seo:*` or `leads:*` — that isolation is the entire safety mechanism for external partner logins. Do not casually grant a partner role anything outside `partner:*`.

### 2.2 Layer 2 — Django capabilities (action-level)

Fetched once by [`PartnerAdminMe`](../src/app/admin/partner-platform/shared/services/partner-admin-me.ts) from `GET partners/panel/me/`, backed by a `resource()` keyed on the signed-in admin's user id (not the rotating access token, which used to refetch it every hour from whatever page you were on). **Fails closed**: both an `{ is_partner_admin: false }` body and any thrown error resolve to "not a partner admin".

Surface: `me.role()` (`super | network | firm`), `me.isNetworkAdmin()`, `me.isFirmAdmin()`, `me.network()`, `me.firm()`, `me.can(capability)`.

Declared capabilities: `report:network:read`, `report:firm:read`, `seat:usage:read`, `seat:send`, `user:block`, `code:create:network`, `code:create:firm`. `can()` is typed to `PartnerCapability`, so a future rename is a compile error rather than a gate that silently returns false.

> **⚠️ Only two of the seven actually gate anything today** — `seat:send` and `code:create:firm`. See [§6](#6-gaps-divergences-and-open-dependencies).

`me.can()` does **not** special-case `role === 'super'`: a Django super with an empty capability list gets `false` for everything.

### 2.3 Where the two layers disagree

The canonical example, in [`seat-tracker.ts`](../src/app/admin/seat-tracker/seat-tracker.ts):

```ts
canCreateFirm = me.isNetworkAdmin() && me.can('code:create:firm');
```

The role check is **not** redundant: role follows scope, capabilities are granted per admin, so neither alone is sufficient. (This particular button is gone — sub-company creation moved to super admins — but the pattern is the rule for every partner action.)

### 2.4 How an admin reaches their landing page

Two mechanisms, both permission-driven — this is why a `partner_subcompany_admin` sees exactly one page:

1. [`AdminSidebar`](../src/app/admin/layout/admin-sidebar/admin-sidebar.ts) filters nav items by `PERM` (ANY-of), then **drops any section left with zero items** — no empty headings.
2. [`adminLandingPath()`](../src/app/admin/shared/utils/admin-landing.ts) walks an ordered list and redirects to the first path the admin holds a permission for, falling back to `/admin/forbidden`.

### 2.5 Request plumbing

Every Partner Platform call sets `IS_ADMIN_REQUEST` via `adminContext()` (in [partner-platform.model.ts](../src/app/admin/partner-platform/shared/models/partner-platform.model.ts)), which makes [`adminTokenInterceptor`](../src/app/shared/core/interceptors/admin-token/admin-token-interceptor.ts) attach `Authorization: Bearer <supabase access token>`.

**Two auth postures now, down from four.** The migration to `partners/*` collapsed them:

| Posture                       | Context flags      | Used by                                                            |
| ----------------------------- | ------------------ | ------------------------------------------------------------------ |
| Supabase admin bearer         | `IS_ADMIN_REQUEST` | Everything under `partners/*` — platform, Vendor Users, Onboarding |
| No auth (endpoint self-auths) | `SKIP_AUTH_TOKEN`  | User Report, and the public onboarding reference dropdowns         |

Two postures are **gone** and must not come back:

- Vendor Users used to send no Authorization header and scope by an
  `email_domain` query param the client supplied — the endpoint answered 200 to
  anyone who guessed a domain. `partners/panel/users/` scopes server-side.
- User Onboarding used to send `X-Internal-Api-Key`, a shared secret shipped in
  the JS bundle and readable in devtools. `INTERNAL_API` is deleted from every
  environment file.

**Errors.** Always unwrap with `partnerErrorMessage(err)` / `partnerLoadError(err)`. `HttpErrorResponse.message` is Angular's generic _"Http failure response for …"_; the real reason lives on `err.error.message`, because every Partner Platform failure is `{ status: false, message }` on a 400/401/403. This is pinned by the only spec in the tree, [partner-platform.model.spec.ts](../src/app/admin/partner-platform/shared/models/partner-platform.model.spec.ts).

**One pagination shape.** Every `partners/*` list returns the same envelope with page **numbers** (`PartnerPagination`) — `parse-next-page.ts` is no longer needed anywhere in the partner surface. The old full-URL form was the users endpoint only.

**Writes return the entity, not an envelope.** A 201 carrying the created object IS success; there is no `{status:true}` to check.

---

## 3. Screens

| Screen                                           | Route                                 | Supabase gate                                                        | Audience              |
| ------------------------------------------------ | ------------------------------------- | -------------------------------------------------------------------- | --------------------- |
| [Networks](#31-networks)                         | `/admin/partner/networks`             | `PARTNER_PLATFORM_MANAGE`                                            | Super admin           |
| [Partner Codes](#32-partner-codes)               | `/admin/partner/partner-codes`        | `PARTNER_PLATFORM_MANAGE`                                            | Super admin           |
| [Network Tracker](#33-network-tracker)           | `/admin/partner/networks/:id/tracker` | `PARTNER_PLATFORM_READ`                                              | Super admin           |
| [Partner Dashboard](#34-partner-dashboard)       | `/admin/partner/dashboard`            | `PARTNER_PLATFORM_READ`                                              | Miles ops             |
| [Partner Code Tracker](#35-partner-code-tracker) | `/admin/partner-code-tracker`         | `PARTNER_PLATFORM_READ` **or** `PARTNER_TRACKER_READ`                | Network + firm admins |
| [Vendor Users](#36-vendor-users)                 | `/admin/domain-users`                 | `REPORTS_USERS_READ` / `PARTNER_TRACKER_READ` / `PARTNER_USERS_READ` | All three             |

Everything is `RenderMode.Client` — no SSR, no SEO.

---

### 3.1 Networks

`/admin/partner/networks` · [networks.ts](../src/app/admin/partner-platform/super-admin/networks/networks.ts) · facade [`PartnerSuperAdminFacade`](../src/app/admin/partner-platform/shared/services/partner-superadmin-facade.ts)

Provisions partner networks and their seat pools. Seats are drawn down as sub-companies mint seats.

**Table:** Network · Slug · Total seats · Allocated · Unallocated · Status · Actions.

**Header actions:** _Standalone companies_ · _Create network_.
**Row actions:** _Tracker_ (→ [§3.3](#33-network-tracker)) · _Firms_ · _Edit_.

**Create / edit — `NetworkFormDialog`**

- `name`, `slug` (lowercase letters/numbers/hyphens), `total_seats` (integer ≥ 0).
- **The slug is immutable after creation** (`disabled(slug, { when: editing })`).
- Edit mode adds an `is_active` checkbox and an **"Add seats to the network pool"** fieldset: tick a code, give it a count, and the `PATCH` mints those seats **straight into the network pool** with `seat.firm === null`. This is the only way network-level seats exist. The response reports `seats_minted`.
- Eligible codes are active codes that are **not firm-scoped** and are either global or belong to this network. A firm-scoped code cannot stock a network pool.

**Firms — `NetworkFirmsDialog`**, two modes driven by whether `data.network` is present:

| Mode                                 | Shows                         | Creates                                                                   |
| ------------------------------------ | ----------------------------- | ------------------------------------------------------------------------- |
| Member firms (from a network row)    | Firms under that network      | `POST` **with** `network_id` — draws from the network's unallocated seats |
| Standalone companies (header button) | Firms with `network === null` | `POST` **without** `network_id` — uncapped, no network                    |

Optional single allocation at creation time (partner code + count); pick _"None — create without minting"_ to mint later.

> **⚠️ Both firm lists are client-side filters** of the full `/superadmin/firms/` response, not server-filtered. Fine at current volume; revisit if firm counts grow.

**After creating a network or firm** the page deep-links to `/admin/admin-users?network=<id>&provision=1` (or `?firm=<id>`) so the operator provisions its admin immediately. See [§4.2](#42-provisioning-an-admin-from-admin-users).

**APIs:** `GET|POST partners/superadmin/networks/` · `PATCH partners/superadmin/networks/<id>/` · `GET|POST partners/superadmin/firms/`

**Gating:** `PARTNER_PLATFORM_MANAGE` + the facade's `canLoad()` (`isSuperAdmin()`). **No Django capability is consulted** — `code:create:network` is never checked.

---

### 3.2 Partner Codes

`/admin/partner/partner-codes` · [partner-codes.ts](../src/app/admin/partner-platform/super-admin/partner-codes/partner-codes.ts)

Plan/price templates. Seats are minted **from** these; creating one mints nothing.

**Table:** Code · Discounted price · Assigned to · Auto-subscribe · Status.

`Assigned to` resolves ids to names: `Network — <name>` / `Firm — <name>` / `Global` (falls back to `#<id>` if the name hasn't loaded).

**Create — `CreatePartnerCodeDialog`:** `code`, `discounted_price` (≥ 0), scope, optional `description`, `auto_subscribe`.

The scope `<select>` encodes a single value — `''` (global) / `network:<id>` / `firm:<id>` — and `submit()` splits it to emit **exactly one** of `partner_network_id` / `partner_firm_id`. A code is scoped to a network **or** a firm, never both; sending both is a 400.

> **⚠️ Create-only.** There is no edit, deactivate or delete for a partner code in the UI, even though `is_active` exists on the model. Deactivating one is currently a database operation.

**APIs:** `GET|POST partners/superadmin/partner-codes/`

---

### 3.3 Network Tracker

`/admin/partner/networks/:id/tracker` · [network-tracker.ts](../src/app/admin/partner-platform/super-admin/network-tracker/network-tracker.ts)

The super admin's per-network view. Reuses `StatCard`.

**Eight stat cards:** Total seats · Allocated · Unallocated · Used · Available · Shared · Applied · Expired.

Below them: the network's member firms (name, email domain, allocated, used, status). The seat-level table is gone — there is no super-admin seat list on the new API. A **View reports** button deep-links into `/admin/partner/reports?network=<id>`.

**APIs:** `GET partners/superadmin/networks/<id>/` (→ `{ network, firms }`)

> **⚠️ The seat table is gone from this page.** There is no super-admin seat list on the new API, and `networks/<id>/` fills only the four pool cards. Engagement detail moved to Reports, which this page deep-links into via `?network=<id>`.
>
> **⚠️** The route is gated on `PARTNER_PLATFORM_READ`, but the two calls it makes bypass the facade's `canLoad()` / `isSuperAdmin()` check. A non-super holding `partner:platform:read` reaches the page and gets a Django 403 rendered in the error banner.

---

### 3.4 Partner Dashboard

`/admin/partner/dashboard` · [partner-dashboard.ts](../src/app/admin/partner-platform/network-admin/dashboard/partner-dashboard.ts)

Seat totals for the signed-in partner admin. Shows a _"Not a partner admin"_ card when `/me/` says no.

**The card set is role-shaped**, discriminated by `'network' in d`:

| Role          | Cards                                                                                 |
| ------------- | ------------------------------------------------------------------------------------- |
| Network admin | Total seats · Allocated · Unallocated · Used · Available · Shared · Applied · Expired |
| Firm admin    | Allocated · Used · Available · Shared · Applied · Expired — **no seat pool**          |

**API:** `GET partners/panel/dashboard/`

> **⚠️ Naming vs reality.** The folder is `network-admin/dashboard/`, but real network admins hold `partner:tracker:read`, **not** `partner:platform:read` — so they cannot see this page. In practice it is Miles-ops-only (i.e. `super_admin`). The component itself renders either shape.

---

### 3.5 Partner Code Tracker

`/admin/partner-code-tracker` · [seat-tracker.ts](../src/app/admin/seat-tracker/seat-tracker.ts) · facade [`PartnerNetworkFacade`](../src/app/admin/partner-platform/shared/services/partner-network-facade.ts)

**The main screen for external partner admins.** Panel title is the network name (network admin) or firm name (firm admin).

**Controls:** status tabs · debounced search (300 ms) · sub-company filter (network admins only — a firm admin is pinned server-side and the facade never sends `firm_id` for them).

**Seat row:** Seat code · _Partner code_ · _Sub-company_ · Purchase cost · Expiry date · Status · Send to email · Shared on / to · Applied on / by.

- `expiry_date: null` renders `—`, not a blank.
- The Sub-company column only appears when the viewer isn't already pinned to one firm.
- `applied_by` is masked (`ra•••ma@x.com`) — local part hidden, domain kept.
- Expired rows are dimmed and sending is disabled.

**Actions and their gates:**

| Action                           | Gate                                                                      |
| -------------------------------- | ------------------------------------------------------------------------- |
| Send / resend a seat to an email | capability `seat:send` → `POST partners/panel/seats/<id>/send/ { email }` |
| Everything else                  | Read-only                                                                 |

Send is per-row: an email input (validated client-side) appears only for `available` seats; a resend icon appears on `shared` ones. The row is optimistically patched to `shared` on success.

Search is **server-side**: `panel/seats/` takes a `search` param matching seat code and email, so it spans every page rather than the 20 rows on screen.

**APIs:** `GET partners/panel/seats/` · `GET partners/panel/firms/` · `POST partners/panel/seats/<id>/send/`

Read-only apart from sending — there is no create action here any more.

---

### 3.6 Vendor Users

`/admin/domain-users` · [users.ts](../src/app/admin/users/users.ts) · facade `PartnerUsersFacade`

**One page, three audiences** — Miles reports staff, network admins and sub-company admins all land here. Manage the partner's own users: view progress, block/unblock.

**Columns:** Name · Email · Phone · Signup · Last login · Course Completed · Course in progress · Status · Action.

- **Email and phone are masked by default**, with a per-row eye toggle. `maskEmail` keeps the domain deliberately — the domain _is_ the vendor-mapping context on this screen.
- Course-count cells have a drill-down (when count > 0) opening the **shared** `UserCourseDetailDialog` from the user-report module.
- Block/Unblock is wrapped in `*hasPermission="PERM.REPORTS_USERS_BLOCK"` and confirms through `BlockStatusDialog`.
- **Export CSV** downloads the filtered set server-side.

**APIs:** `GET partners/panel/users/` · `POST partners/panel/users/<id>/block-status/` · `GET partners/panel/users/export-csv/`

> **⚠️ Security — this page is the odd one out.** It calls the API **without an `Authorization` header** (`SKIP_AUTH_TOKEN`), sending `email_domain` and `report_type` as **query params** for scope. That is a caller-supplied scope on an unauthenticated request. It contradicts the platform's own "scope is server-side" rule. Treat it as a known risk to fix, **not** a pattern to copy.
>
> **⚠️** Export CSV is **not** permission-gated in the template (Leads' export is), and no `reports:users:export` permission exists to gate it with.

---

### 3.7 Where B2B leads come from

Not a Partner Platform screen, but the front of the same funnel and worth knowing:

The partner marketing pages ([features/partners](../src/app/features/partners)) — `corporate`, `allinial-global`, `mgi-world`, `ctcpa`, `illinois`, `hawaii`, `dscpa`, `bkn` and others — post their enquiry form through [`EnquiryService`](../src/app/shared/core/services/enquiry/enquiry.ts) to `POST partners/leads/` ([`LEADS_API.md`](LEADS_API.md)) — an unauthenticated endpoint, so the call carries `SKIP_AUTH_TOKEN` and no `Authorization` header of any kind.

Those rows surface in **`/admin/leads`**, gated on `LEADS_READ`.

> These enquiries stay in the Miles backend only. [`SalesforceLead`](../src/app/shared/core/services/salesforce-lead/salesforce-lead.ts) fires on **user-account creation**, and an enquiry creates no account — so a firm enquiry does not reach Salesforce today.

---

## 4. Provisioning flows

These are the multi-step, partially-failable operations — the likeliest source of a support ticket.

### 4.1 Create a firm (super admin, from Networks)

Network admins **cannot** create sub-companies — the panel API has no
firm-creation endpoint. A super admin does it from the Networks page, via the
Firms dialog (member firms) or the Standalone companies button.

`POST partners/superadmin/firms/` takes the firm, its optional seat
`allocations`, and an optional `admin: { supabase_uid, email?, capabilities? }`,
so the firm, its seats and its admin login are created **atomically**. The
Supabase login is minted first (`provision_admin_user` RPC) to obtain the uid.

To add seats to a firm that already exists, use **Add seats** on the network
detail page → `POST partners/superadmin/firms/<id>/allocate/`.

### 4.2 Provisioning an admin from Admin Users

`/admin/admin-users` · gated on `ADMIN_USERS_MANAGE` · **Supabase direct** (RLS-enforced).

Deep-linkable: `?provision=1` opens the form, `?network=<id>` / `?firm=<id>` pre-selects the scope and shows a banner naming it. This is where the Networks page sends you after creating a network or firm.

Fields: email · full name · role · email domains · report type · a permission checklist seeded from the role's defaults (the diff is submitted as `grants` / `denies`).

When the chosen role is a partner role, a **Partner Platform block** appears:

| Supabase role              | Django role | Capabilities                                                         | Scope                          |
| -------------------------- | ----------- | -------------------------------------------------------------------- | ------------------------------ |
| `partner_network_admin`    | `network`   | `report:network:read`, `code:create:firm`, `seat:send`, `user:block` | network **or** standalone firm |
| `partner_subcompany_admin` | `firm`      | `report:firm:read`, `user:block`                                     | firm                           |

> **The rule that isn't obvious anywhere else:** binding a `partner_network_admin` **to a firm** downgrades the Django role to `'firm'` while keeping the network-admin capability set. **That is how a standalone company's admin is created.**

The scope select for `partner_network_admin` lists active networks and **standalone firms only** — member firms are excluded on purpose, because their admins go through the sub-company role.

**`provision_admin_user` RPC** ([migration](../supabase/migrations/20260713020000_provision_admin_user.sql)) is `SECURITY DEFINER` and self-authorizes:

- holder of `admin:users:manage` → may provision **any** role;
- holder of `partner_network_admin` → may provision **only** `partner_subcompany_admin`, so an alliance HQ can onboard its own sub-companies.

It finds-or-creates the `auth.users` row (setting the initial password only on first create), upserts `admin_users`, **replaces** the email-domain rows, assigns the role, then applies grants/denies.

> **⚠️** `INITIAL_ADMIN_PASSWORD` is a **static shared password**, duplicated in [admin-provisioning.ts](../src/app/admin/partner-platform/shared/services/admin-provisioning.ts) and in the SQL migration, and surfaced in success toasts. The two must stay in sync. Users are told to change it after first sign-in; nothing enforces that.

**Also on this page:** toggle active (a disabled admin is signed out on their next auth event), edit email domains, and delete via the `delete_admin_user` RPC (refuses self-delete and non-admin targets). Domain editing and delete confirmation currently use native `prompt()` / `confirm()`.

### 4.3 Where seats come from

Only two mints exist:

1. `PATCH partners/superadmin/networks/<id>/` with `allocations` → seats in the **network pool**, `seat.firm === null`.
2. Firm / sub-company `allocations` at creation time → seats owned by that firm.

This is why `seat.firm` is nullable — guard every `firm.name` with `?.`.

3. `POST partners/superadmin/firms/<id>/allocate/` → top up an **existing** firm (super admin only).
4. `POST partners/superadmin/seats/<id>/assign-firm/` → move an unassigned pool seat onto a firm.

---

## 5. Running it locally

[`partnerMockInterceptor`](../src/app/admin/partner-platform/shared/services/partner-mock-interceptor.ts) fakes the entire Django layer so all three portals are clickable before the backend is deployed. It is registered **last** in [app.config.ts](../src/app/app.config.ts) so it short-circuits only fully-prepared requests, and anything it doesn't recognise falls through to the real API.

**It activates only when both hold:**

1. the page is served from `localhost` / `127.0.0.1` / `[::1]`, **and**
2. `localStorage.partnerMock` is `'super'`, `'network'` or `'firm'`.

That second value is also **how you switch portals** — it is the role `/partner-admin/me/` reports back.

```js
// In the browser console, then reload:
localStorage.partnerMock = 'network'; // or 'super' / 'firm'
delete localStorage.partnerMock; // back to the real API
```

> **Why hostname and not `environment.production`:** `ng serve` in this repo defaults to the **production** configuration, so `environment.production` is `true` on the dev server and would switch the mock off exactly where it's wanted.

**It fakes only Django.** Supabase route and sidebar RBAC still need a real admin login, so **sign in as a super admin** to reach the pages.

Fixture data mirrors §3 of [PARTNER_PLATFORM_API.md](PARTNER_PLATFORM_API.md): network 11 _Acme Alliance_ (100 seats, 12 allocated), firms 16 Google / 17 Amazon (members) and 18 Deloitte (standalone), codes `ACME-STD` (network) / `GLOBAL-99` (global) / `DELOITTE` (firm), and seats covering applied, shared, and a `firm: null` network-level one. Fixtures live in `partner-mock-handlers.ts` and are lazily imported.

> **⚠️ Confirm the mock is off before debugging "wrong" data.** It returns entirely plausible rows.

---

## 6. Gaps, divergences and open dependencies

### 6.1 Backend gaps

From [PARTNER_PLATFORM_API.md](PARTNER_PLATFORM_API.md) §9:

| Gap                                    | Effect today                                                                                                                                  |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Voucher email on send                  | Status flips to `shared` — confirm an email is actually dispatched                                                                            |
| ~~Allocate seats to an existing firm~~ | **Closed.** `POST superadmin/firms/<id>/allocate/` is wired to an **Add seats** action on every firm row of the network detail page           |
| `seats/<id>/assign-firm/` unreachable  | It moves a pool seat onto a firm, but a super admin cannot list pool seats to pick one. Left unbound until a seat list exists                 |
| No super-admin seat list               | There is no `superadmin/seats/` GET, so Miles ops cannot see seat-level rows. The network tracker lost that table — ask backend if it matters |
| Firm creation from the panel           | No `panel/*` endpoint exists, so **network admins can no longer create sub-companies** — a super admin does it on the Networks page           |
| `report/filters/` is unusable          | Returns `delivery_types`/`fields_of_study`, but no list endpoint accepts them as params — left unbound                                        |
| Apply-from-panel (redeem)              | Not built — redemption lives in the end-user app                                                                                              |

### 6.2 Docs that are now wrong about the code

Fix these at the source when you touch them:

1. **`X-Admin-Request: 1` is not sent.** It is commented out in [admin-token-interceptor.ts](../src/app/shared/core/interceptors/admin-token/admin-token-interceptor.ts), despite being documented in `partner-platform.model.ts`, `ADMIN_PANEL.md` §12.3 and the `partner-platform` skill. Only `Authorization: Bearer …` goes out.
2. ~~**The `partner_platform_admin` role no longer exists**~~ — re-seeded by `20260908000000_multi_role_admins.sql` as the Miles-ops role for the v2 super-admin console (`partner:platform:manage` + `read` + `users:create`).
3. **Stale UI copy** in Admin Users still says _"Generate & run the SQL … then Register partner admin"_ — that flow was replaced by the one-click `provision_admin_user` RPC.
4. ~~**`PartnerUser.*_ids` bucket shape**~~ — moot. `partners/panel/users/` sends no course-id buckets at all, so the per-row drill-down is gone and `partner-user.model.ts` is deleted.
5. **Two stale code comments about the sub-company / standalone-firm roles.** The code is right; the comments are not:
   - [admin-auth.model.ts](../src/app/shared/core/models/admin/admin-auth.model.ts) describes `partner_subcompany_admin` as _"Django role=network (firm-scoped)"_, but `PARTNER_ROLE_MAP` sets `role: 'firm'`.
   - The `PARTNER_ROLE_MAP` header comment in [admin-users.ts](../src/app/admin/admin-users/admin-users.ts) says binding a network admin to a firm gives it `FIRM_CAPABILITIES`. It does not — `provision()` sends `mapping.capabilities`, i.e. the **full network-admin set**, exactly as the comment further down at the call site says. §4.2 above reflects the code.
6. **§7 below ("Planned: B2B Reports module") is SHIPPED** — it lives at `/admin/partner/reports`, super-admin only, and is bound to `partners/superadmin/report/*`. Read §7 as the original design, not as outstanding work.
7. **[vendor-coupon-tracker-plan.md](vendor-coupon-tracker-plan.md) is superseded** — its `vendor_admin` role and `vendors` / `vendor_coupons` / `admin_user_vendors` tables and `partners/vendors/*` endpoints **do not exist** in the shipped code. Read it as history only.

### 6.3 Declared but never wired

| #   | What                                                                                                                                                                             | Where                                               |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| 7   | ~~**`/admin/reports/courses` has no route**~~ — closed: the item, landing entry and `reports:courses:read` are gone                                                              | [admin.routes.ts](../src/app/admin/admin.routes.ts) |
| 8   | ~~**`seat:usage:read` was never granted**~~ — closed: capability picker with `CAPABILITY_DEFAULTS`; `code:create:network` still has no panel endpoint to honour it (backend ask) | across the module                                   |
| 9   | **`user:block` is granted but not used as a gate** — the Block button reads the _Supabase_ `PERM.REPORTS_USERS_BLOCK` instead                                                    | `users-table.html`                                  |
| 10  | ~~**`excludeRolesGuard` and `SidebarItem.excludeRoles`**~~ — deleted                                                                                                             | `permission.guard.ts`, `admin-sidebar.ts`           |
| 11  | **Networks and Partner Codes consult no capability at all** — pure `PARTNER_PLATFORM_MANAGE` (`canLoad()` now checks that PERM, not the `super_admin` slug)                      | §3.1, §3.2                                          |
| 12  | **`users:create` is deliberately assigned to no role**, so only `super_admin` reaches User Onboarding until someone grants it                                                    | `20260813000000_user_onboarding_permission.sql`     |
| 13  | ~~**Two different types both named `PartnerCode`**~~ — closed. Both now read `partners/superadmin/partner-codes/`                                                                | both models                                         |

### 6.3a Backend asks (frontend cannot close these)

| #   | Endpoint                                                                                     | Why                                                                                                   |
| --- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 1   | `PATCH /superadmin/partner-admins/<id>/` `{ capabilities?, is_active?, email? }`             | Partner Admins is read-only; no way to grant `seat:usage:read` to an existing admin or deactivate one |
| 2   | `DELETE /superadmin/partner-admins/<id>/`                                                    | same                                                                                                  |
| 3   | `GET /superadmin/seats/?network_id&firm_id&unassigned=1&status&search&page&page_size`        | the assign-seat dialog needs a picker instead of a typed numeric id; supers have no seat view at all  |
| 4   | `POST /panel/partner-codes/` (superadmin body minus scope; gate `code:create:network\|firm`) | those two capabilities exist but nothing honours them — the overview CTA was removed until this lands |
| 5   | `GET /superadmin/countries/` (or make `/api/country/` AllowAny)                              | `country_selected` is a FK id on onboard/update but the only country list needs a learner JWT         |
| 6   | `GET /superadmin/users/` — add `*_id` fields alongside the display names                     | the edit form maps names → ids by label (fragile); `experience_id` can't be prefilled at all          |
| 7   | `PATCH /superadmin/partner-codes/<id>/`, `PATCH /superadmin/firms/<id>/` (`is_active`, …)    | codes and firms are create-only; `is_active` is displayed but never settable                          |

### 6.4 Security notes

- ~~**Vendor Users sends caller-supplied scope on an unauthenticated request**~~ — **closed.** `partners/panel/users/` is token-scoped server-side.
- ~~**User Onboarding ships `X-Internal-Api-Key` in the bundle**~~ — **closed.** `INTERNAL_API` is removed from every environment file.
- **Vendor Users "Export CSV" is ungated**, and no export permission exists to gate it with.
- **`INITIAL_ADMIN_PASSWORD` is a static shared password** in code, SQL and toasts.
- **`hasPermission` / `hasAny` / `hasAll` all short-circuit `true` for `super_admin`** — no permission can be withheld from a super admin at the UI layer. Server-side RLS and Django scope remain the real authority.
- ~~**Sub-company onboarding is not transactional**~~ — closed: `POST /superadmin/firms/` creates the firm, mints its seats and provisions its admin in one call.

### 6.5 Known shortcuts

Deliberate, marked `ponytail:` in code:

- ~~Seat search is client-side~~ — closed: `panel/seats/` takes a server `search` param.
- Reload-after-write everywhere, no optimistic patching (except the seat send row).
- Leads CSV export is client-side, capped at 5 000 rows.
- Native `confirm()` / `prompt()` in Admin Users for delete and domain editing.
- `TODO(open dep)` ×2 in User Onboarding: the exact "Creator" partner code (currently a `/creator/i` heuristic) and the enum values `onboard-user` accepts.

---

## 7. Planned: B2B Reports module

> **Status: not built.** This section is the implementation plan. Everything in §1–§6 describes shipped code; nothing here exists yet.

### 7.0 Preview report + PDF (shipped 2026-09-09)

"Preview report" next to Export CSV (both bases) opens `shared/components/dialog/partner-report-preview-dialog` — the client-facing "Partner Learning Report" (executive summary, Courses-by-user, Webinars-by-user, webinar callout) for the page's current scope + dates. Data comes from `PartnerReportFacade.loadPreviewBundle()`: both subjects' `summary/` plus every `users/` page (page_size 200) in one `Promise.all`, built from its own param sets so the page's `subject` signal is untouched. "Download PDF" lazy-loads the existing `HtmlToPdf` service (jspdf + html2canvas-pro stay in the `html-to-pdf` chunk) and captures the `.report` root as one long page; the root pins the learner-facing Masterclass palette (root tokens — dark ground, brand blue, Inter Tight) on itself because the capture canvas is transparent and the clone is re-parented under `<body>`. Tables never scroll (html2canvas clips `overflow:auto`) — columns wrap instead.

### 7.1 What it is

A reporting section for B2B partners, available to **all three roles**, made of **six views** across two subjects (**courses** and **webinars**) at three levels of granularity:

| Level               | Courses view              | Webinars view              | One row =                                                   |
| ------------------- | ------------------------- | -------------------------- | ----------------------------------------------------------- |
| **Partner summary** | Partner summary — Courses | Partner summary — Webinars | the partner (one row, or one per partner for a super admin) |
| **User summary**    | User course summary       | User webinar summary       | a user, expandable                                          |
| **User detail**     | User course specific      | User webinar specific      | a user × one course / one webinar                           |

The three levels are the _same data at three zoom levels_, so they must reconcile: a partner-summary total is the sum of its user-summary rows, and a user-summary total is the sum of that user's detail rows. Build them off one query layer, not three, or they will drift.

**Expand-in-place is the primary navigation.** The requirement's _"User Name (dropdown of each course)"_ means a user row expands to reveal that user's own rows — `Courses (10)` and `Webinars (5)` — with per-item columns. So the "user specific" views are the expanded form of the "user summary" views, and are _also_ reachable flat, which is what CSV export needs.

**Role changes the scope and the filters, never the columns.** The six views and their columns are identical for everyone; a firm admin simply sees fewer users and fewer filters.

**This is what the two dead reporting capabilities were minted for.** `report:network:read` and `report:firm:read` gate nothing today ([§6.3](#63-declared-but-never-wired)); this module consumes them.

### 7.2 Access model

Two layers, as everywhere else in this panel ([§2](#2-the-dual-rbac-model)).

**Page access — Supabase `PERM`, reusing existing keys.** No migration, no new permission:

```ts
{
  path: 'reports/b2b',
  canMatch: [permissionGuard(
    PERM.PARTNER_PLATFORM_MANAGE,   // super admin
    PERM.PARTNER_TRACKER_READ,      // network admin
    PERM.PARTNER_USERS_READ,        // sub-company admin
  )],
  loadComponent: () => import('./b2b-report/b2b-report').then((m) => m.B2bReport),
}
```

`permissionGuard` is ANY-of, so all three roles match. Miles staff reach it via `super_admin`, which short-circuits every permission check.

**Scope and filter set — Django role + capability**, from [`PartnerAdminMe`](../src/app/admin/partner-platform/shared/services/partner-admin-me.ts):

| Role      | Capability            | Sees                                                                  |
| --------- | --------------------- | --------------------------------------------------------------------- |
| `super`   | —                     | Every network and firm; partner summary lists **one row per partner** |
| `network` | `report:network:read` | Own network + all its sub-companies                                   |
| `firm`    | `report:firm:read`    | Own firm only                                                         |

A non-partner admin gets the same _"Not a partner admin"_ card the dashboard and tracker already render — `PartnerAdminMe` fails closed.

**Nav:** add a `B2B report` item to the existing **Reports** section of [admin-sidebar.ts](../src/app/admin/layout/admin-sidebar/admin-sidebar.ts) with the same three-permission array. The section self-hides when empty.

### 7.3 The six views and their columns

Every metric below is scoped to the active filters ([§7.4](#74-filter-matrix-by-role)) — including the date range. "Total" always means "total within the selected window".

#### A1 · Partner summary — Courses

| Column                         | Definition                                            |
| ------------------------------ | ----------------------------------------------------- |
| Total partner codes            | Partner codes scoped to this partner                  |
| Users onboarded                | Users who redeemed a seat / joined under this partner |
| Active in last 15 days         | Users with activity in the trailing 15 days           |
| Total courses started          | Distinct user × course enrolments begun               |
| Total courses completed        | Enrolments with all classes completed                 |
| Avg courses completed per user | completed ÷ users onboarded                           |
| Total CPE credits awarded      | Sum of credits from completed courses                 |
| Avg CPE credits per user       | credits ÷ users onboarded                             |
| Avg feedback per course        | Mean course rating                                    |
| Total certificates awarded     | Certificates issued                                   |

#### A2 · Partner summary — Webinars

| Column                        | Definition                                  |
| ----------------------------- | ------------------------------------------- |
| Total partner codes           | As above                                    |
| Users onboarded               | As above                                    |
| Active in last 15 days        | As above                                    |
| Webinars registered for       | **Distinct** webinars with ≥ 1 registration |
| Total registrations           | Registration count (user × webinar)         |
| Avg registrations per webinar | registrations ÷ distinct webinars           |
| Total attendance              | Attended registrations                      |
| Avg attendance per webinar    | attendance ÷ distinct webinars              |
| Total CPE credits awarded     | Credits from attended webinars              |
| Avg CPE credits per user      | credits ÷ users onboarded                   |
| Avg feedback per webinar      | Mean webinar rating                         |
| Total certificates awarded    | Certificates issued                         |

> ⚠️ The source spec labels this column _"Average feedback per course"_ in the webinars table — read as **per webinar**. Confirm before building.

#### B1 · User course summary — one expandable row per user

| User name ⌄ | UUID | Email | Active in last 15 days | Total courses completed | Total CPE credits awarded | Avg feedback per course | Total certificates awarded |

#### B2 · User webinar summary — one expandable row per user

| User name ⌄ | UUID | Email | Active in last 15 days | Total webinars registered | Total webinars attended | Total CPE credits earned | Avg feedback per webinar | Total certificates awarded |

#### C1 · User course specific — one row per user × course

| User name | UUID | Email | Course name | Course completed (Yes/No) | CPE credits awarded | Feedback of course | Certificate awarded |

#### C2 · User webinar specific — one row per user × webinar

| User name | UUID | Email | Webinar name | Webinar registered (Yes/No) | Webinar attended (Yes/No) | Feedback of webinar | Certificate awarded |

#### The expanded row

Expanding a user in B1/B2 reveals their own items, grouped and counted — `Courses (10)` · `Webinars (5)`:

- **Courses:** course name · completion status · credits · feedback · **download certificate**
- **Webinars:** webinar name · registered · attended · feedback · certificate

> **Certificate is an action, not a count.** In the expanded row it is a download control, so it needs the certificate URL on the item, not a boolean. The learner side already does this — see [§7.6](#76-what-we-reuse-and-what-is-genuinely-new).

**UUID** is `miles_user_id` on the existing `User` model — not the numeric `id`.

**"Active in last 15 days"** needs a last-activity date per user (`date_of_login` already exists on the admin report row). Compute it **server-side**: a client-side comparison against "now" makes cached rows silently wrong. Treat 15 as a server constant, not a magic number in the UI.

### 7.4 Filter matrix by role

The same filter bar drives all six views.

| Filter                                                              | Control                          | Super |  Network  |   Firm    |
| ------------------------------------------------------------------- | -------------------------------- | :---: | :-------: | :-------: |
| **Date from / to**                                                  | two native `<input type="date">` |  ✅   |    ✅     |    ✅     |
| **Completed courses**                                               | toggle                           |  ✅   |    ✅     |    ✅     |
| **In-progress courses**                                             | toggle                           |  ✅   |    ✅     |    ✅     |
| **Delivery type** (masterclass / podcast / nano-learning / webinar) | multiselect                      |  ✅   |    ✅     |    ✅     |
| **Field of study** (accounting / ethics / others)                   | multiselect                      |  ✅   |    ✅     |    ✅     |
| **CPE credits earned** (min / max)                                  | two number inputs                |  ✅   |    ➖     |    ➖     |
| **Network**                                                         | select                           |  ✅   | 🔒 pinned | 🔒 pinned |
| **Sub-company (firm)**                                              | select                           |  ✅   |    ✅     | 🔒 pinned |
| **Email domain**                                                    | select                           |  ✅   |    ✅     |    ➖     |
| **User**                                                            | autocomplete                     |  ✅   |    ➖     |    ➖     |
| **Free-text search**                                                | search input                     |  ✅   |    ✅     |    ✅     |

✅ offered · ➖ not offered · 🔒 fixed server-side, not rendered

**"CPE mode" is two filters, not one** — confirmed as both _delivery type_ and _field of study_. Delivery type maps onto buckets the reporting rows already carry; field of study is the `Accounting | Ethics | Others` split from the learner CPE tracker.

**The metric selections are row filters, not column toggles** — confirmed. `completed=true` means _"only users with ≥ 1 completed course in the window"_. Columns never disappear; the population narrows.

**Cascading selects (super admin).** Network → sub-company → user. Choosing a network filters firms via `firmsForNetwork(id)` (already on `PartnerSuperAdminFacade`); choosing a firm scopes the user autocomplete. Clearing a parent clears its children. Network admins get the same cascade minus the top level, from `PartnerNetworkFacade.subCompanies()` (already `isNetworkAdmin()`-gated).

### 7.5 Scope is enforced server-side — the one rule that matters

> ⚠️ **The frontend hiding a selector is a UX affordance, never a security boundary.**
>
> The backend must derive the caller's network/firm from their `PartnerAdmin` record and **reject** — 403, not silently widen or narrow — any `network_id` / `firm_id` / `email_domain` / `user_id` outside it.

- `firm_id` from a network admin → allowed **only** if that firm is in their network.
- `network_id` from anyone but a super admin → **403**.
- Omitted scope params → default to the caller's full permitted scope, never to "everything".

> ⚠️ **Do not copy the Vendor Users posture** ([§3.6](#36-vendor-users)) — it sends `email_domain` on an _unauthenticated_ request, exactly the anti-pattern to avoid here. These endpoints use the Supabase bearer like every other Partner Platform call.

### 7.6 What we reuse and what is genuinely new

The earlier assumption that the existing admin report row could be reused wholesale **does not survive this spec**. Be clear about the gap:

**[`UserReportRow`](../src/app/admin/user-report/shared/models/user-report.model.ts)** (admin Reports → User report) has CPE course counts and credits, and nothing else this needs:

| Needed                                          | In `UserReportRow`?               |
| ----------------------------------------------- | --------------------------------- |
| Courses completed, CPE credits, in-progress     | ✅                                |
| UUID (`miles_user_id`)                          | ❌                                |
| Feedback / rating                               | ❌                                |
| Certificates                                    | ❌                                |
| Webinar registration / attendance               | ❌                                |
| Courses **started** (distinct from in-progress) | ❌                                |
| Active in last 15 days                          | ⚠️ derivable from `date_of_login` |

**[`ReportRow`](../src/app/shared/core/models/cpe-tracker.model.ts)** — the learner CPE tracker row, served by `usercredits/` — is much closer to the C1/C2 detail row and the expanded row:

| Spec column           | `ReportRow` field                                       |
| --------------------- | ------------------------------------------------------- |
| Course / webinar name | `course_name`, `webinar_details.webinar_name`           |
| Completion status     | `all_classes_completed`, `completed_at`                 |
| CPE credits           | `total_credits`                                         |
| Feedback              | `user_feedback_details.user_rating`                     |
| Certificate           | `assessment.certificate_url`, `is_certificate_eligible` |
| Webinar registered    | `registered_at`                                         |
| Webinar attended      | `attendance_status`                                     |
| Field of study        | `field_of_study`                                        |
| Delivery type         | `transaction_type`                                      |

**So the shape of this report already exists — for the signed-in learner only.** The B2B module is, in effect, _"the CPE tracker report, for someone else's users, aggregated and scoped to a partner."_ That is the single most useful framing for the backend conversation: the per-item row is largely solved; what is missing is a **partner-scoped, multi-user** version of it plus the aggregate roll-ups.

| Reuse                                                                              | Build new                                       |
| ---------------------------------------------------------------------------------- | ----------------------------------------------- |
| `ReportRow` / `WebinarDetails` / `UserFeedbackDetails` / `ReportAssessment` shapes | Six view models + aggregate roll-ups            |
| `StatCard` for the partner summary tiles                                           | Expandable user row (courses + webinars groups) |
| `parseNextPage`, `withPreviousValue`                                               | Role-aware filter bar                           |
| `PartnerAdminMe` (role + capability)                                               | Filter state → query-param mapping              |
| `PartnerSuperAdminFacade.networks()` / `firmsForNetwork()`                         | Cascading network → firm → user selects         |
| `PartnerNetworkFacade.subCompanies()`                                              | Certificate download wiring in the expanded row |
| `aria-select`, `aria-multiselect`, `aria-autocomplete`, `aria-input`, `aria-tabs`  | The backend endpoints                           |
| Certificate download precedent (`user-assessment/download_bulk_certificate/`)      |                                                 |
| `partnerErrorMessage` / `partnerLoadError`                                         |                                                 |

**No date-picker dependency.** Native `<input type="date">` gives a calendar, keyboard support and locale formatting for free. There is no date input anywhere in the app today — keep it native.

### 7.7 API contract (backend work)

New endpoints in the authenticated partner-admin family, inheriting the existing `adminContext()` / `IS_ADMIN_REQUEST` posture:

| View                                             | Method + path                                                                   |
| ------------------------------------------------ | ------------------------------------------------------------------------------- |
| A1/A2 partner summary                            | `GET partners/superadmin/report/summary/?subject=courses\|webinars`             |
| B1/B2 user summary                               | `GET partners/superadmin/report/users/?subject=courses\|webinars`               |
| C1/C2 user detail (flat, and the expand payload) | `GET partners/superadmin/report/user-items/?subject=courses\|webinars&user_id=` |
| Filter reference data                            | `GET partners/superadmin/report/filters/`                                       |
| CSV export                                       | `GET partners/superadmin/report/export-csv/?view=&subject=`                     |

A `subject` discriminator rather than separate course/webinar paths keeps the filter and scope logic in one place on both sides — the two subjects share every filter.

**Why not extend `reports/user-report/`:** it is unauthenticated (`SKIP_AUTH_TOKEN`) and unscoped, serving the Miles-staff report. Partner scoping needs caller identity, which that endpoint does not have.

**Query params** (all optional; omitted = no constraint):

```
subject                   courses | webinars          (required)
date_from, date_to        yyyy-mm-dd inclusive; send both or neither
completed                 true → users with ≥1 completed item in range
in_progress               true → users with ≥1 in-progress item in range
delivery_type             repeatable: masterclass | podcast | nano_learning | webinar
field_of_study            repeatable: accounting | ethics | others
min_cpe_credits           number, super admin only
max_cpe_credits           number, super admin only
network_id                super admin only
firm_id                   super admin + network admin (must be in caller's network)
email_domain              super admin + network admin
user_id                   super admin only; also the expand payload key
search                    free text over name / email / UUID
page                      1-based
```

**Pagination** is the one shared page-number envelope (`PartnerPagination`) — see [§2.5](#25-request-plumbing).

**Aggregates are computed server-side.** Averages must never be derived by the client from a paginated slice — page 1 of 12 would produce a confidently wrong "average per user". The summary endpoint returns the aggregates for the **whole filtered set**, independent of paging.

**Divide-by-zero:** every `Avg …` column needs a defined answer when the denominator is 0. Return `null` and render `—`; do not send `0`, which reads as a real measurement.

**Errors:** uniform `{ status: false, message }`, unwrapped with `partnerErrorMessage`.

**CSV export takes the same params as the listing.** ⚠️ The existing `UserReportFacade.exportCsv()` sends **no** filter params, so it exports the unfiltered set regardless of what is on screen. Do not copy that — the B2B export must reflect the active filters, as Vendor Users' export already does.

### 7.8 Frontend build

```
src/app/admin/b2b-report/
├── b2b-report.ts / .html / .css              page shell: subject tabs + filters + view
└── shared/
    ├── models/b2b-report.model.ts            filter state, params, six view row types
    └── components/
        ├── b2b-report-filters/               role-aware filter bar
        ├── b2b-partner-summary/              A1 / A2 stat tiles
        ├── b2b-user-summary-table/           B1 / B2, expandable rows
        └── b2b-user-items-table/             C1 / C2 + the expanded-row body
```

**Navigation:** a **subject tab strip** (Courses | Webinars) using the existing `aria-tabs` / `tab-strip`, plus a level control (Partner summary · Users · Detail). Two controls, six views — rather than six nav entries.

**One expanded-row component, two hosts.** `b2b-user-items-table` renders both the flat C1/C2 view and the body of an expanded B1/B2 row. Same columns, same certificate action, one implementation.

**State: component-owned `resource()`, no facade.** Filter signals feed one `resource()` per active view; `linkedSignal` mirrors rows so tables hold content through stale-while-revalidate. Reuse [`withPreviousValue`](../src/app/shared/utils/with-previous-value.ts) and [`parseNextPage`](../src/app/shared/utils/parse-next-page.ts). Prefer `linkedSignal` over a reset `effect` for the page-reset-on-filter-change. (Older admin modules use facades — follow that only if this state ever needs sharing across routes.)

**Expansion state** is a `Set<userId>` of open rows, and each expansion lazily loads its items — never prefetch items for 30 users. Collapse must not discard the loaded payload; re-expanding should be instant.

**Filter bar behaviour:**

- Debounce search 300 ms + `distinctUntilChanged`, as the tracker and Vendor Users do.
- Any filter change resets `page` to 1.
- Date validation client-side (`from ≤ to`, not future); the server revalidates.
- A visible **Reset filters** control and an active-filter count — with this many controls, _"why is the table empty?"_ is otherwise a support ticket.
- Empty state must distinguish _"no users match these filters"_ from _"you have no users"_.

### 7.9 Phases

Each phase is independently shippable.

| Phase | Scope                                                                                            | Needs backend? |
| ----- | ------------------------------------------------------------------------------------------------ | -------------- |
| **A** | Route, nav item, page shell, subject/level controls, role gating, "not a partner admin" state    | No             |
| **B** | Filter bar with base filters (date range, completed, in-progress, search) + role-aware rendering | No (mock)      |
| **C** | B1/B2 user summary tables wired to the users endpoint                                            | Yes            |
| **D** | Expandable rows + C1/C2 detail tables + certificate download                                     | Yes            |
| **E** | A1/A2 partner summary tiles                                                                      | Yes            |
| **F** | Scope selectors + cascade (network → sub-company → user, email domain)                           | Yes            |
| **G** | Delivery type / field of study / CPE credit range filters; CSV export carrying filters           | Yes            |

Phases A and B land before any backend exists. Extend [partner-mock-interceptor.ts](../src/app/admin/partner-platform/shared/services/partner-mock-interceptor.ts) with the new endpoints so C–G are buildable and demoable — the same `localStorage.partnerMock` switch ([§5](#5-running-it-locally)) exercises all three roles.

### 7.10 Open questions and dependencies

**Blocking — needs the backend team:**

1. **Do these endpoints exist, or is this new work?** Everything from Phase C is blocked on them. Assume new.
2. **Are webinar registration, attendance, feedback and certificates queryable per partner?** The learner `usercredits/` row carries all four for _one_ user; a partner-scoped multi-user version is the core ask. If webinar attendance is not reportable, A2/B2/C2 cannot ship and the module launches courses-only.
3. **What does the date range filter on** — course completion, enrolment/registration, or user signup? Materially different reports. Assumption taken: **activity date** (completion / registration), since every other filter is engagement-shaped.
4. **Is `field_of_study` groupable on the reporting tables?** The learner tracker derives `Accounting | Ethics | Others` from the study-mode breakdown. If not available, Phase G ships delivery type only.
5. **"Users onboarded" definition** — everyone who redeemed a seat, or everyone with an account on a matching email domain? These diverge sharply for a firm with a broad domain, and every per-user average depends on it.

**Non-blocking:**

6. Is _"Average feedback per course"_ in the webinars summary a typo for _per webinar_? Assumed yes ([§7.3](#73-the-six-views-and-their-columns)).
7. Is "Total courses started" distinct from "in progress", or does started = completed + in-progress? Assumed **started = completed + in-progress**.
8. Should a network admin also get the CPE-credit min/max range? Not in the stated requirement; trivially added later since the param is role-gated server-side.
9. Should a firm admin see the email-domain filter? Their firm has one domain, so it is redundant. Assumed **no**.
10. Export permission — CSV export is ungated on Vendor Users ([§6.4](#64-security-notes)). Decide whether this export needs its own permission before Phase G, rather than inheriting that gap.
11. Is the 15-day activity window fixed, or should it follow the selected date range? Assumed **fixed at 15 days**, per the spec's wording.

### 7.11 Verification

1. `npx ngc -p tsconfig.app.json --noEmit` — full template typecheck.
2. `npm run build:prod` — the real gate. The initial bundle is already ~27 kB over its 2.00 MB budget before this work; keep the module lazy so it does not worsen.
3. **Role matrix, against the mock** — for each of `localStorage.partnerMock = 'super' | 'network' | 'firm'`, confirm the filter bar renders exactly the row of [§7.4](#74-filter-matrix-by-role) and no more, and that all six views are reachable.
4. **Scope enforcement — the test that actually matters.** As a network admin, hand-craft a request carrying another network's `network_id` and an out-of-network `firm_id`. Both must **403**. If either returns data, the feature is not shippable.
5. **Reconciliation across levels** — for one partner and one fixed filter set, the A1 totals must equal the sum of the B1 rows, and each B1 row must equal the sum of that user's C1 rows. This is the check that catches aggregate bugs, and it is worth automating.
6. Averages are computed over the whole filtered set, not the current page: compare an average on page 1 against the same query at a larger page size — they must match.
7. Divide-by-zero: a partner with zero onboarded users renders `—`, not `0` or `NaN`.
8. Expansion: opening a user loads only that user's items; collapsing and re-expanding does not refetch.
9. CSV export contents match the on-screen filtered rows — explicitly, since the existing user-report export does not.
10. Pagination preserves every active filter on page 2.
