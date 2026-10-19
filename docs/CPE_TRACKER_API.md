# Web CPE Tracker - API Guide for Frontend

The backend for the web page **"Your CPE Portfolio"**: what a learner has earned, their certificates,
their state-board progress, and the NASBA spreadsheet they report with.

|               |                                                                                                                                                 |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Surface       | **Web only** (the app keeps its own `badges/cpe-progress/` + `badges/all-badges/`)                                                              |
| Base path     | `web-api/v1/cpe-tracker/`                                                                                                                       |
| UAT host      | `https://uat-api.milescaira.com`                                                                                                                |
| Methods       | All five are **GET** and read-only. Nothing here writes.                                                                                        |
| Auth          | Miles SSO bearer token on every call (`Authorization: Bearer <access_token>`)                                                                   |
| Live on UAT   | Yes - checked 2026-10-19 (every route answers 401 without a token)                                                                              |
| Backend owner | Sohan Biswas, MO-2776 (commit `3cd7dea`, 2026-10-16)                                                                                            |
| Replaces      | Legacy Masterclass `v2/cpe-tracker/`, `v2/cpe-tracker/summary/`, `download_certificate`, `download_bulk_certificate`, `download_nasba_template` |

---

## 0. The five APIs at a glance

| #   | API                                       | What the page uses it for                                                                                                              |
| --- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `GET summary/?year=`                      | The portfolio card: CAIRA / Others totals, Accounting / Ethics / Others split, Self-study / Webinar / Nano split, state-board progress |
| 2   | `GET credits/?ledger=&year=&course_type=` | The credits table (paged), with badge, certificate and feedback state per row                                                          |
| 3   | `GET credits/<credit_id>/certificate/`    | The "view / download certificate" dialog for one row                                                                                   |
| 4   | `GET certificates/?year=`                 | "Download all certificates" - a list of URLs the client zips                                                                           |
| 5   | `GET nasba-template/?year=`               | "Download NASBA template" - returns an **.xlsx file**, not JSON                                                                        |

```
Page load (year = selector value):
   summary/?year=2026                       -> card + chips totals + state boards
   credits/?ledger=caira&year=2026&page=1   -> table

Chip CAIRA <-> Others:     re-call credits/ with ledger=others   (summary already has both totals)
Course-type filter:        re-call credits/ with course_type=...
Year selector change:      re-call summary/ and credits/
Row "Certificate" click:   credits/<row.id>/certificate/
"Download all":            certificates/?year=2026  (follow `next` until null), then zip on the client
"NASBA template":          nasba-template/?year=2026 -> save the blob as NASBA_Template.xlsx
Row "Claim badge":         POST api/v1/badges/badge-claimed-by-user/  { "badge_id": row.badge.id }
```

---

## 1. Rules that apply to every call

### 1.1 The response envelope

Every JSON response has the same three keys:

```json
{ "success": true, "message": "CPE summary loaded.", "data": { ... } }
```

- `success` is derived from the HTTP status (`true` below 400, `false` at 400+). Trust the HTTP status first.
- `message` is a human sentence. Do not branch on its text.
- `data` is the payload. On errors it carries the machine-readable reason (see 1.4).
- **Empty strings are never sent.** A missing text value arrives as `null`, so use `value ?? ""` before
  calling `.length`, `.trim()`, `.toLowerCase()` on it.
- **Exception:** a successful `nasba-template/` is a file, not JSON (section 6).

### 1.2 Authentication

```
Authorization: Bearer <Miles SSO access token>
```

| Situation           | Status  | Body                                                                                        |
| ------------------- | ------- | ------------------------------------------------------------------------------------------- |
| No header           | **401** | `{"success":false,"message":"Authentication credentials were not provided.","data":null}`   |
| Bad / expired token | **401** | `{"success":false,"message":"Error decoding signature.","data":null}` (message text varies) |

These routes answer **401** (with `WWW-Authenticate: Bearer realm="api"`), not 403. Treat 401 as
"refresh the token or send the user to login". Every API only ever returns **the caller's own** data -
there is no user id in any request.

### 1.3 Query strings are strict

- **Unknown query parameters are refused with 400.** Do not send extra keys (no `?ledger=caira&foo=1`,
  no cache-buster params). If you need a cache-buster, do it with headers.
- `year` must be an integer between **2000 and 2100**.
- Years are **calendar years in UTC** (1 Jan 00:00 UTC to 31 Dec 23:59 UTC).

