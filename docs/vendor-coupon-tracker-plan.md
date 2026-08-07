# Vendor & Coupon Tracker — Implementation Plan (Admin, miles-masterclass-v3)

## 1. Overview

Enable the Miles Masterclass team to onboard vendors (company/alliance), issue partner codes, and provision vendor admin credentials. Vendor admins get access to two pages: **Coupon Tracker** (new) and **Domain Users** (existing).

### End-to-end flow

| Step | Actor                  | Action                                                                                                                                                   |
| ---- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Miles Masterclass team | Add Vendor (company/alliance): name, type, contact person, email domain(s)                                                                               |
| 2    | Miles Masterclass team | Create Partner Code for the vendor (on request)                                                                                                          |
| 3    | Miles Masterclass team | Create Vendor Admin credential (email + temp password)                                                                                                   |
| 4    | Vendor Admin           | Logs in → sees Coupon Tracker + Domain Users                                                                                                             |
| 5    | Vendor Admin           | Coupon Tracker: view assigned coupons (masked code, expiry), send a coupon to an email, track shared/applied status, view applied user's progress report |
| 6    | Vendor Admin           | Domain Users: existing feature (view/block users of own domain)                                                                                          |

## 2. Roles & permissions (RBAC)

New role: `vendor_admin`.

New keys in `src/app/shared/core/models/admin/admin-rbac.model.ts`:

```ts
VENDORS_READ: 'vendors:read',
VENDORS_WRITE: 'vendors:write',            // Miles team only
PARTNER_COUPONS_READ: 'partner:coupons:read',
PARTNER_COUPONS_SHARE: 'partner:coupons:share',
PARTNER_COUPONS_MANAGE: 'partner:coupons:manage',  // Miles team: assign/import
```

`vendor_admin` role gets: `partner:coupons:read`, `partner:coupons:share`, `reports:users:read`, `reports:users:block` (existing Domain Users perms), scoped by vendor + email domains.

## 3. Data model (Supabase migration)

- `vendors`: id, name, type ('company' | 'alliance'), contact_name, contact_email, contact_phone, email_domains text[], status, created_at, created_by
- `partner_codes`: id, vendor_id FK, code (unique), status ('active' | 'revoked'), created_at, created_by — history kept, one active per vendor
- `vendor_coupons`: id, vendor_id FK, coupon_code_encrypted, code_last4, purchase_cost, expiry_date, status ('available' | 'shared' | 'applied' | 'expired'), shared_to_email, shared_at, applied_by_email, applied_by_user_id, applied_at, created_at
- `coupon_share_logs`: id, coupon_id FK, sent_to_email, sent_by, sent_at (resend history / audit)
- `admin_user_vendors`: user_id, vendor_id — scopes a vendor admin to their vendor (same pattern as `admin_user_email_domains`)
- RLS: vendor admins see only their vendor's rows; super_admin sees all.

## 4. Backend APIs (Django)

- `GET/POST/PATCH partners/vendors/` — vendor CRUD (Miles team)
- `POST partners/vendors/{id}/partner-code/` — generate/rotate partner code
- `POST partners/coupons/import/` — bulk assign coupons to a vendor (codes, cost, expiry)
- `GET partners/coupons/?status=&search=&page=` — vendor-scoped list (vendor admin) / all vendors (Miles team)
- `POST partners/coupons/{id}/share/ {email}` — decrypt code server-side, send email, set status=shared, shared_at, shared_to_email; write `coupon_share_logs`
- Hook in existing `promotion/coupons/apply_coupon/` — if code belongs to `vendor_coupons`, set status=applied, applied_at, applied_by_email/user_id
- `GET partners/coupons/{id}/applied-user-progress/` — progress payload for the applied user (reuse `reports/user-report` data shape)

## 5. Frontend (Angular 21 admin)

### 5.1 Vendors page — Miles team (`/admin/vendors`)

