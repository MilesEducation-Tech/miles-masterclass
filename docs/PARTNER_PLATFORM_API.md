# Partner Platform API

Two audiences under `/api/partners/`:

| Base path                   | Who calls it                                         | Scope                                                            |
| --------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------- |
| `/api/partners/superadmin/` | Miles-internal ops                                   | Sees/acts on everything — every network, firm, code, admin, user |
| `/api/partners/panel/`      | Network admins & firm admins (Angular partner panel) | Auto-scoped to their own `network_id`/`firm_id`                  |

## Auth

Every endpoint uses `SupabaseJWTAuthentication` — send `Authorization: Bearer <supabase_access_token>`. The token identifies a Supabase login; scope/role comes from a `PartnerAdmin` row looked up by `supabase_uid`, **not** from anything in the token itself.

- **Superadmin endpoints**: require `PartnerAdmin.role == "super"` (`IsSuperAdmin`). 401 if the token itself is missing/invalid/expired, 403 if it's valid but not a super admin.
- **Panel endpoints**: require an active `PartnerAdmin` row, plus (per endpoint) a specific **capability** — a string in `PartnerAdmin.capabilities`. A valid token with no matching `PartnerAdmin` row still gets a real response, not a 401 — see `GET /panel/me/` below.

Known capability keys: `report:network:read`, `report:firm:read`, `seat:usage:read`, `seat:send`, `user:block`, `code:create:network`, `code:create:firm`.

## Pagination

Every paginated list uses the same envelope:

```json
{
  "total_count": 42,
  "current_page_number": 1,
  "next_page": 2,
  "previous_page": null
}
```

`next_page`/`previous_page` are page numbers, not URLs — `null` when there isn't one.

## Errors

Action endpoints (POST/PATCH) that fail validation return `{"status": false, "message": "..."}` with a 400/403/404/409 as appropriate. List/detail GETs use DRF's default error shape on 401/403.

---

# Superadmin API

Base: `/api/partners/superadmin/`

## Networks

### `GET|POST /networks/`

**GET** — list every network.

```json
{
  "networks": [
    {
      "id": 4,
      "name": "Allinial Global",
      "slug": "allinial-global",
      "total_seats": 100,
      "allocated_seats": 65,
      "unallocated_seats": 35,
      "used_seats": 40,
      "is_active": true
    }
  ]
}
```

**POST** — create a network.

| Field         | Type   | Required | Notes                          |
| ------------- | ------ | -------- | ------------------------------ |
| `name`        | string | yes      |                                |
| `slug`        | string | no       | defaults to a slugified `name` |
| `total_seats` | int    | no       | seat budget, default 0         |

Returns the created network object (same shape as above), `201`.

### `GET|PATCH /networks/<id>/`

**GET** — network detail + its firms.

```json
{
  "network": { "id": 4, "name": "Allinial Global", "...": "..." },
  "firms": [
    {
      "id": 12,
      "name": "Acme LLP",
      "network": { "id": 4, "name": "Allinial Global" },
      "is_standalone": false,
      "email_domain": "acme.com",
      "is_active": true,
      "allocated_seats": 8,
      "used_seats": 5
    }
  ]
}
```

**PATCH** — update fields and/or mint seats straight into the network's pool.

| Field         | Type   | Required | Notes                                                                                                            |
| ------------- | ------ | -------- | ---------------------------------------------------------------------------------------------------------------- |
| `name`        | string | no       |                                                                                                                  |
| `total_seats` | int    | no       | can't drop below seats already allocated                                                                         |
| `is_active`   | bool   | no       |                                                                                                                  |
| `allocations` | array  | no       | `[{"partner_code": <id>, "count": <int>, "expiry_date"?: "YYYY-MM-DD"}]` — mints seats to the pool (`firm=null`) |

Returns the updated network object; adds `"seats_minted": N` if `allocations` was sent.

## Firms

### `GET|POST /firms/`

**GET** — `?network_id=<id>` to filter to one network's firms, `?standalone=1` for firms with no network. No params = all firms.

```json
{ "firms": [/* same shape as the network-detail firms array */] }
```

**POST** — create a firm, optionally with its admin login and initial seats, atomically.