### 1.4 Error shapes (exact, measured)

**400 - bad query string** (`reason` is always `invalid_query`; `errors` names every bad field):

```json
{
  "success": false,
  "message": "The request could not be completed.",
  "data": {
    "status": "error",
    "reason": "invalid_query",
    "errors": [
      { "field": "ledger", "message": "Input should be 'caira' or 'others'" },
      { "field": "foo", "message": "Extra inputs are not permitted" }
    ]
  }
}
```

More real examples of `errors[]`:

| Request                                                   | `errors`                                                                                                                                |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `credits/?year=2026` (no ledger)                          | `[{"field":"ledger","message":"Field required"}]`                                                                                       |
| `credits/?ledger=caira&year=1999`                         | `[{"field":"year","message":"Input should be greater than or equal to 2000"}]`                                                          |
| `credits/?ledger=caira&year=2026&course_type=course,quiz` | `[{"field":"course_type.1","message":"Input should be 'course', 'podcast', 'nano_learning', 'micro_learning', 'ai_lab' or 'webinar'"}]` |
| `credits/?...&page=abc`                                   | same shape, `field` is the pagination key                                                                                               |

**404** (only API 3):

```json
{ "success": false, "message": "CPE credit not found.", "data": { "code": "credit_not_found" } }
```

**500** (any API; `message` names what failed):

```json
{ "success": false, "message": "Unable to load your CPE summary.", "data": { "status": "error" } }
```

### 1.5 Pagination (APIs 2 and 4)

Request: `page` (default **1**) and `page_size` (default **6**, max **100** - a bigger value is clamped
to 100, not refused). The namespaced form `credits.page` / `credits.page_size` (or
`certificates.page` / `certificates.page_size`) also works. Do not send both forms for the same list.

Response block - **every key is always present**, even when empty:

```json
{
  "slug": "cpe_tracker_credits_web",
  "count": 23,
  "page": 1,
  "page_size": 15,
  "total_pages": 2,
  "has_next": true,
  "has_previous": false,
  "next": "https://uat-api.milescaira.com/web-api/v1/cpe-tracker/credits/?ledger=caira&page=2&page_size=15&year=2026",
  "previous": null,
  "results": [ ... ]
}
```

- `next` / `previous` are **absolute URLs** that keep your filters; they are `null` at the ends. You can
  follow `next` blindly.
- `slug` is a fixed identifier for the list (`cpe_tracker_credits_web`, `cpe_tracker_certificates_web`).
- The page asks for 15 rows: send `page_size=15`.

---

## 2. API 1 - Summary

```
GET /web-api/v1/cpe-tracker/summary/?year=2026
```

| Param  | Required | Type          | Meaning                                        |
| ------ | -------- | ------------- | ---------------------------------------------- |
| `year` | **yes**  | int 2000-2100 | Calendar year (UTC) the credits were earned in |

No other parameter is accepted. There is **no server default** for `year` - always send the year the
selector shows.

```bash
curl -s "https://uat-api.milescaira.com/web-api/v1/cpe-tracker/summary/?year=2026" \
  -H "Authorization: Bearer $TOKEN"
```

### 200 response (illustrative values)

```json
{
  "success": true,
  "message": "CPE summary loaded.",
  "data": {
    "year": 2026,
    "caira_credits_earned": 12.5,
    "others_credits_earned": 4.0,
    "credits_earned": {
      "total_credit_earned": 16.5,
      "course_credits": {
        "account_credits": 9.0,
        "ethics": 2.0,
        "others": 5.5
      },
      "study_credits": {
        "self_study": 6.5,
        "webinar": 8.0,
        "nano_learning": 2.0
      },
      "fields_of_study": [
        { "id": "0b6c...e1", "name": "Accounting", "credits": 9.0 },
        { "id": "7f21...9a", "name": "Specialized Knowledge", "credits": 3.5 },
        { "id": "c3d4...10", "name": "Ethics (Regulatory)", "credits": 2.0 }
      ],
      "unclassified_credits": 2.0
    },
    "state_boards": [
      {
        "id": "5a9e...44",
        "name": "California Board of Accountancy",
        "state_code": "CA",
        "required_credits": 80.0,
        "required_ethics_credits": 4.0,
        "reporting_period_years": 2,
        "period": {
          "start_year": 2025,
          "end_year": 2026,
          "credits_earned": 31.0,
          "ethics_credits_earned": 2.0
        }
      },
      {
        "id": "91c0...2b",
        "name": "Some Board Not Yet Configured",
        "state_code": null,
        "required_credits": null,
        "required_ethics_credits": null,
        "reporting_period_years": null,
        "period": null
      }
    ]
  }
}
```