- List with search, status filter, pagination
- Add/Edit Vendor dialog (name, type, contact, domains)
- Row actions: Generate Partner Code (copy to clipboard), Assign Coupons (bulk dialog), Create Vendor Admin (dialog → `buildAdminUserSql` pattern with role `vendor_admin` + vendor scope + email domains)
- Files: `src/app/admin/vendors/` → `vendors.ts/html/css`, `shared/models/vendor.model.ts`, `shared/services/vendors-facade.ts`, `shared/components/{vendor-form-dialog, assign-coupons-dialog}`

### 5.2 Coupon Tracker — Vendor admin (`/admin/coupon-tracker`)

Table columns:

| Column          | Behaviour                                                                         |
| --------------- | --------------------------------------------------------------------------------- |
| Coupon Code     | Masked, e.g. `•••2323` (encrypted at rest; full code only in the recipient email) |
| Purchase Cost   | e.g. $299 / $599                                                                  |
| Expiry Date     | Validity end; expired rows greyed                                                 |
| Status          | Chip: Available / Shared / Applied / Expired                                      |
| Send To         | Email input + **Send** button (only while Available)                              |
| Shared On / To  | Shared date + recipient email (after send) + Resend                               |
| Applied On / By | Applied date + user email, auto-captured on redemption                            |
| Progress        | Eye icon next to applied user email → **User Progress dialog**                    |

- User Progress dialog: name, email, signup/last login, courses completed & in progress with per-course details — reuse `user-course-detail-dialog` pattern + user-report endpoint
- Filters: All / Available / Shared / Applied / Expired; search by code last4 or email
- Facade with signals + `resource()`, optimistic patch on share (same as `PartnerUsersFacade`)
- Files: `src/app/admin/coupon-tracker/` → `coupon-tracker.ts/html/css`, `shared/models/vendor-coupon.model.ts`, `shared/services/coupon-tracker-facade.ts`, `shared/components/{share-coupon-cell, user-progress-dialog}`

### 5.3 Routing & sidebar

- `admin.routes.ts`: `vendors` (canMatch `permissionGuard(PERM.VENDORS_READ)`), `coupon-tracker` (`PERM.PARTNER_COUPONS_READ`)
- `admin-sidebar.ts` under Administration: "Vendors" (Miles team), "Coupon Tracker" (vendor admin); Domain Users already present

## 6. Email

Django template "Your Miles Masterclass coupon": full code, expiry, redemption steps. Logged in `coupon_share_logs`; resend supported.

## 7. Security & privacy

- Coupon codes encrypted at rest; UI shows last-4 mask only; decrypt only server-side when emailing
- Vendor scoping enforced at RLS and API layers
- PII (emails/phones) partly hidden with eye reveal — consistent with Domain Users
- Audit trail: share logs and applied events are immutable

## 8. Edge cases

- Expired coupon → Send disabled, status Expired
- Resend to same email allowed; sharing to a new email is logged (share log history)
- Coupon applied by a different user than the shared email → record the actual applier
- One active recipient per coupon (proposed)

## 9. Rollout phases

| Phase | Scope                                       | Est   |
| ----- | ------------------------------------------- | ----- |
| 1     | Migrations + RBAC (role, perms, RLS)        | 3–4 d |
| 2     | Vendors CRUD + partner code + APIs          | 3 d   |
| 3     | Vendor admin provisioning + scoping         | 2 d   |
| 4     | Coupon assignment + Coupon Tracker list     | 3 d   |
| 5     | Share-by-email flow + email template        | 2 d   |
| 6     | Apply hook + User Progress dialog           | 2–3 d |
| 7     | QA, UAT with pilot vendor, admin guide docs | 2 d   |

## 10. Open questions

1. Single or multiple active partner codes per vendor?
2. Multiple recipients per coupon, or one active recipient? (proposed: one)
3. Is purchase cost visible to the vendor admin? (proposed: yes)
4. Should an applied coupon ever be re-shareable? (proposed: no)
