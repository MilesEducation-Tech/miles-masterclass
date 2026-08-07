---
name: admin-panel
description: The admin panel of Miles Masterclass v3 — admin auth via Supabase, the PERM-based RBAC model, permissionGuard and hasPermission, the admin shell, and the users, leads, user-report, admin-users and roles-permissions modules. Read before touching anything under src/app/admin.
---

# Admin panel

Internal console at `/admin`. Entirely separate from the learner app: separate auth, separate token, separate layout, `RenderMode.Client` throughout (no SEO, nothing to server-render).

## Files

```
src/app/admin/
├── admin.routes.ts
├── layout/{admin-layout,admin-sidebar,admin-topbar}/
├── shared/
│   ├── guards/{admin-auth,admin-guest,permission}.guard.ts
│   ├── directives/has-permission.directive.ts
│   ├── utils/admin-landing.ts
│   ├── components/{admin-login,forbidden}/
│   └── pages/{admin-forgot-password,admin-reset-password}/
├── dashboard/admin-dashboard/
├── seo/                       → see the `seo` skill
├── partner-platform/          → see the `partner-platform` skill
├── leads/                     firm inquiries
├── users/                     "Vendor Users"
├── user-report/               per-user course reports
├── coupon-tracker/            partner code tracker
├── admin-users/               admin account management
└── roles-permissions/         RBAC editor

shared/core/services/admin-auth/admin-auth.ts
shared/core/models/admin/{admin-auth,admin-rbac}.model.ts
shared/core/interceptors/admin-token/
```

## Auth

`AdminAuth` + the **`Supabase`** client (persisted session — see the `supabase` skill). This is not the learner `Auth` service and does not share tokens or state with it.

- `adminGuestGuard` — login / forgot-password, signed-out only.
- `adminAuthGuard` — everything under the shell.
- `reset-password` has **no guard**: the user arrives with a recovery session and the page itself requires that session to do anything. Don't "fix" it by adding a guard — you'd lock out the recovery flow.

`adminLandingPath(AdminAuth)` decides where `/admin` lands, based on what the user can actually see. Both `''` and `**` redirect through it, so a permission-less user never lands on a forbidden page.

## RBAC

`PERM` in `shared/core/models/admin/admin-rbac.model.ts`:

```
dashboard:view
seo:read | seo:write | seo:delete
leads:read | leads:write | leads:export
reports:courses:read | reports:users:read | reports:users:block | reports:user_report:read
partner:platform:read | partner:tracker:read | partner:users:read | partner:platform:manage
admin:users:manage | admin:roles:manage | admin:permissions:manage
```

**Never hardcode a permission string.** Always `PERM.X`.

`permissionGuard(...perms)` on `canMatch` — **any** listed permission grants access (OR, not AND). That's how one route serves several roles:

```ts
{ path: 'domain-users',
  canMatch: [permissionGuard(PERM.REPORTS_USERS_READ, PERM.PARTNER_TRACKER_READ, PERM.PARTNER_USERS_READ)] }
```

`hasPermission` (`shared/directives/has-permission.directive.ts`) gates UI. It is **UX only** — hiding a button is not authorisation. Every gated action also needs a route guard and a server-side check.

Permission blocks in the admin have **no `else` branch** by design: an unpermitted user sees nothing, not an empty state implying data exists.

## Routes

| Path                                                | Permission                                                             |
| --------------------------------------------------- | ---------------------------------------------------------------------- |
| `dashboard`                                         | `DASHBOARD_VIEW`                                                       |
| `seo`, `seo/edit/:slug`, `seo/bulk`                 | `SEO_READ` / `SEO_WRITE`                                               |
| `leads`                                             | `LEADS_READ`                                                           |
| `domain-users`                                      | `REPORTS_USERS_READ` \| `PARTNER_TRACKER_READ` \| `PARTNER_USERS_READ` |
| `partner-code-tracker`                              | `PARTNER_PLATFORM_READ` \| `PARTNER_TRACKER_READ`                      |
| `reports/user-report`                               | `REPORTS_USER_REPORT_READ`                                             |
| `partner/networks`, `partner/partner-codes`         | `PARTNER_PLATFORM_MANAGE`                                              |
| `partner/networks/:id/tracker`, `partner/dashboard` | `PARTNER_PLATFORM_READ`                                                |
| `admin-users`                                       | `ADMIN_USERS_MANAGE`                                                   |
| `roles-permissions`                                 | `ADMIN_ROLES_MANAGE` \| `ADMIN_PERMISSIONS_MANAGE`                     |

## Two data sources

- **Supabase tables** → read directly from the client, RLS-enforced.
- **Django tables** → via `ApiClient`, tagged with the **`IS_ADMIN_REQUEST`** `HttpContext` token so `adminTokenInterceptor` attaches the admin token rather than the learner one.

An admin call going out with a learner token means the context token is missing.

## The modules

| Module               |                                                                                                                                                                              |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `leads/`             | Firm inquiries (`firm-inquiry.model.ts`) → `LeadsFacade` → `leads-table`. Read/write/export are three separate permissions.                                                  |
| `users/`             | "Vendor Users" — Miles reports staff, network admins **and** sub-company admins share this page, each seeing their own scope. `PartnerUsersFacade`, `partner-user.model.ts`. |
| `user-report/`       | Per-user course reports + `user-course-detail-dialog`.                                                                                                                       |
| `coupon-tracker/`    | Partner code tracker — network admins only; sub-company admins get Vendor Users instead.                                                                                     |
| `admin-users/`       | Admin account CRUD.                                                                                                                                                          |
| `roles-permissions/` | `RbacFacade` — the role/permission editor. Changing a role here changes what every holder can reach.                                                                         |
| `dashboard/`         | Landing metrics.                                                                                                                                                             |

## Security

- Every route gated by `permissionGuard`. A new admin route without one is a security bug, not a TODO.
- `hasPermission` hides; the guard and the server authorise.
- Admin lists contain user PII — no logging of rows, no PII in URLs or query strings.
- Exports (`leads:export`) leave the system. Confirm the permission and confirm intent before wiring a new one.
- Never widen a role's permission set as a side effect of an unrelated change.

## Verify

```bash
pnpm start   # → http://localhost:4100/admin
```

1. Signed out → `/admin` redirects to login; `/admin/dashboard` is unreachable.
2. Sign in as a **limited-permission** admin — `adminLandingPath` sends them somewhere they can actually see.
3. Deep-link a route they lack permission for → `/admin/forbidden`, not a broken page.
4. Gated buttons are hidden **and** their routes blocked.
5. Network tab: admin calls carry the **admin** token, learner calls carry the learner token.
6. `roles-permissions` — change a role, re-login, confirm the reachable routes changed.
7. Recovery: request a reset link, open `/admin/reset-password` from it, complete it.
