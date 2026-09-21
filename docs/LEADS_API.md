# Leads API

For frontend integration: the firm-enquiry form on the partnership marketing pages (Allinial Global, MGI World, Hawaii Society of CPAs, etc.) — "how can we help you" — plus the Leads list in the super-admin panel. This backend replaces the old direct-to-Supabase `firm_inquiries` table; point both the public form and the super-admin panel at these endpoints instead.

## Environments

| Env        | Host                                   |
| ---------- | -------------------------------------- |
| Production | `https://api.milesmasterclass.com`     |
| UAT        | `https://uat-api.milesmasterclass.com` |

All paths below are relative to one of these.

Two audiences, same split as the rest of the Partner Platform API (see [Partner_Platform_API.md](Partner_Platform_API.md)):

| Base path                         | Who calls it                 | Scope                                |
| --------------------------------- | ---------------------------- | ------------------------------------ |
| `/api/partners/leads/`            | Public — the marketing pages | Unauthenticated create only          |
| `/api/partners/superadmin/leads/` | Super-admin panel            | List/search/update/export every lead |

## Auth

- **Public create**: none. No `Authorization` header at all.
- **Superadmin endpoints**: `Authorization: Bearer <supabase_access_token>` — the same Supabase session token the panel already uses for every other super-admin call (Networks/Firms/Partner Codes/…). The panel's logged-in super-admin session just works here too; nothing new to wire up. Missing/invalid/expired token → `401`. Valid token but not a super-admin → `403`.

## Errors

- **Public create validation errors** (`400`): DRF's default field-keyed shape, e.g. `{"email": ["This field is required."]}`.
- **Superadmin PATCH validation error** (`400`): `{"status": ["..."], "notes": ["..."]}` or, if neither field was sent, `{"non_field_errors": ["Provide at least one of: status, notes."]}`.
- **404**: unknown `<id>` on `PATCH /superadmin/leads/<id>/`.

## Model

| Field                      | Type            | Notes                                                                                             |
| -------------------------- | --------------- | ------------------------------------------------------------------------------------------------- |
| `id`                       | int             |                                                                                                   |
| `full_name`                | string          |                                                                                                   |
| `email`                    | string          |                                                                                                   |
| `firm_name`                | string          |                                                                                                   |
| `job_role`                 | string          | optional, blank if not collected                                                                  |
| `help_type`                | array of string | selected "how can we help you" checkboxes, e.g. `["I need pricing help", "Partnership inquiry"]`  |
| `enquiry_type`             | string          | which partnership page the form was on, e.g. `"Allinial Global"`; defaults to `"General Inquiry"` |
| `keep_updated`             | bool            | opt-in checkbox                                                                                   |
| `status`                   | string          | `new` \| `contacted` \| `converted` \| `closed`, defaults to `new`                                |
| `notes`                    | string          | internal only, never shown to the submitter                                                       |
| `created_at`, `updated_at` | datetime        |                                                                                                   |

---

# Public API

Base: `/api/partners/leads/`

## `POST /`

Create a lead from a partnership page form. No auth.

| Field          | Type            | Required | Notes                           |
| -------------- | --------------- | -------- | ------------------------------- |
| `full_name`    | string          | yes      |                                 |
| `email`        | string          | yes      |                                 |
| `firm_name`    | string          | yes      |                                 |
| `job_role`     | string          | no       |                                 |
| `help_type`    | array of string | no       |                                 |
| `enquiry_type` | string          | no       | defaults to `"General Inquiry"` |
| `keep_updated` | bool            | no       | defaults to `false`             |

```bash
curl -X POST https://api.milesmasterclass.com/api/partners/leads/ \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "Jane Doe",
    "email": "jane@example.com",
    "firm_name": "Example LLP",
    "job_role": "Partner",
    "help_type": ["I need pricing help", "Partnership inquiry"],
    "enquiry_type": "Allinial Global",
    "keep_updated": true
  }'
```

```json
{ "success": true, "message": "Your enquiry has been submitted successfully!", "id": 57 }
```

`201` on success, `400` on validation error (missing `full_name`/`email`/`firm_name`, or invalid `email`).

---

# Superadmin API

Base: `/api/partners/superadmin/leads/`

## `GET /`

`?status=new|contacted|converted|closed|all&search=<name/email/firm>&page=&page_count=` (default page size 30, matches `InternalListPagination`). No `status` param = all statuses.

```bash
curl "https://api.milesmasterclass.com/api/partners/superadmin/leads/?status=new" \
  -H "Authorization: Bearer <SUPABASE_JWT>"
```

```json
{
  "data": [
    {
      "id": 57,
      "full_name": "Jane Doe",
      "email": "jane@example.com",
      "firm_name": "Example LLP",
      "job_role": "Partner",
      "help_type": ["I need pricing help", "Partnership inquiry"],
      "enquiry_type": "Allinial Global",
      "keep_updated": true,
      "status": "new",
      "notes": "",
      "created_at": "2026-09-16T10:00:00Z",
      "updated_at": "2026-09-16T10:00:00Z"
    }
  ],
  "pagination_data": {
    "total_count": 31,
    "current_page_number": 1,
    "next_page": 2,
    "previous_page": null
  }
}
```

## `PATCH /<id>/`

Update status and/or internal notes.

| Field    | Type   | Required | Notes                                           |
| -------- | ------ | -------- | ----------------------------------------------- |
| `status` | string | no       | `new` \| `contacted` \| `converted` \| `closed` |
| `notes`  | string | no       |                                                 |

At least one of the two is required.

```bash
curl -X PATCH https://api.milesmasterclass.com/api/partners/superadmin/leads/57/ \
  -H "Authorization: Bearer <SUPABASE_JWT>" \
  -H "Content-Type: application/json" \
  -d '{"status": "contacted", "notes": "Called, following up next week"}'
```

Returns the updated lead (same shape as the list above).

## `GET /export-csv/`

Same `?status=`/`?search=` filters as the list, no pagination — CSV download (`Leads.csv`).

```bash
curl "https://api.milesmasterclass.com/api/partners/superadmin/leads/export-csv/" \
  -H "Authorization: Bearer <SUPABASE_JWT>" -o leads.csv
```

Columns: Name, Email, Firm, Job Role, Help Type, Enquiry Type, Status, Created At.
