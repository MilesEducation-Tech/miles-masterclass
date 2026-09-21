# Admin Panel — sections & flows

Internal console at `/admin`. Fully separate from the learner app: separate auth (Supabase), separate token, separate layout, `RenderMode.Client` throughout (nothing to server-render, no SEO).

Code: [src/app/admin](../src/app/admin) · routes: [admin.routes.ts](../src/app/admin/admin.routes.ts)
Related docs: [B2B_ADMIN.md](B2B_ADMIN.md) · [PARTNER_PLATFORM_API.md](PARTNER_PLATFORM_API.md) · [api-and-routes.md](api-and-routes.md)
Skills with the deeper conventions: `admin-panel`, `partner-platform`, `seo`, `angular-conventions`.

---

## Contents

1. [Shell, auth & access control](#1-shell-auth--access-control)
2. [Shared patterns every section follows](#2-shared-patterns-every-section-follows)
3. [Dashboard](#3-dashboard--admindashboard)
4. [SEO](#4-seo--adminseo)
5. [Leads](#5-leads--adminleads)
6. [Create User / User Onboarding](#6-create-user--user-onboarding--adminuser-onboarding)
7. [Vendor Users](#7-vendor-users--admindomain-users)
8. [User Report](#8-user-report--adminreportsuser-report)
9. [Partner Platform](#9-partner-platform)
10. [Admin Users](#10-admin-users--adminadmin-users)
11. [Roles & Permissions](#11-roles--permissions--adminroles-permissions)
12. [Cross-cutting: security, known gaps, verification](#12-cross-cutting)

---

## 1. Shell, auth & access control

### 1.1 File map

```
src/app/admin/
├── admin.routes.ts                       route tree + every permissionGuard
├── layout/
│   ├── admin-layout/                     sidebar + topbar + <router-outlet>
│   ├── admin-sidebar/                    permission-filtered nav, user menu, logout
│   └── admin-topbar/                     breadcrumbs derived from the URL
├── shared/
│   ├── guards/{admin-auth,admin-guest,permission}.guard.ts
│   ├── directives/has-permission.directive.ts
│   ├── utils/admin-landing.ts            adminLandingPath()
│   ├── components/{admin-login,forbidden}/
│   └── pages/{admin-forgot-password,admin-reset-password}/
├── dashboard/                            landing tiles
├── seo/                                  seo_pages console
├── leads/                                firm inquiries
├── user-onboarding/                      create/edit learner users (Django internal API)
├── users/                                "Vendor Users"
├── user-report/                          per-user course/credit report
├── coupon-tracker/                       Partner Code Tracker
├── partner-platform/                     super-admin + network-admin surfaces
├── admin-users/                          admin account provisioning
└── roles-permissions/                    RBAC editor

src/app/shared/core/services/admin-auth/admin-auth.ts
src/app/shared/core/models/admin/{admin-auth,admin-rbac}.model.ts
src/app/shared/core/interceptors/admin-token/
```

### 1.2 Auth flow

| Step                 | Route                    | Guard                                 | What happens                                                                                                              |
| -------------------- | ------------------------ | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Sign in              | `/admin/login`           | `adminGuestGuard`                     | Supabase email/password via `AdminAuth`. Session persisted by the Supabase client.                                        |
| Anything else        | `/admin/**`              | `adminAuthGuard` (on the shell route) | `AdminAuth` exposes `adminUser()`, `permissions()`, `roleSlug()`, `emailDomains()`, `hasPermission()`, `hasAny()`.        |
| Index / unknown      | `/admin`, `**`           | —                                     | `redirectTo: () => adminLandingPath(inject(AdminAuth))`.                                                                  |
| Forgot password      | `/admin/forgot-password` | `adminGuestGuard`                     | Sends a Supabase recovery mail.                                                                                           |
| Reset password       | `/admin/reset-password`  | **none, deliberately**                | The user arrives carrying a recovery session; the page itself requires that session. Adding a guard here breaks recovery. |
| No usable permission | `/admin/forbidden`       | —                                     | Terminal page reached from `adminLandingPath` or a failed `permissionGuard`.                                              |

`AdminAuth` is **not** the learner `Auth` service: no shared tokens, no shared state, no interaction with the learner refresh flow.

### 1.3 Landing resolution

[`adminLandingPath`](../src/app/admin/shared/utils/admin-landing.ts) walks an ordered list and returns the first route the signed-in admin has permission for:

```
dashboard:view              → /admin/dashboard
reports:users:read          → /admin/domain-users
reports:courses:read        → /admin/reports/courses
reports:user_report:read    → /admin/reports/user-report
users:create                → /admin/user-onboarding
seo:read                    → /admin/seo
leads:read                  → /admin/leads
partner:platform:manage     → /admin/partner/networks
partner:platform:read       → /admin/partner/dashboard
partner:tracker:read        → /admin/partner-code-tracker
partner:users:read          → /admin/domain-users
                     (none) → /admin/forbidden
```

Both `''` and `**` route through it, so a partner-only or reports-only admin never lands on a page they can't see, and a static `/admin/dashboard` redirect can't loop into `/admin/forbidden`.

### 1.4 RBAC model

Permission strings live in [`PERM`](../src/app/shared/core/models/admin/admin-rbac.model.ts). **Never hardcode a string** — always `PERM.X`.

| Group                                | Keys                                                                                                                                                                             |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard                            | `dashboard:view`                                                                                                                                                                 |
| SEO                                  | `seo:read`, `seo:write`, `seo:delete`                                                                                                                                            |
| Leads                                | `leads:read`, `leads:write`, `leads:export`                                                                                                                                      |
| Reports                              | `reports:users:read`, `reports:users:block`, `reports:user_report:read`                                                                                                          |
| Partner Platform (coarse page gates) | `partner:platform:read` (Miles ops dashboard), `partner:tracker:read` (network admin), `partner:users:read` (sub-company admin), `partner:platform:manage` (super-admin console) |
| Administration                       | `admin:users:manage`, `admin:roles:manage`, `admin:permissions:manage`                                                                                                           |
| User onboarding                      | `users:create`                                                                                                                                                                   |

**Roles** — one per sidenav section; an admin may hold **several**, and their permissions are the union (per-user denies in `admin_user_permissions` still win). Catalog after `20260908000000_multi_role_admins.sql`:

| Slug                       | Section                    | Permissions                                                                              |
| -------------------------- | -------------------------- | ---------------------------------------------------------------------------------------- |
| `super_admin` (system)     | everything                 | SQL short-circuit — every key, un-deniable                                               |
| `seo_manager`              | Content → SEO              | `dashboard:view`, `seo:*`                                                                |
| `leads_manager`            | People → Leads             | `dashboard:view`, `leads:*`                                                              |
| `reports_viewer`           | Reports → User report      | `dashboard:view`, `reports:user_report:read`                                             |
| `partner_platform_admin`   | Partner v2 — Super Admin   | `dashboard:view`, `partner:platform:manage`, `partner:platform:read`, `users:create`     |
| `partner_network_admin`    | Partner v2 — Panel         | `partner:tracker:read`                                                                   |
| `partner_subcompany_admin` | Partner v2 — Panel (Users) | `partner:users:read`                                                                     |
| `admin_manager`            | Administration             | `dashboard:view`, `admin:users:manage`, `admin:roles:manage`, `admin:permissions:manage` |

The four Django-mapped slugs (`super_admin`, `partner_platform_admin`, `partner_network_admin`, `partner_subcompany_admin`) are **mutually exclusive** — Django keeps one `PartnerAdmin` row per login — enforced by `toggleRoleSlug()` in the UI and `assert_admin_role_set()` in both RPCs. `AdminAuth` exposes `roles()` / `roleSlugs()`; `isSuperAdmin()` is `roleSlugs().includes('super_admin')`. The profile RPC returns `roles[]` (and `role` = the first, for the mid-deploy window); the JWT hook emits `app_metadata.admin_roles[]` next to `admin_role`.

Enforcement layers, from outside in:

1. **`permissionGuard(...perms)`** on `canMatch` — **OR** semantics. That's how one route serves several roles (`partner-v2/panel/users` serves Miles reports staff, network admins and sub-company admins).
2. **`hasPermission` directive** — UI only. Hiding a button is not authorisation. Admin permission blocks intentionally have **no `else` branch**: an unpermitted user sees nothing, not an empty state implying data exists.
3. **Server** — Supabase RLS for Supabase-backed pages, Django checks (+ `PartnerAdmin.capabilities`) for API-backed pages.

### 1.5 Route → permission table

| Path                                                         | Permission (any of)                                                  | Component                                                              |
| ------------------------------------------------------------ | -------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `login` / `forgot-password` / `reset-password` / `forbidden` | — (guest / open)                                                     | `AdminLogin`, `AdminForgotPassword`, `AdminResetPassword`, `Forbidden` |
| `dashboard`                                                  | `dashboard:view`                                                     | `AdminDashboard`                                                       |
| `seo`                                                        | `seo:read`                                                           | `SeoDashboard`                                                         |
| `seo/bulk`                                                   | `seo:write`                                                          | `SeoBulkUpload`                                                        |
| `seo/edit/:slug`                                             | `seo:write`                                                          | `SeoEditor`                                                            |
| `leads`                                                      | `leads:read`                                                         | `Leads`                                                                |
| `user-onboarding` (+ `new`, `:id/edit`)                      | `users:create`                                                       | `UserOnboarding`, `UserForm`                                           |
| `domain-users`                                               | `reports:users:read` · `partner:tracker:read` · `partner:users:read` | `Users`                                                                |
| `partner-code-tracker`                                       | `partner:platform:read` · `partner:tracker:read`                     | `CouponTracker`                                                        |
| `reports/user-report`                                        | `reports:user_report:read`                                           | `UserReport`                                                           |
| `partner/networks`                                           | `partner:platform:manage`                                            | `Networks`                                                             |
| `partner/networks/:id/tracker`                               | `partner:platform:read`                                              | `NetworkTracker`                                                       |
| `partner/partner-codes`                                      | `partner:platform:manage`                                            | `PartnerCodes`                                                         |
| `partner/dashboard`                                          | `partner:platform:read`                                              | `PartnerDashboard`                                                     |
| `admin-users`                                                | `admin:users:manage`                                                 | `AdminUsers`                                                           |
| `roles-permissions`                                          | `admin:roles:manage` · `admin:permissions:manage`                    | `RolesPermissions`                                                     |

### 1.6 Sidebar

[`AdminSidebar`](../src/app/admin/layout/admin-sidebar/admin-sidebar.ts) declares sections statically and filters them per user:

| Section                  | Items                                                                         |
| ------------------------ | ----------------------------------------------------------------------------- |
| Overview                 | Dashboard                                                                     |
| Content                  | SEO pages                                                                     |
| People                   | Leads                                                                         |
| Reports                  | User report                                                                   |
| Partner v2 — Super Admin | Networks · Firms · Partner Codes · Partner Admins · User Onboarding · Reports |
| Partner v2 — Panel       | Overview · Seat Tracker · Users · Reports                                     |
| Administration           | Admin Users · Roles & permissions                                             |

An item shows if the admin has **any** of its listed permissions. A section with zero visible items is dropped entirely. The footer user menu shows name / email / every role name and handles sign-out (`AdminAuth.signOut()` → `/admin/login`); Escape closes it.

Every `partner-v2/*` route sits under one componentless parent that **provides** the partner facades (`PartnerAdminMe`, `PartnerSuperAdminFacade`, `PartnerNetworkFacade`, `PartnerReportFacade`, `PartnerUsersFacade`); `leads`, `reports/user-report`, `admin-users` and `roles-permissions` provide their own. None of the admin facades is `providedIn: 'root'` any more: the route injector is destroyed on navigation, which aborts in-flight `resource()` loads and stops one page's calls firing while you're on another. Dialogs that inject a route-scoped facade are opened with `environmentInjector: inject(EnvironmentInjector)`.

The topbar derives the page title and breadcrumbs from the current URL — no per-page wiring.

---

## 2. Shared patterns every section follows

### 2.1 Two data sources — pick the right one

| Source                                             | Used by                                            | How                                                                                                                                                          |
| -------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Supabase tables** (RLS is the security boundary) | Leads, Admin Users, Roles & Permissions, SEO pages | `Supabase.getClient()` → `.from(table)` directly from the browser.                                                                                           |
| **Django REST**                                    | Vendor Users, User Report, Partner Platform        | `ApiClient` with `IS_ADMIN_REQUEST` in the `HttpContext` → `adminTokenInterceptor` attaches `Authorization: Bearer <supabase token>` + `X-Admin-Request: 1`. |
| **Django internal API**                            | User Onboarding                                    | `IS_ADMIN_REQUEST` **and** `SKIP_AUTH_TOKEN` + an `X-Internal-Api-Key` header — no bearer token at all.                                                      |

An admin call going out with the _learner_ token means the context token is missing.

### 2.2 Facade shape

Every list facade is built the same way:

- `resource()` for the load, params derived from filter signals so a filter change refetches;
- wrapped in `withPreviousValue` so rows stay on screen during a refetch instead of flashing empty;
- `linkedSignal` exposes `rows`/`users`, falling back to the previous value while loading;
- an `effect()` resets `pageNumber` to 1 whenever the search/filter changes (otherwise "page 3 of the old query" loads stale rows);
- `isBrowser` guard in `params` so nothing fetches during SSR;
- `abortSignal` → `takeUntil(fromEvent(abortSignal,'abort'))` so navigating away cancels in flight requests;
- mutations are `async` methods that toast success/failure through `NotificationService`, log through `Logger`, and call `reload()`.

Search inputs are debounced 300 ms in the component (`toObservable(signal).pipe(debounceTime(300), distinctUntilChanged())`), not in the facade.

---

## 3. Dashboard — `/admin/dashboard`

**Permission:** `dashboard:view`.

No data fetch. Reads `AdminAuth.adminUser()` for a greeting (`full_name`, else the local part of the email, else "there") and renders entry tiles. It exists so that a full-permission admin has a stable landing page; roles without `dashboard:view` never see it thanks to `adminLandingPath`.

---

## 4. SEO — `/admin/seo`

**Permissions:** `seo:read` (view) · `seo:write` (create/edit/bulk) · `seo:delete` (remove).
**Data:** Supabase `seo_pages` via `SupabaseSeo`.

### Flow

1. **Dashboard** (`seo`) — loads all pages into a signal, with:
   - free-text search over `page_name` + `page_slug`;
   - a `all | static | dynamic` type filter;
   - a per-page SEO score from `computeSeoScore` (completeness of title/description/OG/canonical);
   - actions: edit, delete (through a `UtilsDialog` confirm), new page (`createDefaultSeoPage`), bulk upload.
   - Load errors are surfaced in the template, not swallowed — a misconfigured Supabase key must not look like "no pages".
2. **Editor** (`seo/edit/:slug`) — title, meta description, keywords, canonical URL, Open Graph/Twitter fields, robots directives and JSON-LD. Save upserts the row.
3. **Bulk upload** (`seo/bulk`) — ingest many pages at once for large slug sets.

Ownership rules (static vs leaf-owned tags), the `SeoManager` lifecycle and the SSR `PendingTasks` gate are in the `seo` skill — the admin console only edits the source rows.

---

## 5. Leads — `/admin/leads`

**Permissions:** `leads:read` · `leads:write` · `leads:export` (three distinct permissions gating the route and the UI).
**Data:** Django `partners/superadmin/leads/` ([`LEADS_API.md`](LEADS_API.md)) via [`LeadsFacade`](../src/app/admin/leads/shared/services/leads-facade.ts), with the Supabase admin token attached by `adminContext()`.

> The API authorises **super-admins only**, independently of the Supabase `leads:*` permissions that gate the route. A `leads_manager` who is not a super-admin reaches the page and sees the server's 403 in the error banner — a backend gap, not a UI one.

### Row shape (`FirmInquiry`)

`id`, `full_name`, `email`, `firm_name`, `job_role`, `help_type` (string array), `enquiry_type`, `keep_updated`, `status`, `notes`, `created_at`, `updated_at`.
`status ∈ new | contacted | converted | closed`; the filter adds `all`.

### Flow

1. **List** — 30 rows/page (`?page&page_count`), `?status=` omitted for `all` and `?search=` omitted when blank; `hasPrev`/`hasNext` read `pagination_data.previous_page`/`next_page`. Filter changes reset to page 1 via `linkedSignal`.
2. **Update status / notes** — inline select and the expandable notes editor both call `PATCH /<id>/` with `{ status }` or `{ notes }` (`leads:write`). The API returns the updated lead, which replaces the row in place — no refetch. Failure toasts the DRF message and leaves the row untouched.
3. **Export CSV** (`leads:export`) — `GET /export-csv/` with the current filters, server-rendered, no pagination; saved via the shared `saveBlob` + `fileNameFromContentDisposition` helpers.

---

## 5b. Audit log — `/admin/audit-log`

**Permission:** `audit:read` (read-only — the table has no write policy at all).
**Data:** Supabase `admin_audit_log`, read directly; RLS gates it.

Records every admin action in two tiers, labelled per row by `source`:

| `source`  | Covers                                             | Trust                                                                                            |
| --------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `trigger` | The 8 Supabase tables (`admin_*`, `seo_pages`)     | Written by Postgres on the committed write. Unbypassable, and catches dashboard edits too.       |
| `client`  | Django API calls, page views, auth events, exports | Actor and timestamp stamped server-side from `auth.uid()`; the action itself is client-asserted. |

Capture points: `audit_row_change()` triggers (tier 1); `adminTokenInterceptor`,
`AdminLayout` navigation and `AdminAuth` sign-in/out (tier 2, via the
`log_admin_activity` RPC — the app has no INSERT grant).

Retention is **indefinite by decision**; there is no purge job. Growth is bounded
in practice by ~15 active admins. If it ever matters, partition by month on
`occurred_at` rather than adding deletes — the immutability is the point.

Known gaps: a write rejected by RLS leaves no trigger row (triggers only see
commits); the Django half is best-effort until the backend logs server-side.

---

## 6. Create User / User Onboarding — `/admin/user-onboarding`

**Permission:** `users:create` (one gate for the whole section).
**Data:** Django **internal** APIs — `X-Internal-Api-Key` header, `SKIP_AUTH_TOKEN`, no bearer. Paths are relative so `ApiClient` resolves them against `BASE_API_URL`.
**Facade:** [`UserOnboardingFacade`](../src/app/admin/user-onboarding/shared/services/user-onboarding-facade.ts), **provided on the componentless parent route** so the list and the form share one instance and reference data is fetched once.

### Endpoints

| Purpose         | Call                                                                                                                                                |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| List users      | `GET internal/users/` (`page`, `search`)                                                                                                            |
| Create          | `POST internal/onboard-user/`                                                                                                                       |
| Update          | `PATCH internal/update-user/`                                                                                                                       |
| Offline payment | `POST payment/internal/offline-invoice-payment/` (multipart)                                                                                        |
| Partner codes   | `GET promotion/partner-codes/`                                                                                                                      |
| Reference lists | `GET professions/`, `user/professional-course/`, `user/state-boards/`, `countries/`, `experiences/`, `user/job-sectors/`, `user/companies/?search=` |

### Flow A — list

`internal/users/` paged + debounced search; the search effect resets to page 1. Rows expose edit and "record payment" actions plus `is_subscribed`.

### Flow B — create (`new`)

Full-page form (`UserForm`) built on `@angular/forms/signals` (`form()` + `required`/`validate`).

| Group                | Fields                                                                                                                                                                  |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity             | `email` (required + regex), `first_name`, `last_name` (required)                                                                                                        |
| Contact              | `country_code`, `mobile` (required), `location`                                                                                                                         |
| Plan                 | `partner_code` (required; options are active codes, pre-selected to the "Creator" code via a case-insensitive match on code/description)                                |
| Profile              | `country_selected` (required, numeric id), `profession` (required), `professional_courses[]`, `state_board[]`, `qualification_status`, `license_status`                 |
| Corporate (optional) | `company_id` (typeahead on `user/companies/`), `sector_id`, `job_role_id` (roles nested under the selected sector — one `job-sectors` call feeds both), `experience_id` |
| Flags                | `is_currently_working`, `terms_accepted`, `sms_consent`                                                                                                                 |

Submit → `POST internal/onboard-user/`. `{ status: false }` is treated as failure and shows the backend `message`; success toasts and reloads the list.

### Flow C — edit (`:id/edit`)

Same component (`isEdit` from the `:id` param). Prefill comes from the list row passed via **router state** — there is no get-by-id endpoint. A cold deep link falls back to `findLoadedUser(id)`, which only finds users on the currently loaded page; otherwise `missingUser` is set and the form explains it can't prefill.

The list shape differs from the write payload — `country_selected` returns a display **name** but is sent as a numeric **id**, and the corporate FKs come back as `company`/`sector`/`job_role` rather than `*_id`. Prefill maps best-effort. Submit → `PATCH internal/update-user/` with `user_id`.

### Flow D — record offline payment

`RecordPaymentDialog` → pick an invoice file → `FormData { user_id, invoice }` → `POST payment/internal/offline-invoice-payment/`. No manual `Content-Type` (the browser must set the multipart boundary). The response carries `order_id`, `transaction_id`, `payment_id`, `amount_paid`, `subscription_status`, `receipt_url`; the toast reports the resulting subscription status and the list reloads.

### Open backend dependencies

Marked `TODO(open dep)` in the code — resolve before this ships wide:

- `countries/` and `experiences/` paths are not called anywhere else in the app; an empty result silently yields an empty dropdown.
- The exact partner code that represents the "Creator" plan (currently a `/creator/i` heuristic).
- Whether `payment/internal/offline-invoice-payment/` really sits under `/api/` or at the host root.
- The accepted enum values for `qualification_status` / `license_status` (the web profile uses `yes|no|na`; the onboard examples use `completed|na` and `licensed`).

---

## 7. Vendor Users — `/admin/domain-users`

**Permissions:** `reports:users:read` (Miles reports staff) · `partner:tracker:read` (network admin) · `partner:users:read` (sub-company admin) — one page, three audiences.
**Data:** Django `/api/reports/partner-admin/users/` via [`PartnerUsersFacade`](../src/app/admin/users/shared/services/partner-users-facade/partner-users-facade.ts).

Scope is derived from the signed-in admin, not from the UI: `report_type` and the admin's `email_domains` (joined comma-separated) are sent with the request, so each role only ever receives its own users.

### Row shape (`PartnerUser`)

Identity (`name`, `email`, `phone`, `professional_qualification`, `state_board`, `date_of_signup`, `date_of_login`, `is_blocked`) plus eight metrics — CPE courses completed/in progress, CPE credits earned/in progress, CAiRA credits earned/in progress, preview courses completed/in progress — each paired with a `*_ids` bucket (`masterclass_id`, `podcast_id`, `nano_learning_id`) for drill-down.

### Flow

1. **List** — paged (`pagination_data.next_page`/`previous_page` are **full URLs** here, unlike the coupon endpoints' page numbers), debounced search, blocked-status tabs (`all | active | blocked`).
2. **Block / unblock** (`reports:users:block`) — confirm dialog → `POST .../block-status/ { is_blocked, reason? }` → optimistic row update on `{ status: true }`.
3. **Export CSV** — `GET .../export-csv/` as a `Blob`, downloaded client-side. Server-generated, unlike the Leads export.

---

## 8. User Report — `/admin/reports/user-report`

**Permission:** `reports:user_report:read`.
**Data:** Django, endpoints in `USER_REPORT_ENDPOINTS` — `reports/user-report/`, `reports/user-report-export-csv/`, `reports/user-course-detail/`. Facade: [`UserReportFacade`](../src/app/admin/user-report/shared/services/user-report-facade.ts).

Row shape matches `PartnerUser` (same reporting backend) minus the block flag: identity + the eight metrics and their `*_ids` buckets. Page size is 30 (the API default); `parseNextPage` normalises the API's next/prev links into page numbers.

### Flow

1. **List** — search + pagination with a computed page window for the pager.
2. **Drill into a metric** — clicking a metric cell calls `getCourseDetail(ids)` → `POST reports/user-course-detail/` with the bucket → opens `UserCourseDetailDialog` labelled with the metric (`CourseDetailCategory`, e.g. "CPE Credits Earned"). Each `CourseDetail` carries `title`, `completed_on`, `cpe_credits`, `course_type`, `is_caira_course`, `caira_level`.
   - `hasCourseIds()` decides whether a cell is clickable at all — that guard is what prevents the "No course data" toast on empty buckets.
   - **All courses** merges every bucket with `mergeCourseIds()` and opens the same dialog.
3. **Export CSV** — `GET reports/user-report-export-csv/` as a `Blob`, with an `isExporting` flag driving the button state.

---

## 9. Partner Platform

> Full screen-by-screen walkthrough, provisioning flows, local mock setup and the
> current gap list: **[B2B_ADMIN.md](B2B_ADMIN.md)**. The summary below stays here
> for continuity with the rest of this doc.

B2B network licensing. **Two RBAC layers stack here:**

- **Supabase `PERM`** — coarse, decides which _pages_ exist for you (`partner:platform:manage` / `:read` / `tracker:read` / `users:read`).
- **Django `PartnerAdmin.capabilities`** — fine-grained, decides which _actions_ you get. Fetched once by [`PartnerAdminMe`](../src/app/admin/partner-platform/shared/services/partner-admin-me.ts) from `GET /partner-admin/me/` and read as `me.can('coupon:send')`, `me.isNetworkAdmin()`, `me.isFirmAdmin()`, `me.network()`, `me.firm()`.

Capabilities: `report:network:read`, `report:firm:read`, `coupon:usage:read`, `coupon:send`, `user:block`, `code:create:network`, `code:create:firm`.
Django roles: `super | network | firm`.

Every request sets `adminContext()` (`IS_ADMIN_REQUEST`). Errors are unwrapped with `partnerErrorMessage` / `partnerLoadError`, because `HttpErrorResponse.message` is Angular's generic text — the real reason lives on `err.error.message`.

> **Sub-company ≠ standalone firm.** A sub-company belongs to a network and is created from the code tracker; a standalone firm has `network === null` and is created from the Networks page. Their admins are provisioned through different roles.

### 9a. Super admin (`partner:platform:manage`) — [`PartnerSuperAdminFacade`](../src/app/admin/partner-platform/shared/services/partner-superadmin-facade.ts)

| Page                           | Flow                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `partner/networks`             | List networks (`name`, `slug`, `total_seats`, `allocated`, `unallocated`, `is_active`). **Create** → `POST /superadmin/networks/`. **Edit** → `PATCH` (`name`, `total_seats`, `is_active`, or `allocations` — passing allocations mints coupons directly into the network pool with `coupon.firm === null`, the only way network-level coupons exist; the response reports `coupons_minted`). **Firms dialog** → member firms of the network, plus a separate **standalone firms** view. **Tracker** → navigates to the per-network tracker. |
| `partner/networks/:id/tracker` | `GET /superadmin/networks/<id>/` → `summary` stat cards (seats, allocated, unallocated, used, available, shared, applied, expired) + `sub_companies`, with the network's coupon list below.                                                                                                                                                                                                                                                                                                                                                  |
| `partner/partner-codes`        | List + **create** partner codes (`code`, `discounted_price`, `auto_subscribe`, scoped to a network **or** a firm — never both; omit both for a global code). Partner codes are the plan/price templates coupons are minted from.                                                                                                                                                                                                                                                                                                             |
| Firm creation                  | `POST /superadmin/firms/` — `network_id` omitted creates a **standalone** firm (uncapped, no network); included creates a member firm and draws from the network's unallocated seats. `allocations` is optional (mint later).                                                                                                                                                                                                                                                                                                                |

### 9b. Partner dashboard — `partner/dashboard` (`partner:platform:read`)

Seat/coupon totals from `GET /partner-admin/dashboard/`. A network admin gets `NetworkDashboardStats` (with `total_seats`/`unallocated`); a firm admin gets `FirmDashboardStats` (own firm, no seat pool).

### 9c. Partner Code Tracker — `partner-code-tracker` — [`CouponTracker`](../src/app/admin/coupon-tracker/coupon-tracker.ts)

**Permissions:** `partner:tracker:read` (network/firm admins) or `partner:platform:read` (Miles ops). Backed by [`PartnerNetworkFacade`](../src/app/admin/partner-platform/shared/services/partner-network-facade.ts) → `GET /partner-admin/coupons/`, 20/page.

- Panel title = network name (network admin) or firm name (firm admin).
- Status tabs: `all | available | shared | applied | expired`; debounced search; firm filter for network admins (a firm admin is pinned to their own firm, and the per-row firm column only appears when not pinned).
- Coupon row: `code`, `purchase_cost`, `expiry_date` (null renders `—`, not a blank), `status`, `sent_to_email`, `shared_on`, `applied_on`, `applied_by`, `firm`.

**Actions and their gates**

| Action                             | Gate                                                                                                                                                |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Send / resend a coupon to an email | capability `coupon:send` → `POST /partner-admin/coupons/<id>/send/ { email }`                                                                       |
| Create sub-company                 | capability `code:create:firm` **and** `role === 'network'` — a firm admin gets 403 regardless of capabilities, so the button is never shown to them |
| Everything else                    | read-only                                                                                                                                           |

**Create sub-company — three sequential creations, stop on first failure** (each step raises its own error toast):

1. `POST /partner-admin/sub-companies/` — the firm (`name`, `email_domain`) + its coupon `allocations` (partner code + count + optional expiry). Network is derived server-side from the caller.
2. `provision_admin_user` Supabase RPC — the sub-company admin's login, role slug `partner_subcompany_admin`, domains `[email_domain]`.
3. `POST /superadmin/partner-admins/` — the Django partner admin, `role: 'firm'`, bound to the new firm, capabilities `['report:firm:read', 'user:block']`.

On success the toast hands the operator the initial password (`INITIAL_ADMIN_PASSWORD = 'Miles@12345'`) to pass on. Steps 2–3 can be re-run later from Admin Users if the operator stops halfway.

---

## 10. Admin Users — `/admin/admin-users`

**Permission:** `admin:users:manage`.
**Data:** Supabase — [`AdminUsersFacade`](../src/app/admin/admin-users/shared/services/admin-users-facade.ts) loads `admin_roles`, `admin_permissions`, `admin_role_permissions` and `admin_users` in one resource; `admin_user_email_domains` for domain scoping.

### Flow A — list

Admins with their role chips, active flag, email domains, created/last-login dates. `currentUserId` is used to stop an admin disabling or deleting themselves.

- **Roles** → `EditAdminRolesDialog` (partner roles radio-exclusive, `super_admin` locked unless the caller is one and never removable from yourself) → the `set_admin_user_roles` RPC, which also refuses to strand the app without an active super admin.
- **Register partner admin** → the same form in register-only mode: no Supabase provisioning, just `POST /superadmin/partner-admins/` for an existing login that already holds a partner role (how today's super admin gets its Django `super` row).
- **Toggle active** → `update({ is_active })` on `admin_users`.
- **Edit domains** → native `prompt()`, parsed on commas/whitespace, deduped and lowercased, then replaced in `admin_user_email_domains`. Marked `ponytail:` — build a dialog if it ever grows a second field.
- **Delete** → confirm, then the `delete_admin_user` RPC (removes the auth user and its RBAC rows server-side).

### Flow B — provision a new admin

Deep-linkable with `?provision=1` (used by hand-offs from the partner flows).

1. **Email + full name** (email validated client-side), optional **email domains**, optional **report type** (stored on `admin_users.report_type`, scopes Vendor Users).
2. **Roles** — a checkbox per `admin_roles` row (`toggleRoleSlug()` keeps the partner roles radio-exclusive; `super_admin` is disabled unless the caller is one). The permission checklist is seeded from the **union** of the selected roles' defaults via `linkedSignal`; the super-admin can then tick/untick freely. On submit the difference is split into `grants` (ticked beyond the defaults) and `denies` (defaults turned off).
3. **Partner scope + capabilities** — only when one of the roles is in `PARTNER_ROLE_MAP` (`admin-users/shared/utils/role-selection.ts`):

   | Supabase role slug                                         | Django role | Scope selector                                                   |
   | ---------------------------------------------------------- | ----------- | ---------------------------------------------------------------- |
   | `super_admin` (opt-in checkbox) / `partner_platform_admin` | `super`     | none                                                             |
   | `partner_network_admin`                                    | `network`   | networks **and** standalone firms (`network:<id>` / `firm:<id>`) |
   | `partner_subcompany_admin`                                 | `firm`      | member + standalone firms                                        |

   Binding a network-admin role to a _firm_ downgrades the Django side to `role: 'firm'`. Capabilities are a **picker** (`app-checkbox-list`) seeded from `CAPABILITY_DEFAULTS[effectiveRole]` — both `network` and `firm` defaults include `seat:usage:read`, without which the Seat Tracker is permanently "not enabled". Exactly one of `network_id`/`firm_id` is ever sent.

4. **Submit** → `provision_admin_user(p_role_slugs[], …)` RPC (creates the Supabase login + `admin_*` rows and returns the uid; permission-gated — `admin:users:manage` may provision any set, a `partner_network_admin` may provision exactly `['partner_subcompany_admin']`) → for partner roles, `POST /superadmin/partner-admins/` with the uid, role, scope and picked capabilities → success toast including the initial password.

`canSubmit` requires a valid email, at least one role, and — for partner roles — the scope that role demands.

---

## 11. Roles & Permissions — `/admin/roles-permissions`

**Permissions:** `admin:roles:manage` (role CRUD) · `admin:permissions:manage` (permission CRUD). The route accepts either; the page gates each half independently.
**Data:** Supabase `admin_roles`, `admin_permissions`, `admin_role_permissions` via [`RbacFacade`](../src/app/admin/roles-permissions/shared/services/rbac-facade.ts).

### Flow A — roles

Create/edit a role: `name`, `slug` (validated, kebab/snake), `description`, and a checkbox matrix of permissions grouped by category. Saving **replaces** the role's rows in `admin_role_permissions` (delete-then-insert) rather than diffing. `is_system` roles are protected from deletion. Delete goes through an inline pending-delete confirm.

### Flow B — permissions

Create/edit/delete a permission: `key` (validated, the string that ends up in `PERM`), `category` (drives the grouping everywhere else), `label`, `description`.

> Changing a role here changes what **every** holder of that role can reach, immediately for new sessions. Never widen a role as a side effect of unrelated work — and adding a permission row here still requires a matching `PERM` constant and a guard in code before it does anything. Assigning roles to people lives on **Admin Users**, not here.

---

## 12. Cross-cutting

### 12.1 Security checklist for new admin work

1. Every new admin route gets a `permissionGuard`. A missing one is a security bug, not a TODO.
2. `hasPermission` **hides**; the guard and the server **authorise**. Never rely on the directive alone.
3. Admin lists contain user PII — no logging of rows, no PII in URLs or query strings.
4. Exports leave the system: a new export needs its own permission and an explicit decision, not a reused read permission.
5. Django admin calls must set `IS_ADMIN_REQUEST`; internal-API calls must also set `SKIP_AUTH_TOKEN` and send `X-Internal-Api-Key`.
6. Provisioning flows create real logins with a **static initial password** — always surface it to the operator with "ask them to change it", never email it from the client.
7. Never widen a role's permission set as a side effect of an unrelated change.

### 12.2 Known gaps

- **User Onboarding open deps** — see [§6](#open-backend-dependencies).
- **Leads export** is capped at 5 000 client-side rows.
- **Edit user** can't prefill on a cold deep link (no get-by-id endpoint).

### 12.3 Verify locally

```bash
pnpm start
```

At `http://localhost:4101/admin`:

1. Signed out → `/admin` redirects to login; `/admin/dashboard` is unreachable.
2. Sign in as a **limited-permission** admin — `adminLandingPath` lands them somewhere they can actually see.
3. Deep-link a route they lack permission for → `/admin/forbidden`, not a broken page.
4. Gated buttons are hidden **and** their routes blocked.
5. Network tab: admin calls carry the admin token (`X-Admin-Request: 1`); user-onboarding calls carry `X-Internal-Api-Key` and **no** `Authorization`; learner calls carry the learner token.
6. `roles-permissions` — change a role, re-login, confirm the reachable routes changed.
7. Recovery: request a reset link, open `/admin/reset-password` from it, complete it.
8. Partner flows: create a sub-company end to end and confirm all three steps landed (firm + coupons, Supabase login, Django partner admin).