| Field          | Type   | Required | Notes                                                                                                   |
| -------------- | ------ | -------- | ------------------------------------------------------------------------------------------------------- |
| `name`         | string | yes      |                                                                                                         |
| `network`      | int    | no       | omit for a standalone firm                                                                              |
| `email_domain` | string | no       | gates who can redeem this firm's seats                                                                  |
| `admin`        | object | no       | `{"supabase_uid": "...", "email"?: "...", "capabilities"?: [...]}` — creates a firm-role `PartnerAdmin` |
| `allocations`  | array  | no       | same shape as network PATCH — mints seats straight into this firm                                       |

```json
{
  "id": 12,
  "name": "Acme LLP",
  "network": { "id": 4, "name": "Allinial Global" },
  "is_standalone": false,
  "email_domain": "acme.com",
  "is_active": true,
  "allocated_seats": 3,
  "used_seats": 0,
  "seats_minted": 3,
  "admin": {
    "id": 9,
    "email": "admin@acme.com",
    "supabase_uid": "...",
    "role": "firm",
    "network": null,
    "firm": { "id": 12, "name": "Acme LLP" },
    "capabilities": [],
    "is_active": true
  }
}
```

`admin` key is only present if an `admin` object was sent. `201`.

### `POST /firms/<id>/allocate/`

Top up an existing firm's seats.

| Field          | Type | Required |
| -------------- | ---- | -------- |
| `partner_code` | int  | yes      |
| `count`        | int  | yes      |
| `expiry_date`  | date | no       |

```json
{ "seats_minted": 5 }
```

`201`.

## Seats

### `POST /seats/<id>/assign-firm/`

Move an already-minted, unassigned network-pool seat (`firm=null`) onto a firm under the same network.

| Field  | Type | Required |
| ------ | ---- | -------- |
| `firm` | int  | yes      |

```json
{ "id": 88, "code": "ALLINIAL-A1B2C3D4", "firm_id": 12 }
```

## Partner codes

### `GET|POST /partner-codes/`

**GET** — every pricing plan.

```json
{
  "partner_codes": [
    {
      "id": 3,
      "code": "ALLINIAL-299",
      "description": null,
      "discounted_price": "299.00",
      "stripe_price_id": null,
      "auto_subscribe": false,
      "network": { "id": 4, "name": "Allinial Global" },
      "firm": null,
      "valid_to": null,
      "is_active": true
    }
  ]
}
```

**POST** — create a plan.

| Field              | Type     | Required | Notes                                                                                                                                    |
| ------------------ | -------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `code`             | string   | yes      | unique                                                                                                                                   |
| `description`      | string   | no       |                                                                                                                                          |
| `discounted_price` | decimal  | yes      |                                                                                                                                          |
| `stripe_price_id`  | string   | no       |                                                                                                                                          |
| `auto_subscribe`   | bool     | no       | `true` = grants a free Active subscription immediately on redeem; `false` = discount only, settled later via offline-payment or checkout |
| `network`          | int      | no       | scope — network XOR firm XOR neither (global)                                                                                            |
| `firm`             | int      | no       |                                                                                                                                          |
| `valid_to`         | datetime | no       | expiry for direct (non-seat) redemption                                                                                                  |

Returns the created plan, `201`.

## Partner admins

### `GET|POST /partner-admins/`

**GET**

```json
{
  "partner_admins": [
    {
      "id": 9,
      "email": "admin@acme.com",
      "supabase_uid": "...",
      "role": "firm",
      "network": null,
      "firm": { "id": 12, "name": "Acme LLP" },
      "capabilities": ["seat:send"],
      "is_active": true
    }
  ]
}
```

**POST**

| Field          | Type            | Required                   | Notes                          |
| -------------- | --------------- | -------------------------- | ------------------------------ |
| `supabase_uid` | string          | yes                        |                                |
| `email`        | string          | no                         | display only                   |
| `role`         | string          | yes                        | `super` \| `network` \| `firm` |
| `network`      | int             | required if `role=network` |                                |
| `firm`         | int             | required if `role=firm`    |                                |
| `capabilities` | array of string | no                         | must be known capability keys  |