An empty year returns every key with zeros and empty lists (it is never a 404).

### Field reference

| Field                                           | Type          | Meaning                                                                                      |
| ----------------------------------------------- | ------------- | -------------------------------------------------------------------------------------------- |
| `year`                                          | int           | Echo of the request                                                                          |
| `caira_credits_earned`                          | number        | Credits on the **CAIRA** ledger in `year`                                                    |
| `others_credits_earned`                         | number        | Credits on the **Others** ledger in `year`                                                   |
| `credits_earned.total_credit_earned`            | number        | CAIRA + Others                                                                               |
| `credits_earned.course_credits.account_credits` | number        | Credits on fields of study whose name contains "account"                                     |
| `credits_earned.course_credits.ethics`          | number        | ... whose name contains "ethic"                                                              |
| `credits_earned.course_credits.others`          | number        | Every other field, **plus** unclassified credits                                             |
| `credits_earned.study_credits.self_study`       | number        | Delivery method QAS Self Study (Masterclass courses, AI Labs, archived content)              |
| `credits_earned.study_credits.webinar`          | number        | Delivery method Group Internet Based or Group Live                                           |
| `credits_earned.study_credits.nano_learning`    | number        | Delivery method Nano Learning                                                                |
| `credits_earned.fields_of_study[]`              | list          | Every field with its share: `id`, `name`, `credits`. Sorted by credits, highest first        |
| `credits_earned.unclassified_credits`           | number        | Credits on items with no active field of study (also counted inside `course_credits.others`) |
| `state_boards[]`                                | list          | The learner's state boards, in picker order. `[]` if the learner chose none                  |
| `state_boards[].state_code`                     | string / null | Two-letter state, e.g. `"CA"`                                                                |
| `state_boards[].required_credits`               | number / null | Credits the board requires per period. **null = not configured**                             |
| `state_boards[].required_ethics_credits`        | number / null | Ethics credits required per period. null = not configured                                    |
| `state_boards[].reporting_period_years`         | int / null    | Period length in years. null = not configured                                                |
| `state_boards[].period`                         | object / null | **null when `reporting_period_years` is null**                                               |
| `period.start_year` / `end_year`                | int           | The calendar years counted (period ending in `year`)                                         |
| `period.credits_earned`                         | number        | All credits earned in that window (both ledgers)                                             |
| `period.ethics_credits_earned`                  | number        | The ethics part of those credits                                                             |

### How to use it on the page

- **CAIRA / Others chip:** both totals are already here. Switching the chip changes which key you show;
  do **not** re-call summary. (Only the table, API 2, needs a new call.)
- **Progress bar per board:** `period.credits_earned / required_credits`, and
  `period.ethics_credits_earned / required_ethics_credits`.
- **Replace the hard-coded 40.** Use `required_credits`. If it is `null`, show "Requirement not
  configured" - do not fall back to 40 or 0.
- All numbers are rounded to 2 decimals. The parts may differ from the total by 0.01 because of rounding.

---

## 3. API 2 - Credits table

```
GET /web-api/v1/cpe-tracker/credits/?ledger=caira&year=2026&course_type=course,ai_lab&page=1&page_size=15
```

| Param         | Required | Type                | Meaning                                                                                                       |
| ------------- | -------- | ------------------- | ------------------------------------------------------------------------------------------------------------- |
| `ledger`      | **yes**  | `caira` \| `others` | The chip. No default - a missing value is a 400                                                               |
| `year`        | **yes**  | int 2000-2100       | Calendar year (UTC)                                                                                           |
| `course_type` | no       | comma list          | Any of `course`, `podcast`, `nano_learning`, `micro_learning`, `ai_lab`, `webinar`. Absent or empty = **All** |
| `page`        | no       | int >= 1            | Default 1                                                                                                     |
| `page_size`   | no       | int 1-100           | Default 6 (the page wants 15)                                                                                 |

`course_type` can be sent comma-separated (`course_type=course,ai_lab`). Duplicates are ignored.

```bash
curl -s "https://uat-api.milescaira.com/web-api/v1/cpe-tracker/credits/?ledger=caira&year=2026&page_size=15" \
  -H "Authorization: Bearer $TOKEN"
```

