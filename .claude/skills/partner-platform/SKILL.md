---
name: partner-platform
description: The B2B Partner Platform of Miles Masterclass v3 — network licensing, partner codes, firms and sub-companies, the dual RBAC model (Supabase PERM gates plus Django capabilities from /partner-admin/me/), and the super-admin vs network-admin vs firm-admin split. Read before touching admin/partner-platform or partner-code redemption.
---

# Partner Platform

B2B network licensing. Accounting **networks** (MGI, Allinial, …) license Miles CPE for their member **firms**; firms distribute access to their users via **partner codes**. Lives inside the admin panel — read the `admin-panel` skill first.

## Files

```
admin/partner-platform/
├── shared/
│   ├── models/partner-platform.model.ts
│   ├── services/
│   │   ├── partner-admin-me.ts              # who am I, what can I do
│   │   ├── partner-superadmin-facade.ts
│   │   ├── partner-network-facade.ts
│   │   ├── admin-provisioning.ts
│   │   └── partner-mock-interceptor.ts
│   └── components/stat-card/
├── super-admin/
│   ├── networks/            + network-form-dialog, network-firms-dialog
│   ├── partner-codes/       + create-partner-code-dialog
│   └── network-tracker/
└── network-admin/dashboard/partner-dashboard.ts

admin/coupon-tracker/                        # partner code tracker
admin/users/                                 # "Vendor Users"
shared/core/services/partner-code/           # learner-side redemption
docs/PARTNER_PLATFORM_API.md
```

## Two RBAC models, layered

This is the thing to get right.

**1. Supabase `PERM` — coarse, page-level.** Decides which admin routes exist for you:

| `PERM`                    | Role                                                          |
| ------------------------- | ------------------------------------------------------------- |
| `PARTNER_PLATFORM_MANAGE` | Miles super-admin — networks, partner codes, provisioning     |
| `PARTNER_PLATFORM_READ`   | Miles ops — partner dashboard, network tracker                |
| `PARTNER_TRACKER_READ`    | Network admin — code tracker + vendor users, **no** dashboard |
| `PARTNER_USERS_READ`      | Sub-company (firm) admin — vendor users **only**              |

**2. Django capabilities — fine-grained, per-action.** Surfaced by `GET /partner-admin/me/` and consumed through `PartnerAdminMe`:

```
report:network:read   report:firm:read
coupon:usage:read     coupon:send
user:block
code:create:network   code:create:firm
```

`PERM` gates the **page**; capabilities gate the **action inside it**. Both are required. A capability check with no route guard leaves the page reachable; a route guard with no capability check leaves the button live.

## PartnerAdminMe

```ts
isLoading  isPartnerAdmin
role: 'super' | 'network' | 'firm' | null
network: PartnerNetworkRef | null
firm: PartnerFirmRef | null
isNetworkAdmin  isFirmAdmin
can(capability: string): boolean
reload()
```

Backed by `resource()` — so it cancels on navigation, unlike a plain subscribe. Browser-only.

**Gate every partner action on `can(...)`.** Don't infer a capability from `role`: role follows _scope_, capabilities are granted per admin. A network admin without `coupon:send` must not see the send button.

## Sub-company vs standalone firm

Different things. Don't merge them:

- **Sub-company** — a firm _inside_ a network. Provisioned through the partner-code tracker; its admin has `PARTNER_USERS_READ` and firm-scoped capabilities.
- **Standalone firm** — licensed directly, managed through the **networks** section.

The `partner-admin` role follows the scope (`network` vs `firm`); the capability set is always the network-defined set.

## Surfaces

| Route                          | Who                   |                                                                                     |
| ------------------------------ | --------------------- | ----------------------------------------------------------------------------------- |
| `partner/networks`             | super-admin           | Networks CRUD; `network-firms-dialog` manages member firms                          |
| `partner/partner-codes`        | super-admin           | Issue codes — `code:create:network` vs `code:create:firm` are separate capabilities |
| `partner/networks/:id/tracker` | Miles ops             | Per-network usage                                                                   |
| `partner/dashboard`            | Miles ops             | Network-admin dashboard, `stat-card` metrics                                        |
| `partner-code-tracker`         | network admin         | Code usage tracker                                                                  |
| `domain-users`                 | network + firm admins | Vendor users, scoped to the caller                                                  |

`admin-provisioning.ts` creates partner admins. Provisioning grants access to paid content — it is the most sensitive surface here. Never widen its capability set as a side effect of an unrelated change.

## API

Django `/partner-admin/...`, called with `ApiClient` and the **`IS_ADMIN_REQUEST`** `HttpContext` token so `adminTokenInterceptor` attaches the admin token. Contracts: `docs/PARTNER_PLATFORM_API.md`.

`PartnerApiError` is a typed error shape — surface the server's message rather than a generic one; partner admins need to know _why_ a code failed.

`partner-mock-interceptor.ts` serves fixtures while backend endpoints land. **Confirm whether it's active before debugging "wrong" data** — it will happily return plausible mock rows. Never ship it enabled.

## Learner-side redemption

`shared/core/services/partner-code/` + `dialog/partner-code-prompt-dialog`. Marketing pages **capture** a code; the server validates and grants. Never validate a code or grant access client-side. See the `partners` skill.

## Security

- Both layers, every time: `permissionGuard(PERM.*)` on the route, `can(capability)` on the action.
- Server-side scoping is the authority. A firm admin must not be able to widen their scope by editing a request param — never send a caller-supplied scope the server doesn't verify.
- Provisioning tokens and partner secrets never reach the browser.
- Partner data is another company's commercial data. No cross-network leakage: a network admin sees only their network, a firm admin only their firm.
- Blocking a user (`user:block`) is destructive to that person's access — confirm before wiring a one-click path.

## Verify

```bash
pnpm start   # → http://localhost:4100/admin
```

1. Sign in as each of the four roles — super-admin, Miles ops, network admin, firm admin.
2. Each lands somewhere they can see; each sees **only** their routes.
3. An admin missing `coupon:send` doesn't see the send action, and the route is blocked too.
4. Network admin sees only their own network's codes and users; firm admin only their firm's.
5. Create a network → add a firm → issue a partner code → confirm it appears in the tracker.
6. Redeem the code as a learner — access is granted server-side.
7. Confirm `partner-mock-interceptor` is **off** and the data is real.
8. Network tab: `/partner-admin/*` calls carry the admin token.