Returns the created admin, `201`.

## Users (onboarding)

### `GET|POST|PATCH /users/`

One resource, dispatched by method.

**GET** — `?domain=acme.com,other.com&search=jane&page=1&page_size=30`

```json
{
  "status_code": 200,
  "message": "Users returned successfully!",
  "data": [
    {
      "id": 501,
      "email": "jane@acme.com",
      "email_domain": "acme.com",
      "first_name": "Jane",
      "last_name": "Doe",
      "mobile": "+15551234567",
      "country_code": "+1",
      "location": "New York",
      "qualification_status": "completed",
      "license_status": "licensed",
      "is_currently_working": true,
      "terms_accepted": true,
      "sms_consent": true,
      "created_at": "2026-08-01T10:00:00Z",
      "last_login": "2026-08-20T09:00:00Z",
      "creation_platform": "PartnerOnboarding",
      "account_type": "SGA",
      "profession": "CPA",
      "professional_courses": ["Auditing"],
      "state_board": ["New York"],
      "country_selected": "United States",
      "company": "Acme LLP",
      "sector": "Finance",
      "job_role": "Analyst",
      "partner_code": "ALLINIAL-299",
      "is_subscribed": true
    }
  ],
  "pagination_data": {
    "total_count": 42,
    "current_page_number": 1,
    "next_page": 2,
    "previous_page": null
  }
}
```

**POST** — onboard a new user and (optionally) apply a partner code.

| Field                                                           | Type         | Required | Notes                                                                        |
| --------------------------------------------------------------- | ------------ | -------- | ---------------------------------------------------------------------------- |
| `email`                                                         | string       | yes      |                                                                              |
| `first_name`, `last_name`, `mobile`, `country_code`, `location` | string       | no       |                                                                              |
| `profession`                                                    | int          | no       | FK id                                                                        |
| `professional_courses`, `state_board`                           | array of int | no       | FK ids                                                                       |
| `qualification_status`, `license_status`                        | string       | no       | choice fields                                                                |
| `is_currently_working`                                          | bool         | no       |                                                                              |
| `terms_accepted`                                                | bool         | no       | default `true`                                                               |
| `sms_consent`                                                   | bool         | no       |                                                                              |
| `country_selected`                                              | int          | no       | FK id                                                                        |
| `company_id`, `sector_id`, `job_role_id`, `experience_id`       | int          | no       | plain ints, not FKs — validated against reference tables                     |
| `partner_code`                                                  | string       | no       | a `PartnerSeat` code or a legacy flat `PartnerCode` — resolved automatically |

```json
{ "status": true, "message": "User created." }
```

`201` on success. `409` if email/mobile already exists. `400` for an invalid/ineligible partner code.

**PATCH** — update an existing user, identified by `user_id` in the body.

| Field                          | Type | Required | Notes                                                                               |
| ------------------------------ | ---- | -------- | ----------------------------------------------------------------------------------- |
| `user_id`                      | int  | yes      |                                                                                     |
| _(everything from POST above)_ |      | no       | partial — only sent keys are written; at least one field besides `user_id` required |

```json
{ "status": true, "message": "User updated." }
```

`200` on success.

## Offline payment

### `POST /users/<user_id>/offline-payment/`

Settle a partner-onboarded user's subscription outside any payment gateway (bank transfer, cash). `multipart/form-data`. Exactly one of `invoice`/`comment` — never both, never neither.

| Field     | Type   | Required           | Notes                                                                        |
| --------- | ------ | ------------------ | ---------------------------------------------------------------------------- |
| `invoice` | file   | XOR with `comment` | `.pdf`/`.png`/`.jpg`/`.jpeg`, max 10MB                                       |
| `comment` | string | XOR with `invoice` | admin justification when there's nothing to share, e.g. "free access for QA" |

Behavior depends on whether the user already has an active subscription (their partner code had `auto_subscribe=true`, granted at onboarding):

- **Already subscribed**: `invoice` attaches to their existing transaction; `comment` is just recorded, nothing else changes.
- **Not yet subscribed** (discount-only code): this invoice/comment **is** the payment — a real subscription is granted now, priced from their partner code.