### 200 response (illustrative values)

```json
{
  "success": true,
  "message": "CPE credits loaded.",
  "data": {
    "applied": { "ledger": "caira", "year": 2026, "course_type": [] },
    "credits": {
      "slug": "cpe_tracker_credits_web",
      "count": 2,
      "page": 1,
      "page_size": 15,
      "total_pages": 1,
      "has_next": false,
      "has_previous": false,
      "next": null,
      "previous": null,
      "results": [
        {
          "id": "3f1e2d4c-....-award-uuid",
          "course": {
            "id": "a1b2c3d4-....-course-uuid",
            "course_type": "course",
            "title": "Revenue Recognition Masterclass",
            "slug": "revenue-recognition-masterclass",
            "thumbnail": "https://milesone-backend-assets.s3.ap-south-1.amazonaws.com/MilesOne/....jpg",
            "is_archived": false,
            "fields_of_study": [
              { "id": "0b6c...e1", "name": "Accounting", "cpe_credit": 2.0 },
              { "id": "c3d4...10", "name": "Ethics (Regulatory)", "cpe_credit": 1.0 }
            ]
          },
          "credits": 3.0,
          "allocated_on": "2026-09-14",
          "was_caira_credit": true,
          "delivery_method": "QAS Self Study",
          "badge": {
            "id": "9d8c7b6a-....-allocation-uuid",
            "name": "Revenue Recognition Expert",
            "image_url": "https://images.credly.com/....png",
            "state": "ISSUED_UNCLAIMED",
            "claimed": false,
            "accept_url": "https://www.credly.com/badges/..../accept"
          },
          "certificate_available": true,
          "feedback_required": true,
          "feedback_submitted": true
        },
        {
          "id": "77aa....-award-uuid",
          "course": {
            "id": "5e6f....-lab-uuid",
            "course_type": "ai_lab",
            "title": "AI for Auditors Lab",
            "slug": null,
            "thumbnail": "https://....png",
            "is_archived": false,
            "fields_of_study": [
              { "id": "7f21...9a", "name": "Specialized Knowledge", "cpe_credit": 2.0 }
            ]
          },
          "credits": 2.0,
          "allocated_on": "2026-08-02",
          "was_caira_credit": true,
          "delivery_method": "QAS Self Study",
          "badge": null,
          "certificate_available": false,
          "feedback_required": true,
          "feedback_submitted": false
        }
      ]
    }
  }
}
```

Rows are ordered **newest first** (by award date).

### Row field reference

| Field                      | Type          | Meaning                                                                                                       |
| -------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------- |
| `id`                       | uuid          | **The award id.** Use it for API 3 (`credits/<id>/certificate/`)                                              |
| `course.id`                | uuid / null   | The item the credit was for (course, lab, webinar or archived item)                                           |
| `course.course_type`       | string / null | `course`, `podcast`, `nano_learning`, `micro_learning`, `ai_lab`, `webinar`. **null for an archived reel**    |
| `course.title`             | string / null | Display name                                                                                                  |
| `course.slug`              | string / null | Public slug - only courses and webinars have one. Null for AI Labs and archived items                         |
| `course.thumbnail`         | url / null    | Landscape artwork. Null for archived items                                                                    |
| `course.is_archived`       | bool          | Archived (legacy) content. No page to link to                                                                 |
| `course.fields_of_study[]` | list          | `id`, `name`, `cpe_credit` - the item's **current** active fields                                             |
| `credits`                  | number        | Credits awarded (frozen at award time, 2 decimals)                                                            |
| `allocated_on`             | `YYYY-MM-DD`  | Award date, **UTC**                                                                                           |
| `was_caira_credit`         | bool          | `true` only on the CAIRA ledger                                                                               |
| `delivery_method`          | string        | `QAS Self Study`, `Group Internet Based`, `Group Live` or `Nano Learning` (same value the certificate prints) |
| `badge`                    | object / null | **null when the item has no Credly badge configured** (AI Labs never have one)                                |
| `badge.id`                 | uuid / null   | The badge allocation id. **This is the `badge_id` for the claim API.** null when not issued yet               |
| `badge.name`               | string / null | Badge display name                                                                                            |
| `badge.image_url`          | url / null    | Badge image                                                                                                   |
| `badge.state`              | string        | See the table below                                                                                           |
| `badge.claimed`            | bool          | The learner already clicked "accept"                                                                          |
| `badge.accept_url`         | url / null    | Credly accept link                                                                                            |
| `certificate_available`    | bool          | A certificate PDF exists for this award                                                                       |
| `feedback_required`        | bool          | The item type asks for feedback (courses, AI Labs, webinars). `false` for archived items                      |
| `feedback_submitted`       | bool          | The learner has given feedback (always `false` when not required)                                             |

