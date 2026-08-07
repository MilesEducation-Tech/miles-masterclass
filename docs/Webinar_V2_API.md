# Webinar V2 APIs

Lean, paginated webinar endpoints for the mobile webinar-tab redesign. All responses carry only the fields the cards render — no v1-style full-model dumps.

**Base path:** `/api/v2/webinar/`

**Common headers**

| Header                        | Required                                      | Notes                                                                                                   |
| ----------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `X-Platform`                  | No (defaults `masterclass`)                   | Platform scoping, same as v1                                                                            |
| `Authorization: Bearer <JWT>` | Endpoints 1–2: optional. Endpoint 3: required | Logged-in requests unlock `authenticated`/`subscribers` visibility webinars and populate `registration` |

**Pagination (all endpoints)**

Query params: `page` (default 1), `page_size` (default 10, max 50).

```json
"pagination_data": {
    "total_count": 14,
    "current_page_number": 1,
    "next_page": "https://<host>/api/v2/webinar/filter/?page=2&type=this_month",
    "previous_page": null
}
```

---

## 1. Home Section

Curated hero/home rail, ordered by admin-set priority (`WebinarHomeSectionContent`).

```
GET /api/v2/webinar/home_section/?section=highlight
```

| Param     | Values                                                              |
| --------- | ------------------------------------------------------------------- |
| `section` | `highlight` \| `featured` \| `popular` \| `latest` \| `newly_added` |

## 2. Filter (upcoming webinars)

Upcoming/live webinars for the "Premiering this Month" rail.

```
GET /api/v2/webinar/filter/?type=this_month
```

| Param  | Values                                                                                  |
| ------ | --------------------------------------------------------------------------------------- |
| `type` | `futured` (default — live or upcoming) \| `this_month` \| `this_week` \| `next_30_days` |

### Response (both 1 & 2) — Webinar Card

```json
{
  "data": [
    {
      "id": 184,
      "webinar_title": "Build your first AI Agent in 2 hrs",
      "short_course_overview": "Discover how AI-native tech is reshaping accounting...",
      "horizontal_thumbnail": "https://<host>/media/static/banner/hero_h.png",
      "vertical_thumbnail": "https://<host>/media/static/banner/hero_v.png",
      "square_thumbnail": "https://<host>/media/static/banner/hero_sq.png",
      "webinar_credits": 1.0,
      "awards_cpe": true,
      "is_free": true,
      "series": "ai-accounting-101",
      "series_name": "AI Accounting 101",
      "badge": {
        "name": "AI in Accounting 101",
        "icon_url": "https://images.credly.com/.../badge.png"
      },
      "fields_of_study": [{ "id": 12, "name": "Communication & Marketing", "cpe_credits": 1.0 }],
      "next_session": {
        "id": 411,
        "session_title": "Session 1",
        "start_date": "2026-08-07T16:00:00Z",
        "end_date": "2026-08-07T18:00:00Z"
      },
      "registration": {
        "is_registered": true,
        "enrollment_id": 90211,
        "webinar_date_id": 411,
        "join_url": "https://zoom.us/w/95752387661?tk=..."
      }
    }
  ],
  "pagination_data": { "...": "..." },
  "status_code": 200,
  "message": "Return is successful!!!"
}
```

Field notes:

- `series` / `series_name` — `null` for normal webinars. Non-null means the webinar is part of a recurring series (show the series chip).
- `badge` — `null` when no badge is mapped ("Badge included" chip hidden).
- `next_session` — the soonest upcoming session; `null` if none. Use `next_session.id` as `webinar_date_id` when registering.
- `registration` — `{"is_registered": false}` for anonymous / unregistered users.

---

## 3. Enrollments (Your Webinars)

The logged-in user's webinars. **Auth required.**

```
GET /api/v2/webinar/enrollments/?type=upcoming
```

| `type`               | Rail                                  | Filter                                                         |
| -------------------- | ------------------------------------- | -------------------------------------------------------------- |
| `upcoming` (default) | Upcoming — Join Now / Manage Bookings | session not yet ended, soonest first                           |
| `registered`         | Registered (incl. NOT ATTENDED tags)  | `attendance_status = Pending`                                  |
| `completed`          | Completed                             | `attendance_status ∈ Present, Attended, Absent` (session over) |
| `absent`             | Absent                                | `attendance_status = Absent`                                   |

### Response — Enrollment Card

```json
{
  "data": [
    {
      "id": 90211,
      "attendance_status": "Present",
      "join_url": "https://zoom.us/w/95752387661?tk=...",
      "webinar": {
        "id": 184,
        "webinar_title": "Visual Analytics & Insights with Power BI in Microsoft Fabric",
        "horizontal_thumbnail": "https://<host>/media/static/banner/h.png",
        "vertical_thumbnail": "https://<host>/media/static/banner/v.png",
        "square_thumbnail": "https://<host>/media/static/banner/sq.png",
        "webinar_credits": 2.5,
        "awards_cpe": true,
        "series": "ai-accounting-101",
        "series_name": "AI Accounting 101",
        "badge": { "name": "CAIRA Level 1", "icon_url": "https://.../badge.png" }
      },
      "session": {
        "id": 411,
        "session_title": "Session 1",
        "start_date": "2026-11-10T08:30:00Z",
        "end_date": "2026-11-10T10:30:00Z"
      },
      "eligibility": {
        "attended_minutes": 110,
        "total_minutes": 120,
        "polls_answered": 7,
        "polls_required": 8,
        "is_eligible": true,
        "cpe_awarded": true,
        "series_already_awarded": false
      },
      "feedback_submitted": false
    }
  ],
  "pagination_data": { "...": "..." },
  "status_code": 200,
  "message": "Return is successful!!!"
}
```

Field notes:

- `attendance_status` — `Pending` | `Present` | `Attended` | `Absent`.
- `eligibility.is_eligible` — met the attendance + poll rules for THIS session.
- `eligibility.cpe_awarded` — CPE credit actually granted for THIS session. Can be `false` even when `is_eligible` is `true` (series dedup).
- `eligibility.series_already_awarded` — user already earned CPE/badge/certificate from a **different** webinar of the same series.
- Certificates are NOT in this payload — use the existing certificate download API.

### UI mapping (Completed rail)

| Card state                                                                               | Condition                                               |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| ELIGIBLE + "Congrats! You've unlocked badge, certificates & CPE credits" + Give Feedback | `is_eligible && cpe_awarded` (+ `!feedback_submitted`)  |
| "Already earned in the <series_name> series"                                             | `is_eligible && !cpe_awarded && series_already_awarded` |
| ATTENDED + "Not Eligible for Badge & CPE Credits"                                        | `attendance_status == "Attended"` or `!is_eligible`     |

"110/120 Minutes | 7 out of 8 Poll Question Answered" ⇒ `attended_minutes`/`total_minutes` + `polls_answered`/`polls_required`.

---

## Errors

| Case                        | Status | Body                                                         |
| --------------------------- | ------ | ------------------------------------------------------------ |
| Invalid `section` / `type`  | 400    | `{"data": [], "status_code": 400, "message": "Invalid ..."}` |
| `enrollments` without token | 401    | standard auth error                                          |
| `page` beyond last          | 404    | DRF `{"detail": "Invalid page."}`                            |