```json
{
  "status": true,
  "message": "Invoice updated.",
  "data": {
    "user_id": 501,
    "order_id": 812,
    "transaction_id": 900,
    "payment_id": "TXN-...",
    "payment_mode": "Offline",
    "amount_paid": 299.0,
    "subscription_status": "Active",
    "receipt_url": "https://.../invoices/501/....pdf",
    "payment_note": null
  }
}
```

`200` on success. `400` no proof / both given / no invoice+no partner code to price against / invalid file type or size. `404` no user, or (already-subscribed case) no existing transaction found. `502` invoice upload failed. `500` grant failed.

---

# Panel API

Base: `/api/partners/panel/`. Every endpoint below is auto-scoped to the calling admin's own network or firm — no `network_id`/`firm_id` params, unlike superadmin.

## `GET /me/`

Identity + capability introspection. No permission gate beyond a valid token — a login with no matching `PartnerAdmin` row still returns `200`, not `403`/`401`, so the frontend can show "not provisioned" instead of erroring.

```json
{ "is_partner_admin": false }
```

or

```json
{
  "id": 9,
  "email": "admin@acme.com",
  "supabase_uid": "...",
  "role": "firm",
  "network": null,
  "firm": { "id": 12, "name": "Acme LLP" },
  "capabilities": ["seat:send"],
  "is_active": true,
  "is_partner_admin": true
}
```

## `GET /dashboard/`

_Requires:_ `report:network:read` (network admin) or `report:firm:read` (firm admin).

Seat stat cards. `total_seats`/`unallocated_seats` only appear for a network admin — a firm has no seat budget of its own.

```json
{
  "total_seats": 100,
  "unallocated_seats": 35,
  "allocated_seats": 65,
  "used_seats": 40,
  "available_seats": 15,
  "shared_seats": 10,
  "expired_seats": 0
}
```

## `GET /firms/`

_Requires:_ `report:network:read`/`report:firm:read`.

A network admin's own member firms; always empty for a firm admin (no sibling firms to see).

```json
{ "firms": [/* same shape as superadmin's firm list */] }
```

## `GET /partner-codes/`

_Requires:_ `report:network:read`/`report:firm:read`.

Plans this admin can mint seats from: their own network/firm's codes, plus any global (no network/firm) code.

```json
{ "partner_codes": [/* same shape as superadmin's */] }
```

## `GET /seats/`

_Requires:_ `seat:usage:read`.

`?firm_id=<id>` (network admins only, to drill into one firm) `&status=available|shared|applied|expired|all&search=<code or email>&page=&page_size=` (default 20).

```json
{
  "seats": [
    {
      "id": 88,
      "code": "ALLINIAL-A1B2C3D4",
      "partner_code": { "id": 3, "code": "ALLINIAL-299" },
      "firm": { "id": 12, "name": "Acme LLP" },
      "status": "shared",
      "purchase_cost": "299.00",
      "expiry_date": null,
      "sent_to_email": "spoc@acme.com",
      "shared_on": "2026-08-20T10:00:00Z",
      "applied_by_email": null,
      "applied_on": null
    }
  ],
  "pagination_data": {
    "total_count": 8,
    "current_page_number": 1,
    "next_page": null,
    "previous_page": null
  }
}
```

`status` is derived (`effective_status()`) — `applied` always wins even past expiry; otherwise an expired row shows `expired` regardless of its stored status.

## `POST /seats/<id>/send/`

_Requires:_ `seat:send`. Share a seat's code with any email (a firm-scoped or network-pool seat).

| Field   | Type   | Required |
| ------- | ------ | -------- |
| `email` | string | yes      |

Returns the updated seat (same shape as the list above, `status` now `"shared"`).

## `GET /users/`

_Requires:_ `report:network:read`/`report:firm:read`.

`?search=<name/email/phone>&blocked_status=all|blocked|active&page=&page_size=` (default 30). Scoped to users who redeemed a seat under this admin's network/firm.