### `badge.state` values

| State              | Show                 | Claim button                |
| ------------------ | -------------------- | --------------------------- |
| `NOT_ISSUED`       | Badge not issued yet | Hidden (`badge.id` is null) |
| `PENDING`          | Issuing in progress  | Disabled                    |
| `FAILED`           | Issue failed         | Disabled (support case)     |
| `REVOKED`          | Revoked              | Hidden                      |
| `ISSUED_UNCLAIMED` | Ready to claim       | **Enabled**                 |
| `CLAIMED`          | Claimed              | Hidden / "View badge"       |

### Claiming a badge from a row (existing API, not new)

```
POST /api/v1/badges/badge-claimed-by-user/
{ "badge_id": "<row.badge.id>" }
```

200 with `data.claimed`, `data.already_claimed`, `data.credly_badge_url` (idempotent - a second claim is
still 200 with `already_claimed: true`); 404 `badge_not_found`; 409 `badge_not_issued` (still
PENDING at Credly). After a 200, re-fetch the credits page or flip the row to `CLAIMED` locally.

---

## 4. API 3 - One award's certificate

```
GET /web-api/v1/cpe-tracker/credits/<credit_id>/certificate/
```

- `credit_id` = the `id` of a row from API 2 (the award id, a UUID).
- **No query parameters accepted** - any parameter is a 400.

```bash
curl -s "https://uat-api.milescaira.com/web-api/v1/cpe-tracker/credits/3f1e2d4c-..../certificate/" \
  -H "Authorization: Bearer $TOKEN"
```

### 200 - certificate exists

```json
{
  "success": true,
  "message": "Certificate loaded.",
  "data": {
    "id": "3f1e2d4c-....-award-uuid",
    "course": { "id": "...", "course_type": "course", "title": "Revenue Recognition Masterclass",
                "slug": "revenue-recognition-masterclass", "thumbnail": "https://....jpg",
                "is_archived": false, "fields_of_study": [ ... ] },
    "credits": 3.0,
    "allocated_on": "2026-09-14",
    "certificate_available": true,
    "certificate_url": "https://....pdf"
  }
}
```

### 200 - no certificate yet (NOT a 404)

```json
{ "success": true, "message": "Certificate loaded.",
  "data": { "id": "...", "course": { ... }, "credits": 3.0, "allocated_on": "2026-09-14",
            "certificate_available": false, "certificate_url": null } }
```

Show "No certificate is available yet." when `certificate_available` is `false`.

### 404

`data.code = "credit_not_found"` - the id does not exist, was revoked, **or belongs to another learner**
(all three look the same on purpose).

**Changed from legacy:** legacy took `(course_type, course_id)` in a POST body and answered 404 when the
certificate was not ready. Now it is a GET keyed on the **award id**, and "not ready" is a 200.

---

## 5. API 4 - All certificates for a year

```
GET /web-api/v1/cpe-tracker/certificates/?year=2026&page_size=100
```

| Param       | Required | Type          | Meaning                       |
| ----------- | -------- | ------------- | ----------------------------- |
| `year`      | **yes**  | int 2000-2100 | Calendar year (UTC)           |
| `page`      | no       | int           | Default 1                     |
| `page_size` | no       | int 1-100     | Default 6. For a zip, use 100 |

- **Both ledgers** (CAIRA and Others) are included.
- **Only awards that have a certificate** are listed - every row has `certificate_available: true`.
- The server returns **URLs, not a zip**. The client downloads each `certificate_url` and builds the zip
  (same as legacy). Follow `next` until it is `null` to get them all.

### 200 response (illustrative)

```json
{
  "success": true,
  "message": "Certificates loaded.",
  "data": {
    "year": 2026,
    "certificates": {
      "slug": "cpe_tracker_certificates_web",
      "count": 1,
      "page": 1,
      "page_size": 100,
      "total_pages": 1,
      "has_next": false,
      "has_previous": false,
      "next": null,
      "previous": null,
      "results": [
        {
          "id": "3f1e2d4c-....-award-uuid",
          "course": { "id": "...", "course_type": "course", "title": "Revenue Recognition Masterclass",
                      "slug": "revenue-recognition-masterclass", "thumbnail": "https://....jpg",
                      "is_archived": false, "fields_of_study": [ ... ] },
          "credits": 3.0,
          "allocated_on": "2026-09-14",
          "certificate_available": true,
          "certificate_url": "https://....pdf"
        }
      ]
    }
  }
}
```

An empty year is a 200 with `count: 0` and `results: []` - show "No certificates for 2026" and do not
build an empty zip.

**One certificate per award, not per field of study.** Legacy returned one NASBA certificate per field
of study plus an optional "Miles" certificate. This backend stores one certificate per award; the
award's fields of study are listed beside it. There is **no `miles_certificate_url`** any more.

---

## 6. API 5 - NASBA template (.xlsx download)

```
GET /web-api/v1/cpe-tracker/nasba-template/?year=2026
```

| Param  | Required | Type          | Meaning                                                                              |
| ------ | -------- | ------------- | ------------------------------------------------------------------------------------ |
| `year` | no       | int 2000-2100 | Only that year. **Omit it to export every award** the learner has (legacy behaviour) |

### Success = a FILE, not JSON

```
HTTP 200
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="NASBA_Template.xlsx"
<binary xlsx>
```

Errors (400 / 401 / 500) are still the normal **JSON envelope**. So check the status (or the
`Content-Type`) before treating the body as a file:

```js
const res = await fetch(`${API}/web-api/v1/cpe-tracker/nasba-template/?year=${year}`, {
  headers: { Authorization: `Bearer ${token}` },
});
if (!res.ok) {
  const err = await res.json(); // { success:false, message, data }
  throw new Error(err.message);
}
const blob = await res.blob();
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'NASBA_Template.xlsx';
a.click();
URL.revokeObjectURL(url);
```

Because the auth is a bearer header, a plain `<a href>` link will not work - use `fetch` + blob.

### Sheet contents