```json
{
  "data": [
    {
      "id": 501,
      "name": "Jane Doe",
      "email": "jane@acme.com",
      "phone": "+15551234567",
      "is_blocked": false,
      "courses_completed_cpe": 3,
      "cpe_credits_earned": 12.0,
      "courses_in_progress_cpe": 1,
      "cpe_credits_in_progress": 4.0,
      "courses_completed_preview": 2,
      "courses_in_progress_preview": 0
    }
  ],
  "pagination_data": {
    "total_count": 42,
    "current_page_number": 1,
    "next_page": 2,
    "previous_page": null
  }
}
```

## `GET /users/export-csv/`

_Requires:_ `report:network:read`/`report:firm:read`. Same `search`/`blocked_status` filters as the list, no pagination — CSV download (`Partner Users Report.csv`).

Columns: Name, Email, Phone, Professional Qualification, State Board, Date of Signup, Date of Login, Blocked, No of courses completed in CPE mode, No of CPE credits earned, No of courses in progress in CPE mode, No of CPE credits in progress, No of CAIRA credits earned, No of CAIRA credits in progress, No of courses completed in preview mode, No of courses in progress in preview mode.

## `POST /users/<id>/block-status/`

_Requires:_ `user:block`. Target user must be in this admin's scope (`403` if not).

| Field        | Type   | Required |
| ------------ | ------ | -------- |
| `is_blocked` | bool   | yes      |
| `reason`     | string | no       |

```json
{ "status": true, "is_blocked": true, "user_id": 501 }
```

---

# Reports API

Same 5 endpoints exist under **both** `/api/partners/panel/report/` (auto-scoped, needs `report:network:read`/`report:firm:read`) and `/api/partners/superadmin/report/` (needs `IsSuperAdmin`, must pass exactly one of `network_id`/`firm_id` on every call). Shapes below are identical either way — superadmin just adds the scope param.

Every endpoint requires `?subject=courses` or `?subject=webinars`.

## `GET .../summary/`

`?subject=&date_from=&date_to=` (superadmin also needs `&network_id=` or `&firm_id=`)

**`subject=courses`**

```json
{
  "users_onboarded": 42,
  "active_in_last_15_days": 18,
  "total_courses_completed": 61,
  "avg_courses_completed_per_user": 1.45,
  "total_cpe_credits_awarded": 312.5,
  "avg_cpe_credits_per_user": 7.44,
  "avg_feedback_per_course": 4.2,
  "total_certificates_awarded": 55,
  "total_partner_codes": 3
}
```

**`subject=webinars`**

```json
{
  "users_onboarded": 42,
  "active_in_last_15_days": 18,
  "webinars_registered_for": 6,
  "total_registrations": 97,
  "avg_registrations_per_webinar": 16.2,
  "total_attendance": 71,
  "avg_attendance_per_webinar": 11.8,
  "total_cpe_credits_awarded": 210.0,
  "avg_cpe_credits_per_user": 5.0,
  "avg_feedback_per_webinar": 4.4,
  "total_certificates_awarded": 40,
  "total_partner_codes": 3
}
```

## `GET .../users/`

`?subject=&date_from=&date_to=&page=&page_size=` (default 30, max 200). One row per user, rolls up exactly to the summary above.

**`subject=courses`**

```json
{
  "users": [
    {
      "user_id": 501,
      "uuid": "miles-abc123",
      "name": "Jane Doe",
      "email": "jane@acme.com",
      "active_in_last_15_days": true,
      "total_courses_completed": 3,
      "total_cpe_credits_awarded": 12.0,
      "avg_feedback_per_course": 4.5,
      "total_certificates_awarded": 3
    }
  ],
  "pagination_data": {
    "total_count": 42,
    "current_page_number": 1,
    "next_page": 2,
    "previous_page": null
  }
}
```

**`subject=webinars`** — same identity fields, plus `total_webinars_registered`, `total_webinars_attended`, `total_cpe_credits_awarded`, `avg_feedback_per_webinar`, `total_certificates_awarded`.

## `GET .../user-items/`