Sheet name `NASBA Export`. 14 columns, legacy order. **One line per award per field of study** (the
award's credit is split across its fields). Oldest first.

| Column            | Value                                                                          |
| ----------------- | ------------------------------------------------------------------------------ |
| Delivery Method   | `QAS Self Study` / `Group Internet Based` / `Group Live` / `Nano Learning`     |
| Program Type      | `Other Organization's Programs` for webinars, `Self-Study` for everything else |
| Title             | Course / lab / webinar name                                                    |
| Course Number     | blank                                                                          |
| Description       | blank                                                                          |
| Start Date        | Award date, `DD/MM/YYYY` (UTC)                                                 |
| End Date          | Same as Start Date                                                             |
| Country           | `USA` when a State is known, else blank                                        |
| State             | `state_code` of the learner's first state board that has one, else blank       |
| City              | blank                                                                          |
| Provider          | `Miles Masterclass Inc.`                                                       |
| NASBA Provider ID | `149174`                                                                       |
| Subject Area      | Field of study name (blank if the item has none)                               |
| CPE Credit        | That field's share of the award (2 decimals)                                   |

Nothing to report = a valid .xlsx with only the header row (legacy sent a text message that saved as a
broken file).

---

## 7. How the numbers are calculated (so the UI can explain them)

1. **Source of truth:** the learner's CPE award ledger (`TrackingCPECredits`), active rows only. One row
   per credit award - Masterclass course, podcast, nano / micro learning, AI Lab, webinar, or archived
   legacy content.
2. **CAIRA vs Others:** an award is CAIRA only when it was flagged CAIRA for that learner at award
   time. Anything unknown goes to **Others**. The app's badge screens use the same rule, so the web and
   the app never disagree.
3. **Credits are never re-priced.** The number frozen at award time is what the learner keeps. To show
   it by field of study, it is **split** across the item's current fields in proportion to their
   credit, so the parts always add up to the award.
4. **Accounting / Ethics / Others** is a **name match** on the field of study: contains "account",
   contains "ethic", or anything else. (The same rule the page already uses to colour rows.)
5. **Delivery method** is resolved the same way the certificate resolves it, so the table and the PDF
   always print the same method. AI Labs and archived content are QAS Self Study.
6. **State-board period** = the `reporting_period_years` calendar years ending in the selected year
   (e.g. 2-year period, year 2026 -> 2025-2026). This is an approximation of the board's real cycle.
7. **Dates are UTC.** An award at 23:00 UTC on 31 Dec counts in that year, even for a learner in India.

---

## 8. What changed from legacy (migration checklist)

| Legacy                                            | New                                                      | What to change in the FE                                                                                                                                      |
| ------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET v2/cpe-tracker/summary/`                     | `GET web-api/v1/cpe-tracker/summary/?year=`              | `year` is now **required**. Read `data` from the envelope. New `state_boards` replaces the hard-coded 40                                                      |
| `GET v2/cpe-tracker/`                             | `GET web-api/v1/cpe-tracker/credits/?ledger=&year=`      | `ledger` now **required** (was defaulted to caira). Paging is `page` / `page_size` + standard block (was `page_count` / `pagination_data`). All ids are UUIDs |
| `POST user-assessment/download_certificate/`      | `GET .../credits/<award_id>/certificate/`                | GET, keyed on the row `id`. "No certificate yet" is a 200, not 404                                                                                            |
| `POST user-assessment/download_bulk_certificate/` | `GET .../certificates/?year=`                            | GET, paged list of URLs. One certificate per award. No `miles_certificate_url`                                                                                |
| `GET download_nasba_template`                     | `GET .../nasba-template/?year=`                          | `year` optional. Errors are JSON; success is the file                                                                                                         |
| `user-badges/<id>/claim/`                         | `POST api/v1/badges/badge-claimed-by-user/` `{badge_id}` | Use `row.badge.id`                                                                                                                                            |

Key names kept from legacy where they existed: `caira_credits_earned`, `credits_earned.course_credits`,
`feedback_submitted` - so mostly the plumbing changes, not the bindings.

---

## 9. Edge cases and gotchas

- **Send `year` every time** on summary, credits and certificates - there is no default.
- **No extra query params** - each one is a 400.
- **401, not 403,** for a missing or bad token.
- **`badge` can be `null`** (no badge configured - always for AI Labs). Do not render a badge slot.
- **`badge.id` can be `null`** while `badge.state` is `NOT_ISSUED`. Never send a null `badge_id` to the
  claim API.
- **`course.course_type` can be `null`** for archived reels. They only appear when no `course_type`
  filter is set.
- **`course.slug` is null** for AI Labs and archived items - do not build a link.
- **`course.thumbnail` is null** for archived items - use a placeholder.
- **`feedback_required: false`** for archived items - do not show a feedback prompt.
- **Requirement fields `null`** mean "not configured by admin yet", not zero.
- **`state_boards: []`** - the learner has not picked a board; hide the progress section or prompt them
  to choose one.
- **Rounding:** totals are rounded to 2 decimals separately, so a sum of parts can be 0.01 off the total.
- **Certificates list** is only awards that have a certificate; the credits table can show more rows
  than the certificates list for the same year.
- **NASBA download** needs `fetch` + blob because of the bearer header.

---

## 10. Quick test list (UAT)

Replace `$TOKEN` with a learner access token.

```bash
H="Authorization: Bearer $TOKEN"; B="https://uat-api.milescaira.com/web-api/v1/cpe-tracker"

curl -s "$B/summary/?year=2026" -H "$H"
curl -s "$B/credits/?ledger=caira&year=2026&page_size=15" -H "$H"
curl -s "$B/credits/?ledger=others&year=2026&course_type=webinar,ai_lab" -H "$H"
curl -s "$B/credits/<award_id>/certificate/" -H "$H"
curl -s "$B/certificates/?year=2026&page_size=100" -H "$H"
curl -s -o NASBA_Template.xlsx -D - "$B/nasba-template/?year=2026" -H "$H"

# expected failures
curl -s "$B/summary/" -H "$H"                          # 400 year: Field required
curl -s "$B/credits/?year=2026" -H "$H"                # 400 ledger: Field required
curl -s "$B/credits/?ledger=all&year=2026" -H "$H"     # 400 ledger must be caira|others
curl -s "$B/summary/?year=2026"                        # 401 no token
```

---

_Backend source, for reference: routes in `MilesPlatform/urls.py` (web CPE tracker block), views in
`BadgeCertificateCPE/views.py` (`WebCPETracker*ViewV1`), logic in
`BadgeCertificateCPE/utils/cpe_portfolio.py`, query rules in `BadgeCertificateCPE/utils/schemas.py`.
Error bodies, 401 bodies and query validation messages above were rendered from the real code on
2026-10-19; success examples use illustrative values with the real keys._