`?subject=&user_id=&date_from=&date_to=`. The drill-down — one row per course/webinar for a single user. `403` if that user isn't in the caller's (or the given `network_id`/`firm_id`'s) scope.

**`subject=courses`**

```json
{
  "items": [
    {
      "name": "Jane Doe",
      "uuid": "miles-abc123",
      "email": "jane@acme.com",
      "user_id": 501,
      "course_type": "masterclass",
      "course_id": 88,
      "course_name": "Advanced Auditing",
      "cpe_mode": true,
      "is_completed": true,
      "progress_percent": 100.0,
      "cpe_credits": 4.0,
      "feedback_rating": 4.5,
      "has_certificate": true
    }
  ]
}
```

`progress_percent` is chapters-watched ÷ total-chapters × 100, independent of `is_completed` — for a CPE-mode course, completion is assessment-driven, so a user can be at 100% progress without being marked complete yet, or vice versa.

**`subject=webinars`**

```json
{
  "items": [
    {
      "name": "Jane Doe",
      "uuid": "miles-abc123",
      "email": "jane@acme.com",
      "user_id": 501,
      "webinar_id": 40,
      "webinar_name": "Ethics in Practice",
      "is_attended": true,
      "cpe_credits": 2.0,
      "feedback_rating": 4.0,
      "has_certificate": true
    }
  ]
}
```

## `GET .../filters/`

No params — static reference data for a filter bar.

```json
{
  "delivery_types": ["masterclass", "nano_learning", "webinar"],
  "fields_of_study": ["Accounting", "Ethics", "Others"]
}
```

## `GET .../export-csv/`

`?subject=&view=user-summary|user-items&date_from=&date_to=&user_id=` (`user_id` required when `view=user-items`). CSV download, same filters/scope as above.

- `view=user-summary` columns — **courses**: `user_id, uuid, name, email, active_in_last_15_days, total_courses_completed, total_cpe_credits_awarded, avg_feedback_per_course, total_certificates_awarded`. **webinars**: same identity fields + `total_webinars_registered, total_webinars_attended, total_cpe_credits_awarded, avg_feedback_per_webinar, total_certificates_awarded`.
- `view=user-items` columns — **courses**: `name, uuid, email, course_name, is_completed, progress_percent, cpe_credits, feedback_rating, has_certificate`. **webinars**: `name, uuid, email, webinar_name, is_attended, cpe_credits, feedback_rating, has_certificate`.

## `GET .../certificates/`

Same two bases as the rest of the Reports API. No `subject` param — webinars come back as `course_type: "webinar"`. Superadmin must anchor on one of `user_id` / `network_id` / `firm_id` (`400` otherwise; `network_id` and `firm_id` are mutually exclusive, `user_id` needs neither). Panel is scoped by the token; `user_id` outside the admin's scope → `403`. `course_id` narrows any call to one course.

The shape follows how narrow the query is:

**`user_id` [+ `course_id`] — flat** (`{"certificates": []}` when none, never a 404)

```json
{
  "certificates": [
    {
      "user_id": 4821,
      "uuid": "a1b2c3d4-...",
      "name": "Jane Doe",
      "email": "jane@acmellp.com",
      "course_type": "masterclass",
      "course_id": 312,
      "course_name": "US CPA - Financial Accounting",
      "cpe_credits": 2.0,
      "issued_on": "2026-08-14T10:32:05Z",
      "certificate_url": "https://<cloudfront-domain>/media/certificate/nasba_4821_312.pdf"
    }
  ]
}
```

**`firm_id` / firm-role admin — grouped by user**

```json
{
  "users": [
    {
      "user_id": 4821,
      "uuid": "a1b2c3d4-...",
      "name": "Jane Doe",
      "email": "jane@acmellp.com",
      "certificates": [{ "course_type": "masterclass", "course_id": 312, "...": "..." }]
    }
  ]
}
```

**`network_id` / network-role admin — grouped by firm, then user**

```json
{
  "firms": [{ "firm_id": 17, "firm_name": "Acme LLP", "users": [/* as above */] }],
  "unassigned_users": [/* users who redeemed a network-pool seat with no firm */]
}
```

Firms with zero certified users still appear with `"users": []`.

**Caveat:** `certificate_url` resolves to the NASBA PDF only (`UserCertificate.nasba_url`) — a user holding just a Miles certificate on a course gets `certificate_url: null`. The frontend skips null URLs; confirm whether it should fall back to `miles_url`.
