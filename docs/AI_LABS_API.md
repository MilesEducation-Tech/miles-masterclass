# AI Labs APIs - Frontend Guide

Every AI Labs route the merged backend serves (43 routes), with the request, a full success response and
the errors each one can answer. App and web twins are documented together when they answer the same
body; where they differ, both are shown.

|            |                                                                                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Base (UAT) | `https://uat-api.milescaira.com`                                                                                                                             |
| Prefixes   | `app-api/v1/...` = mobile app reads, `web-api/v1/...` = web reads, `api/v1/...` = shared (all writes)                                                        |
| Auth       | `Authorization: Bearer <Miles SSO access token>` on every route (except the webhook)                                                                         |
| Path id    | `{ai_lab_course_id}` = the AI Lab's UUID from the list / detail response                                                                                     |
| Responses  | **real local capture** = taken from the backend; **sample data** = built from the code with invented values. Keys, nesting and types are the code's in both. |
| Long lists | trimmed to 2 items; a `"_more"` entry says how many were cut                                                                                                 |

---

## 0. The learner journey - which API when

```
List labs ............ GET  courses/  +  tracks/
Open a lab ........... GET  course/<id>/            GET course-started/<id>/
Start ................ POST course-start/<id>/
Watch video .......... POST course-video-progress/      (repeat)      GET course-progress/<id>/
Quiz ................. GET  course-quiz-questions/<id>/  ->  POST course-quiz-submit/ (one per question)
Final assessment ..... GET  course-assessment-questions/<id>/  ->  POST course-assessment-submit/<id>/
AI Labs account ...... GET  account-ensure/  ->  POST account-create/  (202, wait 2-3 min, learner re-logs in)
AI practical ......... GET  assignment-brief/<id>/  +  agents/ | flows/
                       POST assignment-submit/<id>/  (202)
                       GET  assignment-status/<id>/   (poll until graded, then STOP polling)
Feedback ............. GET  course-feedback-gate/<id>/ -> course-feedback-questions/<id>/
                       POST course-feedback-submit/<id>/   (closes the lab, awards CPE)
Credits .............. GET  tokens/   POST tokens-request/
```

---

## 1. Rules for every call

**Envelope.** Every JSON response is `{"success": <bool>, "message": "<sentence>", "data": <payload>}`.
`success` follows the HTTP status. Branch on the status and `data.reason`, never on `message` text.
Empty strings never arrive - an absent value is `null`.

**Common errors (any route):**

| Status | Body (`data`)                                                                                  | Meaning / what to do                                                        |
| ------ | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 401    | `null`, message "Authentication credentials were not provided." / "Error decoding signature."  | No or expired token - refresh or sign in again. (401, not 403.)             |
| 403    | `{"status":"error","reason":"caira_access_required"}`                                          | Learner has no CAIRA access - show the upsell.                              |
| 404    | `{"status":"error","reason":"no_ai_lab_enrollment"}`                                           | Learner has not started this lab - send them to Start.                      |
| 404    | `{"status":"error","reason":"ai_lab_not_found"}`                                               | Wrong / inactive lab id.                                                    |
| 400    | `{"status":"error","reason":"invalid_body" or "invalid_query","errors":[{"field","message"}]}` | A bad or unknown field - `errors` names each one. Unknown keys are refused. |
| 500    | `{"status":"error"}`, message names what failed                                                | Unexpected - show a retry.                                                  |

---

## 2. AI practical: the AI Labs vendor states

The practical routes (agents, flows, brief, submit, status, practical-progress, tokens, tokens-request)
call AI Labs. Their extra answers:

| Status  | `data.reason`                                                                         | What to show                                                                                                                                  |
| ------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **200** | `AI_LABS_NOT_PROVISIONED` with **`is_provisioned: false`**                            | **Not an error.** The learner has no AI Labs account yet - show "Create AI Labs account" (section 7). Always check `is_provisioned` on a 200. |
| 403     | `AI_LABS_ACCESS_DENIED` / `AI_LABS_TOKEN_REJECTED`                                    | AI Labs refused this session - usually the login token is older than the account. Ask the learner to **sign out and in again**.               |
| 429     | `AI_LABS_RATE_LIMITED`                                                                | Busy - retry shortly.                                                                                                                         |
| 502     | `AI_LABS_CALL_FAILED` / `AI_LABS_RESPONSE_UNREADABLE` / `AI_LABS_ASSIGNMENT_MISMATCH` | AI Labs could not be reached / answered oddly. Nothing was changed.                                                                           |
| 503     | `AI_LABS_LMS_UNCONFIGURED`                                                            | AI Labs is switched off in this environment.                                                                                                  |
| 400     | `no_sso_handle`                                                                       | The learner's account has no SSO id - a backend data issue, report it.                                                                        |

**After `account-create`, the learner must sign in again** before agents / flows / submit work: AI Labs reads
the AI Labs entitlement from the login token, and only a fresh token carries it. If `account-create` answers
`ACCOUNT_EXISTS` with `entitlement_refresh_required: true`, force a re-login.

---

## 3. Catalogue

### AI Lab list (app and web differ)

- **App:** `GET /app-api/v1/ai-labs/courses/`
- **Web:** `GET /web-api/v1/ai-labs/courses/`
- **When:** The AI Labs listing screen. Paged.
- **Replaces legacy:** `/ai-labs/courses/`
- **Changed from legacy:** Keys snake_cased (AI_Lab_Course_Name -> ai_lab_course_name), cpe_credit/cpe_credit_label dropped from cards, ai_lab_course_total_duration_seconds added, undeclared query params now 400; app keeps {count,page,page_size,results} inside the envelope.
- **Backend:** `AppAILabCourseListViewV1` (AILabs/views.py:3395)

**Request**

`GET /app-api/v1/ai-labs/courses/?page=1&page_size=12`

No body.

**Response 200 - app** (real local capture)

```json
{
  "success": true,
  "message": "Data retrieved successfully.",
  "data": {
    "count": 6,
    "page": 1,
    "page_size": 12,
    "results": [
      {
        "id": "f6570df7-0ad9-4463-9a4d-75df10e14d59",
        "ai_lab_course_name": "Lease Audit Agent",
        "ai_lab_course_agent_flow_name": "Lease Audit Agent",
        "ai_lab_course_mini_description": "Build a lease assurance agent that compares lease contracts to schedules and flags exceptions for review.",
        "ai_lab_course_horizontal_thumbnail_url": "https://milesone-backend-assets.s3.ap-south-1.amazonaws.com/MilesOne/Masterclass/Chapter_Thumbnails/Horizontal/Episode_02_Vtgw3oB.jpg",
        "ai_lab_course_vertical_thumbnail_url": null,
        "ai_lab_course_square_thumbnail_url": null,
        "ai_lab_course_total_duration": "44 minutes",
        "ai_lab_course_order": 1,
        "ai_lab_course_access_duration_days": 30,
        "ai_lab_course_total_duration_seconds": 9559,
        "lock_state": {
          "locked": false,
          "lock_reason": null,
          "lock_remark": null,
          "masterclass_course_id": "7158ee5b-5cff-442c-b217-9703379e2cf8",
          "credit_source": null
        }
      },
      {
        "id": "47ecd850-08ff-4342-abf2-9a432ba43e6a",
        "ai_lab_course_name": "Revenue Recognition Agent",
        "ai_lab_course_agent_flow_name": "Revenue Recognition Agent",
        "ai_lab_course_mini_description": "Build a Copilot Studio agent to process contracts and create ASC 606 revenue schedules for audit review.",
        "ai_lab_course_horizontal_thumbnail_url": "https://milesone-backend-assets.s3.ap-south-1.amazonaws.com/MilesOne/Masterclass/Chapter_Thumbnails/Horizontal/Episode_01_d3TIPwd.jpg",
        "ai_lab_course_vertical_thumbnail_url": null,
        "ai_lab_course_square_thumbnail_url": null,
        "ai_lab_course_total_duration": "22 minutes",
        "ai_lab_course_order": 2,
        "ai_lab_course_access_duration_days": 30,
        "ai_lab_course_total_duration_seconds": 9559,
        "lock_state": {
          "locked": false,
          "lock_reason": null,
          "lock_remark": null,
          "masterclass_course_id": "7158ee5b-5cff-442c-b217-9703379e2cf8",
          "credit_source": null
        }
      },
      {
        "_more": "4 more item(s) with the same shape"
      }
    ]
  }
}
```

**Response 200 - web** (real local capture)

```json
{
  "success": true,
  "message": "Data retrieved successfully.",
  "data": {
    "slug": "ai_labs_courses_web",
    "count": 6,
    "page": 1,
    "page_size": 6,
    "total_pages": 1,
    "has_next": false,
    "has_previous": false,
    "next": null,
    "previous": null,
    "results": [
      {
        "id": "f6570df7-0ad9-4463-9a4d-75df10e14d59",
        "ai_lab_course_name": "Lease Audit Agent",
        "ai_lab_course_agent_flow_name": "Lease Audit Agent",
        "ai_lab_course_mini_description": "Build a lease assurance agent that compares lease contracts to schedules and flags exceptions for review.",
        "ai_lab_course_horizontal_thumbnail_url": "https://milesone-backend-assets.s3.ap-south-1.amazonaws.com/MilesOne/Masterclass/Chapter_Thumbnails/Horizontal/Episode_02_Vtgw3oB.jpg",
        "ai_lab_course_vertical_thumbnail_url": null,
        "ai_lab_course_square_thumbnail_url": null,
        "ai_lab_course_total_duration": "44 minutes",
        "ai_lab_course_order": 1,
        "ai_lab_course_access_duration_days": 30,
        "ai_lab_course_total_duration_seconds": 9559,
        "lock_state": {
          "locked": false,
          "lock_reason": null,
          "lock_remark": null,
          "masterclass_course_id": "7158ee5b-5cff-442c-b217-9703379e2cf8",
          "credit_source": null
        }
      },
      {
        "id": "47ecd850-08ff-4342-abf2-9a432ba43e6a",
        "ai_lab_course_name": "Revenue Recognition Agent",
        "ai_lab_course_agent_flow_name": "Revenue Recognition Agent",
        "ai_lab_course_mini_description": "Build a Copilot Studio agent to process contracts and create ASC 606 revenue schedules for audit review.",
        "ai_lab_course_horizontal_thumbnail_url": "https://milesone-backend-assets.s3.ap-south-1.amazonaws.com/MilesOne/Masterclass/Chapter_Thumbnails/Horizontal/Episode_01_d3TIPwd.jpg",
        "ai_lab_course_vertical_thumbnail_url": null,
        "ai_lab_course_square_thumbnail_url": null,
        "ai_lab_course_total_duration": "22 minutes",
        "ai_lab_course_order": 2,
        "ai_lab_course_access_duration_days": 30,
        "ai_lab_course_total_duration_seconds": 9559,
        "lock_state": {
          "locked": false,
          "lock_reason": null,
          "lock_remark": null,
          "masterclass_course_id": "7158ee5b-5cff-442c-b217-9703379e2cf8",
          "credit_source": null
        }
      },
      {
        "_more": "4 more item(s) with the same shape"
      }
    ]
  }
}
```

**Errors**

| Status | `data.reason`          |
| ------ | ---------------------- |
| 400    | `invalid_query`        |
| 401    | - (no / expired token) |
| 500    | - (unexpected error)   |

---

### Tracks (app and web differ)

- **App:** `GET /app-api/v1/ai-labs/tracks/`
- **Web:** `GET /web-api/v1/ai-labs/tracks/`
- **When:** Filter chips / track headers on the listing.
- **Changed from legacy:** New in merged: no legacy counterpart (legacy only offered ?track= as a filter on ai-labs/courses/). Returns [{id,name,priority}] of tracks used by visible labs.
- **Backend:** `AppAILabTrackListViewV1` (AILabs/views.py:3526)

**Request**

`GET /app-api/v1/ai-labs/tracks/?page=1&page_size=12`

No body.

**Response 200 - app** (real local capture)

```json
{
  "success": true,
  "message": "Data retrieved successfully.",
  "data": {
    "count": 1,
    "page": 1,
    "page_size": 12,
    "results": [
      {
        "id": "0b37a04d-2321-4cc1-873d-2526b0117cc4",
        "name": "Applied AI Across Functions",
        "priority": 2
      }
    ]
  }
}
```

**Response 200 - web** (real local capture)

```json
{
  "success": true,
  "message": "Data retrieved successfully.",
  "data": {
    "slug": "ai_labs_tracks_web",
    "count": 1,
    "page": 1,
    "page_size": 6,
    "total_pages": 1,
    "has_next": false,
    "has_previous": false,
    "next": null,
    "previous": null,
    "results": [
      {
        "id": "0b37a04d-2321-4cc1-873d-2526b0117cc4",
        "name": "Applied AI Across Functions",
        "priority": 2
      }
    ]
  }
}
```

**Errors**

| Status | `data.reason`          |
| ------ | ---------------------- |
| 401    | - (no / expired token) |
| 500    | - (unexpected error)   |

---

### One AI Lab

- **App:** `GET /app-api/v1/ai-labs/course/<uuid:ai_lab_course_id>/`
- **Web:** `GET /web-api/v1/ai-labs/course/<uuid:ai_lab_course_id>/`
- **When:** The lab's detail page: content, chapters, CPE, lock state.
- **Replaces legacy:** `/ai-labs/course/<uuid:ai_lab_course_id>/`
- **Changed from legacy:** Path app-api/v1/ai-labs/course/<uuid>/ (was ai-labs/course/<uuid>/); keys snake_cased; exercise_files, glossary fields and cpe_credit/cpe_credit_label dropped; fields_of_study now objects plus total_cpe_credits; ai_lab_course_total_duration_seconds and child duration_seconds added; enveloped.
- **Backend:** `AppAILabCourseDetailViewV1` (AILabs/views.py:3576)

**Request**

`GET /app-api/v1/ai-labs/course/{ai_lab_course_id}/`

No body.

**Response 200** (real local capture)

```json
{
  "success": true,
  "message": "Data retrieved successfully.",
  "data": {
    "id": "f6570df7-0ad9-4463-9a4d-75df10e14d59",
    "ai_lab_course_name": "Lease Audit Agent",
    "ai_lab_course_agent_flow_name": "Lease Audit Agent",
    "ai_lab_course_mini_description": "Build a lease assurance agent that compares lease contracts to schedules and flags exceptions for review.",
    "ai_lab_course_horizontal_thumbnail_url": "https://milesone-backend-assets.s3.ap-south-1.amazonaws.com/MilesOne/Masterclass/Chapter_Thumbnails/Horizontal/Episode_02_Vtgw3oB.jpg",
    "ai_lab_course_vertical_thumbnail_url": null,
    "ai_lab_course_square_thumbnail_url": null,
    "ai_lab_course_total_duration": "44 minutes",
    "ai_lab_course_order": 1,
    "ai_lab_course_access_duration_days": 30,
    "ai_lab_course_description": "Build a lease assurance agent that compares lease contracts to schedules and flags exceptions for review.",
    "ai_lab_course_problem_statement": "Build a lease assurance agent that compares lease contracts to schedules and flags exceptions for review. This lab is the hands-on build behind 'Smarter Lease Testing'.",
    "ai_lab_course_sharepoint_artefact_url": null,
    "ai_lab_course_trailer_url": null,
    "ai_lab_course_trailer_thumbnail": null,
    "ai_lab_course_exam_rules": "Complete the lab video, clear the AI assessment and submit the feedback form. The assessment is scored by the Miles AI Labs service; a pass is required before credit is issued.",
    "ai_lab_course_prerequisite_education": "None.",
    "ai_lab_course_advance_preparation": "None.",
    "ai_lab_course_created_at": "2026-10-12T11:04:12.732249Z",
    "ai_kit": null,
    "ai_lab_course_total_duration_seconds": 9559,
    "levels": [],
    "tracks": ["Applied AI Across Functions"],
    "fields_of_study": [
      {
        "id": "0c199ae8-74c7-4f03-ba25-6474685901e2",
        "name": "Information Technology",
        "cpe_credit": 3.0
      }
    ],
    "total_cpe_credits": 3.0,
    "instructors": ["Uttam Pai"],
    "skills": [],
    "tools": ["Copilot"],
    "learning_objectives": [
      "Identify appropriate uses of generative AI in audit, focusing on validation, documentation, and regulatory compliance in areas like leases, client communications, and audits.",
      "Identify appropriate uses of generative AI in audit, focusing on validation, documentation, and regulatory compliance in areas like leases, client communications, and audits.",
      {
        "_more": "2 more item(s) with the same shape"
      }
    ],
    "masterclass_courses": [
      {
        "id": "7158ee5b-5cff-442c-b217-9703379e2cf8",
        "name": "Design Audit Workflows with Copilot Studio",
        "mini_description": "Build Copilot Studio agents that automate audit workflows while keeping judgment and review with the auditor.",
        "thumbnail": "https://milesone-backend-assets.s3.ap-south-1.amazonaws.com/MilesOne/Masterclass/Course_Thumbnails/Horizontal/Horizontal_XPa2NfJ.jpg",
        "duration": "4 hours 41 minutes",
        "duration_seconds": 9559
      }
    ],
    "lock_state": {
      "locked": false,
      "lock_reason": null,
      "lock_remark": null,
      "masterclass_course_id": "7158ee5b-5cff-442c-b217-9703379e2cf8",
      "credit_source": null
    }
  }
}
```

**Errors**

| Status | `data.reason`          |
| ------ | ---------------------- |
| 404    | `ai_lab_not_found`     |
| 401    | - (no / expired token) |
| 500    | - (unexpected error)   |

---

## 4. Starting and progress

### Start a lab

- **POST** `/api/v1/ai-labs/course-start/<uuid:ai_lab_course_id>/` (shared by app and web)
- **When:** The learner taps Start. Creates the enrolment.
- **Replaces legacy:** `/ai-labs/course/<uuid:ai_lab_course_id>/start/`
- **Changed from legacy:** Path moved from ai-labs/course/<uuid>/start/ to api/v1/ai-labs/course-start/<uuid>/; response wrapped in {success,message,data}; 409 reasons now credit_already_earned_via_course | started_via_masterclass_course (lock keyed on the PARENT course).
- **Backend:** `AILabCourseStartViewV1` (AILabs/views.py:956)

**Request**

`POST /api/v1/ai-labs/course-start/{ai_lab_course_id}/`

No body.

**Response 201** (real local capture)

```json
{
  "success": true,
  "message": "Request completed successfully.",
  "data": {
    "status": "ok",
    "ai_lab_course_id": "f6570df7-0ad9-4463-9a4d-75df10e14d59",
    "enrollment_id": "b248d5ff-1911-48a4-921d-0ecaaa166596",
    "enrollment_created": true,
    "started_at": "2026-10-16T15:08:56.484018Z",
    "expires_at": "2026-11-15T15:08:56.484018Z",
    "is_course_closed": false,
    "disabled_masterclass_course_id": "7158ee5b-5cff-442c-b217-9703379e2cf8"
  }
}
```

**Errors**

| Status | `data.reason`                      |
| ------ | ---------------------------------- |
| 403    | `caira_access_required`            |
| 404    | `ai_lab_not_found`                 |
| 409    | `credit_already_earned_via_course` |
| 409    | `started_via_masterclass_course`   |
| 401    | - (no / expired token)             |
| 500    | - (unexpected error)               |

---

### Has the learner started this lab?

- **App:** `GET /app-api/v1/ai-labs/course-started/<uuid:ai_lab_course_id>/`
- **Web:** `GET /web-api/v1/ai-labs/course-started/<uuid:ai_lab_course_id>/`
- **When:** Decide Start vs Continue on the detail page.
- **Replaces legacy:** `/ai-labs/course/<uuid:ai_lab_course_id>/started/`
- **Changed from legacy:** Path app-api/v1/ai-labs/course-started/<uuid>/ (was ai-labs/course/<uuid>/started/); same {started, can_start, enrollment, lock_state} body with snake_case enrollment keys, inside the envelope; lock_reason vocabulary changed (parent-course lock).
- **Backend:** `AppAILabCourseStartedStatusViewV1` (AILabs/views.py:3628)

**Request**

`GET /app-api/v1/ai-labs/course-started/{ai_lab_course_id}/`

No body.

**Response 200** (real local capture)

```json
{
  "success": true,
  "message": "Data retrieved successfully.",
  "data": {
    "ai_lab_course_id": "f6570df7-0ad9-4463-9a4d-75df10e14d59",
    "started": true,
    "can_start": false,
    "enrollment": {
      "id": "b248d5ff-1911-48a4-921d-0ecaaa166596",
      "ai_lab_enrollment_started_at": "2026-10-16T15:08:56.484018Z",
      "ai_lab_enrollment_expires_at": "2026-11-15T15:08:56.484018Z",
      "ai_lab_enrollment_active": true,
      "ai_lab_enrollment_is_course_closed": false,
      "released_from_ai_lab": false,
      "released_from_ai_lab_at": null,
      "released_from_ai_lab_reason": null
    },
    "lock_state": {
      "locked": false,
      "lock_reason": null,
      "lock_remark": null,
      "masterclass_course_id": "7158ee5b-5cff-442c-b217-9703379e2cf8",
      "credit_source": null
    }
  }
}
```

**Errors**

| Status | `data.reason`          |
| ------ | ---------------------- |
| 401    | - (no / expired token) |
| 500    | - (unexpected error)   |

---

### Lab progress

- **App:** `GET /app-api/v1/ai-labs/course-progress/<uuid:ai_lab_course_id>/`
- **Web:** `GET /web-api/v1/ai-labs/course-progress/<uuid:ai_lab_course_id>/`
- **When:** The progress bar / which step is next.
- **Replaces legacy:** `/ai-labs/course/<uuid:ai_lab_course_id>/progress/`
- **Changed from legacy:** Path app-api/v1/ai-labs/course-progress/<uuid>/ (was ai-labs/course/<uuid>/progress/); same flow keys plus a new nasba block {eligible, delivery_method, outstanding:[{rule,code,message,required,actual}]}; enveloped.
- **Backend:** `AppAILabCourseProgressViewV1` (AILabs/views.py:3680)

**Request**

`GET /app-api/v1/ai-labs/course-progress/{ai_lab_course_id}/`

No body.

**Response 200** (sample data)

```json
{
  "success": true,
  "message": "Data retrieved successfully.",
  "data": {
    "ai_lab_course_id": "f6570df7-0ad9-4463-9a4d-75df10e14d59",
    "video_watched_seconds": 2613,
    "video_completed": true,
    "quiz_required": true,
    "quiz_passed": true,
    "quiz_questions_to_show": 5,
    "assessment_required": true,
    "final_assessment_passed": true,
    "ai_assessment_completed": true,
    "feedback_submitted": false,
    "cpe_awarded": false,
    "is_course_closed": false,
    "next_step": "feedback",
    "nasba": {
      "eligible": true,
      "delivery_method": "QAS Self Study",
      "outstanding": []
    }
  }
}
```

**Errors**

| Status | `data.reason`          |
| ------ | ---------------------- |
| 404    | `no_ai_lab_enrollment` |
| 401    | - (no / expired token) |
| 500    | - (unexpected error)   |

---

### Save video progress

- **POST** `/api/v1/ai-labs/course-video-progress/` (shared by app and web)
- **When:** Every few seconds while the video plays.
- **Replaces legacy:** `/ai-labs/course/<uuid:ai_lab_course_id>/video-progress/`
- **Changed from legacy:** Lab id moved from the URL path into the body (ai_lab_course_id); path api/v1/ai-labs/course-video-progress/; undeclared body keys now 400; enveloped.
- **Backend:** `AILabCourseVideoProgressViewV1` (AILabs/views.py:1435)

**Request**

`POST /api/v1/ai-labs/course-video-progress/`

Body:

```json
{
  "ai_lab_course_id": "{ai_lab_course_id}",
  "watched_duration_seconds": 120
}
```

**Response 200** (real local capture)

```json
{
  "success": true,
  "message": "Request completed successfully.",
  "data": {
    "status": "ok",
    "ai_lab_course_id": "f6570df7-0ad9-4463-9a4d-75df10e14d59",
    "watched_seconds": 120,
    "duration_seconds": 2613,
    "video_completed": false,
    "just_completed": false,
    "next_step": "video"
  }
}
```

**Errors**

| Status | `data.reason`          |
| ------ | ---------------------- |
| 400    | `invalid_body`         |
| 404    | `no_ai_lab_enrollment` |
| 401    | - (no / expired token) |
| 500    | - (unexpected error)   |

---

### Release a lab (STAFF ONLY)

- **POST** `/api/v1/ai-labs/course-release/` (shared by app and web)
- **When:** Admin/QA tool - a learner gets 403.
- **Replaces legacy:** `/ai-labs/course/release/`
- **Changed from legacy:** Now ADMIN ONLY (IsAdminUser) - a learner who called legacy ai-labs/course/release/ now gets 403; response drops final_assessment_restored/masterclass_course_id for released_masterclass_course_id.
- **Backend:** `AILabCourseReleaseViewV1` (AILabs/views.py:1244)

**Request**

`POST /api/v1/ai-labs/course-release/`

Body:

```json
{
  "ai_lab_course_id": "{ai_lab_course_id}",
  "reason": "abandoned",
  "external_ref": "fe-release-001"
}
```

**Response 200** (sample data)

```json
{
  "success": true,
  "message": "Request completed successfully.",
  "data": {
    "status": "ok",
    "ai_lab_course_id": "f6570df7-0ad9-4463-9a4d-75df10e14d59",
    "enrollment_id": "b248d5ff-1911-48a4-921d-0ecaaa166596",
    "already_released": false,
    "released_masterclass_course_id": "d8b646ce-1e58-4be4-9df8-c4da258fd1f5"
  }
}
```

**Errors**

| Status | `data.reason`          |
| ------ | ---------------------- |
| 400    | `invalid_body`         |
| 404    | `enrollment_not_found` |
| 401    | - (no / expired token) |
| 500    | - (unexpected error)   |

---

## 5. Quiz

### Quiz questions

- **App:** `GET /app-api/v1/ai-labs/course-quiz-questions/<uuid:ai_lab_course_id>/`
- **Web:** `GET /web-api/v1/ai-labs/course-quiz-questions/<uuid:ai_lab_course_id>/`
- **When:** After the video is complete.
- **Replaces legacy:** `/ai-labs/course/<uuid:ai_lab_course_id>/quiz/questions/`
- **Changed from legacy:** Path app-api/v1/ai-labs/course-quiz-questions/<uuid>/ (was ai-labs/course/<uuid>/quiz/questions/); question keys come from MasterclassQuizQuestionSerializer (snake_case) instead of CAIRA_Masterclass_Question_*; enveloped.
- **Backend:** `AppAILabQuizQuestionsViewV1` (AILabs/views.py:3732)

**Request**

`GET /app-api/v1/ai-labs/course-quiz-questions/{ai_lab_course_id}/`

No body.

**Response 200** (sample data)

```json
{
  "success": true,
  "message": "Data retrieved successfully.",
  "data": {
    "ai_lab_course_id": "f6570df7-0ad9-4463-9a4d-75df10e14d59",
    "ai_lab_chapter_id": "a4e39360-3fed-44aa-973e-7065cdd22350",
    "questions_to_show": 2,
    "resumed": false,
    "answered_count": 0,
    "questions": [
      {
        "id": "10450851-df15-4b15-9135-1dc3ae4b0c7a",
        "question_text": "<p>Which control best reduces the risk of an AI agent posting unapproved journal entries?</p>",
        "question_type": "single",
        "options": [
          {
            "id": "ba24cb7b-175a-49dc-ac03-efae98543569",
            "text": "<p>Require human approval before entries are posted to the ledger</p>",
            "order": 1
          },
          {
            "id": "9785bd80-1823-412c-983f-fb33322dcff1",
            "text": "<p>Increase the model's temperature setting</p>",
            "order": 2
          },
          {
            "_more": "1 more item(s) with the same shape"
          }
        ],
        "is_answered": false
      },
      {
        "id": "3ab00f3b-262b-47e6-87d4-c9a80cbdaad5",
        "question_text": "<p>In Copilot Studio, what does a topic trigger phrase do?</p>",
        "question_type": "single",
        "options": [
          {
            "id": "daa71dbf-7354-4c8f-bcb8-9ae43d662cb5",
            "text": "<p>Routes a user message to the matching conversation topic</p>",
            "order": 1
          },
          {
            "id": "3ba86c08-0f21-4b89-baaa-21e5dd62bc58",
            "text": "<p>Encrypts the conversation transcript</p>",
            "order": 2
          },
          {
            "_more": "1 more item(s) with the same shape"
          }
        ],
        "is_answered": false
      }
    ]
  }
}
```

**Errors**

| Status | `data.reason`          |
| ------ | ---------------------- |
| 403    | `video_not_complete`   |
| 404    | `no_ai_lab_enrollment` |
| 404    | `no_quiz_config`       |
| 409    | `already_completed`    |
| 401    | - (no / expired token) |
| 500    | - (unexpected error)   |

---

### Submit one quiz answer

- **POST** `/api/v1/ai-labs/course-quiz-submit/` (shared by app and web)
- **When:** One call per question; the last one completes the quiz.
- **Replaces legacy:** `/ai-labs/course/<uuid:ai_lab_course_id>/quiz/submit/`
- **Changed from legacy:** Lab id moved from the path (ai-labs/course/<uuid>/quiz/submit/) into the body; enveloped; strict body (undeclared keys 400).
- **Backend:** `AILabQuizSubmitViewV1` (AILabs/views.py:2015)

**Request**

`POST /api/v1/ai-labs/course-quiz-submit/`

Body:

```json
{
  "ai_lab_course_id": "{ai_lab_course_id}",
  "question_id": "10450851-df15-4b15-9135-1dc3ae4b0c7a",
  "selected_option_ids": ["ba24cb7b-175a-49dc-ac03-efae98543569"]
}
```

**Response 200** (sample data)

```json
{
  "success": true,
  "message": "Request completed successfully.",
  "data": {
    "ai_lab_course_id": "f6570df7-0ad9-4463-9a4d-75df10e14d59",
    "question_id": "10450851-df15-4b15-9135-1dc3ae4b0c7a",
    "is_correct": true,
    "correct_option_ids": ["ba24cb7b-175a-49dc-ac03-efae98543569"],
    "explanation": "Posting rights stay with a human approver, so an AI agent can prepare an entry but cannot post it without a recorded approval.",
    "options_feedback": [
      {
        "id": "ba24cb7b-175a-49dc-ac03-efae98543569",
        "text": "<p>Require human approval before entries are posted to the ledger</p>",
        "is_correct": true,
        "explanation": "Correct. A maker-checker approval step is a preventive control over the agent's output."
      },
      {
        "id": "9785bd80-1823-412c-983f-fb33322dcff1",
        "text": "<p>Increase the model's temperature setting</p>",
        "is_correct": false,
        "explanation": "Temperature changes output randomness; it is not a control over posting."
      },
      {
        "_more": "1 more item(s) with the same shape"
      }
    ],
    "answers_submitted": 2,
    "total_questions": 2,
    "is_quiz_completed": true,
    "score_percent": 100.0
  }
}
```

**Errors**

| Status | `data.reason`          |
| ------ | ---------------------- |
| 400    | `invalid_body`         |
| 400    | `invalid_question`     |
| 403    | `video_not_complete`   |
| 404    | `no_ai_lab_enrollment` |
| 404    | `no_quiz_config`       |
| 409    | `already_answered`     |
| 409    | `already_completed`    |
| 401    | - (no / expired token) |
| 500    | - (unexpected error)   |

---

## 6. Final assessment (MCQ)

### Final assessment questions

- **App:** `GET /app-api/v1/ai-labs/course-assessment-questions/<uuid:ai_lab_course_id>/`
- **Web:** `GET /web-api/v1/ai-labs/course-assessment-questions/<uuid:ai_lab_course_id>/`
- **When:** After the quiz is complete.
- **Replaces legacy:** `/ai-labs/course/<uuid:ai_lab_course_id>/assessment/questions/`
- **Changed from legacy:** Path app-api/v1/ai-labs/course-assessment-questions/<uuid>/ (was ai-labs/course/<uuid>/assessment/questions/); same top-level keys, question objects snake_cased; enveloped.
- **Backend:** `AppAILabAssessmentQuestionsViewV1` (AILabs/views.py:3784)

**Request**

`GET /app-api/v1/ai-labs/course-assessment-questions/{ai_lab_course_id}/`

No body.

**Response 200** (sample data)

```json
{
  "success": true,
  "message": "Data retrieved successfully.",
  "data": {
    "ai_lab_course_id": "f6570df7-0ad9-4463-9a4d-75df10e14d59",
    "questions_to_show": 2,
    "pass_threshold_percent": 70.0,
    "exam_rules": "<p>Answer all 2 questions. You need 70% to pass. After a failed attempt you must wait 30 minutes before retrying.</p>",
    "previous_attempts": 0,
    "questions": [
      {
        "id": "b4fcae42-a90a-445f-bb4c-611f380c3efe",
        "question_text": "<p>An AI agent reconciles bank statements. Which evidence best supports reliance on its output during an audit?</p>",
        "question_type": "single",
        "options": [
          {
            "id": "756fcf51-317e-4cd0-84ad-1803455e8a40",
            "text": "<p>Documented testing of the agent's matching logic against known exceptions</p>",
            "order": 1
          },
          {
            "id": "a01d062e-b9b7-4118-acf7-fa525efea6e6",
            "text": "<p>The vendor's marketing brochure</p>",
            "order": 2
          },
          {
            "_more": "1 more item(s) with the same shape"
          }
        ]
      },
      {
        "id": "c0f57881-d0f7-4c9b-867a-77637e2c89ec",
        "question_text": "<p>Which TWO practices reduce hallucination risk when an agent drafts variance commentary?</p>",
        "question_type": "multi",
        "options": [
          {
            "id": "82b00e71-62f2-4b6d-aafd-2f4f78c47435",
            "text": "<p>Ground the agent on the trial balance and budget files</p>",
            "order": 1
          },
          {
            "id": "584d6a2c-b607-4efd-a9e5-9e6b53269a1e",
            "text": "<p>Require the agent to cite the source line for each figure</p>",
            "order": 2
          },
          {
            "_more": "1 more item(s) with the same shape"
          }
        ]
      }
    ]
  }
}
```

**Errors**

| Status | `data.reason`          |
| ------ | ---------------------- |
| 403    | `cool_off_active`      |
| 403    | `quiz_not_complete`    |
| 403    | `video_not_complete`   |
| 404    | `no_ai_lab_enrollment` |
| 404    | `no_assessment_config` |
| 409    | `already_passed`       |
| 401    | - (no / expired token) |
| 500    | - (unexpected error)   |

---

### Submit the final assessment

- **POST** `/api/v1/ai-labs/course-assessment-submit/<uuid:ai_lab_course_id>/` (shared by app and web)
- **When:** All answers in one call.
- **Replaces legacy:** `/ai-labs/course/<uuid:ai_lab_course_id>/assessment/submit/`
- **Changed from legacy:** Path api/v1/ai-labs/course-assessment-submit/<uuid>/ (was ai-labs/course/<uuid>/assessment/submit/); every answer must now carry a selection (blank answers 400) and undeclared keys 400; enveloped.
- **Backend:** `AILabAssessmentSubmitViewV1` (AILabs/views.py:2373)

**Request**

`POST /api/v1/ai-labs/course-assessment-submit/{ai_lab_course_id}/`

Body:

```json
{
  "answers": [
    {
      "question_id": "b4fcae42-a90a-445f-bb4c-611f380c3efe",
      "selected_option_ids": ["756fcf51-317e-4cd0-84ad-1803455e8a40"]
    },
    {
      "question_id": "c0f57881-d0f7-4c9b-867a-77637e2c89ec",
      "selected_option_ids": [
        "82b00e71-62f2-4b6d-aafd-2f4f78c47435",
        "584d6a2c-b607-4efd-a9e5-9e6b53269a1e"
      ]
    }
  ]
}
```

**Response 200** (sample data)

```json
{
  "success": true,
  "message": "Request completed successfully.",
  "data": {
    "passed": true,
    "score_percent": 100.0,
    "pass_threshold_percent": 70.0,
    "answers": [
      {
        "question_id": "b4fcae42-a90a-445f-bb4c-611f380c3efe",
        "is_correct": true,
        "explanation": "Testing the agent's matching logic against known exceptions is direct evidence that its output can be relied on.",
        "correct_option_ids": ["756fcf51-317e-4cd0-84ad-1803455e8a40"],
        "options_feedback": [
          {
            "id": "756fcf51-317e-4cd0-84ad-1803455e8a40",
            "text": "<p>Documented testing of the agent's matching logic against known exceptions</p>",
            "is_correct": true,
            "explanation": "Correct. This is evidence about the control itself."
          },
          {
            "id": "a01d062e-b9b7-4118-acf7-fa525efea6e6",
            "text": "<p>The vendor's marketing brochure</p>",
            "is_correct": false,
            "explanation": "Marketing material is not audit evidence."
          },
          {
            "_more": "1 more item(s) with the same shape"
          }
        ]
      },
      {
        "question_id": "c0f57881-d0f7-4c9b-867a-77637e2c89ec",
        "is_correct": true,
        "explanation": "Grounding the agent in source data and requiring citations both reduce unsupported statements.",
        "correct_option_ids": [
          "82b00e71-62f2-4b6d-aafd-2f4f78c47435",
          "584d6a2c-b607-4efd-a9e5-9e6b53269a1e"
        ],
        "options_feedback": [
          {
            "id": "82b00e71-62f2-4b6d-aafd-2f4f78c47435",
            "text": "<p>Ground the agent on the trial balance and budget files</p>",
            "is_correct": true,
            "explanation": "Correct. Grounding limits the agent to known figures."
          },
          {
            "id": "584d6a2c-b607-4efd-a9e5-9e6b53269a1e",
            "text": "<p>Require the agent to cite the source line for each figure</p>",
            "is_correct": true,
            "explanation": "Correct. Citations make every number checkable."
          },
          {
            "_more": "1 more item(s) with the same shape"
          }
        ]
      }
    ],
    "next_step": "ai_assessment",
    "ai_assessment_completed": false
  }
}
```

**Errors**

| Status | `data.reason`           |
| ------ | ----------------------- |
| 400    | `answer_count_mismatch` |
| 400    | `invalid_body`          |
| 400    | `invalid_question_id`   |
| 403    | `cool_off_active`       |
| 403    | `quiz_not_complete`     |
| 403    | `video_not_complete`    |
| 404    | `no_ai_lab_enrollment`  |
| 404    | `no_assessment_config`  |
| 409    | `already_passed`        |
| 401    | - (no / expired token)  |
| 500    | - (unexpected error)    |

---

## 7. AI Labs account (needed before the practical)

### Account state

- **GET** `/api/v1/ai-labs/account-ensure/` (shared by app and web)
- **When:** Page load - cheap, no call to AI Labs.
- **Replaces legacy:** `/ai-labs/account/ensure`
- **Changed from legacy:** Path api/v1/ai-labs/account-ensure/ (was ai-labs/account/ensure, no trailing slash); same {eligible, reason, account_created} body inside {success,message,data}.
- **Backend:** `AILabsAccountEnsureViewV1` (AILabs/views_practical.py:2142)

**Request**

`GET /api/v1/ai-labs/account-ensure/`

No body.

**Response 200** (sample data)

```json
{
  "success": true,
  "message": "Data retrieved successfully.",
  "data": {
    "eligible": true,
    "reason": "OK",
    "account_created": true
  }
}
```

**Errors**

| Status | `data.reason`             | Meaning                                                 |
| ------ | ------------------------- | ------------------------------------------------------- |
| 200    | `OK`                      | `account_created: true` - the account exists            |
| 200    | `NO_CAIRA_ENROLLMENT`     | `eligible: false` - show the CAIRA upsell, not an error |
| 200    | `MISSING_REQUIRED_FIELDS` | profile is missing name / email / SSO id                |
| 401    | -                         | no / expired token                                      |
| 500    | -                         | unexpected error                                        |

---

### Create the AI Labs account

- **POST** `/api/v1/ai-labs/account-create/` (shared by app and web)
- **When:** "Create account" button. Returns at once (202).
- **Replaces legacy:** `/ai-labs/account/create`
- **Changed from legacy:** Path api/v1/ai-labs/account-create/ (was ai-labs/account/create); provisioning runs on an asyncio task instead of a thread; same reason/status matrix inside the envelope.
- **Backend:** `AILabsAccountCreateViewV1` (AILabs/views_practical.py:2201)

**Request**

`POST /api/v1/ai-labs/account-create/`

No body.

**Response 202** (sample data)

```json
{
  "success": true,
  "message": "Request completed successfully.",
  "data": {
    "eligible": true,
    "reason": "PROVISIONING_STARTED",
    "account_created": false
  }
}
```

**Errors**

| Status | `data.reason`              | Meaning                                                                         |
| ------ | -------------------------- | ------------------------------------------------------------------------------- |
| 202    | `PROVISIONING_STARTED`     | first call - account is being created in the background (2-3 min)               |
| 202    | `PROVISIONING_IN_PROGRESS` | a create is already running for this learner                                    |
| 200    | `ACCOUNT_EXISTS`           | already has an account; carries `labs_account` + `entitlement_refresh_required` |
| 200    | `NO_CAIRA_ENROLLMENT`      | `eligible: false` - not a CAIRA learner                                         |
| 422    | `MISSING_REQUIRED_FIELDS`  | profile is missing name / email / SSO id                                        |
| 503    | `AI_LABS_DISABLED`         | AI Labs is switched off in this environment                                     |
| 401    | -                          | no / expired token                                                              |
| 500    | -                          | unexpected error                                                                |

---

### Reset AI Labs password

- **POST** `/api/v1/ai-labs/account-reset-password/` (shared by app and web)
- **When:** "Forgot AI Labs password" button.
- **Replaces legacy:** `/ai-labs/account/reset-password`
- **Changed from legacy:** Path api/v1/ai-labs/account-reset-password/ (was ai-labs/account/reset-password); same reason/status matrix inside the envelope.
- **Backend:** `AILabsAccountResetPasswordViewV1` (AILabs/views_practical.py:2285)

**Request**

`POST /api/v1/ai-labs/account-reset-password/`

No body.

**Response 200** (sample data)

```json
{
  "success": true,
  "message": "Request completed successfully.",
  "data": {
    "eligible": true,
    "reason": "RESET_EMAIL_SENT",
    "account_created": true
  }
}
```

**Errors**

| Status | `data.reason`              | Meaning                                     |
| ------ | -------------------------- | ------------------------------------------- |
| 200    | `RESET_EMAIL_SENT`         | AI Labs sent the reset e-mail               |
| 200    | `ACCOUNT_NOT_CREATED`      | no AI Labs account yet - nothing to reset   |
| 200    | `NO_CAIRA_ENROLLMENT`      | `eligible: false`                           |
| 422    | `MISSING_REQUIRED_FIELDS`  | profile is missing name / email / SSO id    |
| 429    | `RESET_EMAIL_RATE_LIMITED` | too many reset requests; try later          |
| 502    | `RESET_EMAIL_FAILED`       | AI Labs did not send it                     |
| 503    | `AI_LABS_DISABLED`         | AI Labs is switched off in this environment |
| 401    | -                          | no / expired token                          |
| 500    | -                          | unexpected error                            |

---

## 8. AI practical (the graded agent)

### Assignment brief

- **App:** `GET /app-api/v1/ai-labs/assignment-brief/<uuid:ai_lab_course_id>/`
- **Web:** `GET /web-api/v1/ai-labs/assignment-brief/<uuid:ai_lab_course_id>/`
- **When:** The practical's instructions screen.
- **Replaces legacy:** `/api/ai-lab/assignments/brief/`
- **Changed from legacy:** Lab addressed by UUID in the path (app-api/v1/ai-labs/assignment-brief/<uuid>/) instead of legacy ?course_id=<int NanoLearning id>; response {status, is_provisioned, brief} with the mark scheme stripped, vs legacy {problem_statement, requirements}; unknown lab 404, unconfigured 409.
- **Backend:** `AppAILabAssignmentBriefViewV1` (AILabs/views_practical.py:796)

**Request**

`GET /app-api/v1/ai-labs/assignment-brief/{ai_lab_course_id}/`

No body.

**Response 200** (sample data)

```json
{
  "success": true,
  "message": "Data retrieved successfully.",
  "data": {
    "status": "ok",
    "is_provisioned": true,
    "brief": {
      "slug": "audit-sampling-agent-aa-01",
      "name": "Audit Sampling Agent",
      "details": "Use the AP ledger extract and the firm sampling policy provided below. The agent must work only from these two files.",
      "problem_statement": "Build a Copilot Studio agent that selects a statistically valid sample of AP invoices from the ledger extract and explains why each item was selected.",
      "logic_flow": "Load the ledger extract, stratify invoices by value band, apply the sampling policy thresholds, select the sample, then produce a selection rationale per item.",
      "guardrails": "The agent must refuse to approve or reject invoices and must not invent ledger rows that are not in the extract.",
      "difficulty": "medium",
      "version": 3,
      "published_date": "2026-09-30",
      "input_files": [
        {
          "name": "FY2026_AP_Ledger_Extract.xlsx",
          "url": "https://ai-labs-assignment-files.s3.amazonaws.com/audit-sampling-agent-aa-01/FY2026_AP_Ledger_Extract.xlsx?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAEXAMPLEKEY%2F20261020%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20261020T101530Z&X-Amz-Expires=3600&X-Amz-SignedHeaders=host&X-Amz-Signature=8c1f0e5a7b3d9f2e4a6c8b0d1e3f5a7c9b1d3e5f7a9c1b3d5e7f9a1c3b5d7e9f"
        },
        {
          "name": "Sampling_Policy_v2.pdf",
          "url": "https://ai-labs-assignment-files.s3.amazonaws.com/audit-sampling-agent-aa-01/Sampling_Policy_v2.pdf?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAEXAMPLEKEY%2F20261020%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20261020T101530Z&X-Amz-Expires=3600&X-Amz-SignedHeaders=host&X-Amz-Signature=2a4c6e8f0b1d3f5a7c9e1b3d5f7a9c1e3b5d7f9a1c3e5b7d9f1a3c5e7b9d1f3a"
        }
      ],
      "scenarios": [
        "A ledger with three duplicate invoice numbers above the high-value threshold.",
        "A ledger in which no invoice exceeds the high-value threshold."
      ],
      "tools": ["Copilot Studio", "SharePoint"]
    }
  }
}
```

**Errors**

| Status | `data.reason`                      |
| ------ | ---------------------------------- |
| 403    | `AI_LABS_ACCESS_DENIED`            |
| 403    | `AI_LABS_TOKEN_REJECTED`           |
| 403    | `caira_access_required`            |
| 404    | `ai_lab_not_found`                 |
| 404    | `no_ai_lab_enrollment`             |
| 409    | `ai_lab_assignment_not_configured` |
| 429    | `AI_LABS_RATE_LIMITED`             |
| 502    | `AI_LABS_CALL_FAILED`              |
| 502    | `AI_LABS_RESPONSE_UNREADABLE`      |
| 503    | `AI_LABS_LMS_UNCONFIGURED`         |
| 401    | - (no / expired token)             |
| 500    | - (unexpected error)               |

`is_provisioned: false` (200) is also possible - see section 2.

---

### Learner's agents

- **App:** `GET /app-api/v1/ai-labs/agents/`
- **Web:** `GET /web-api/v1/ai-labs/agents/`
- **When:** The picker of agents to submit.
- **Replaces legacy:** `/api/ai-lab/agents/`
- **Changed from legacy:** Ported from Legacy Miles Masterclass api/ai-lab/agents/ (not a MilesOne route); body {status, is_provisioned, agents} inside {success,message,data} instead of {status_code, data, message}; adds a CAIRA 403 gate.
- **Backend:** `AppAILabAgentsViewV1` (AILabs/views_practical.py:396)

**Request**

`GET /app-api/v1/ai-labs/agents/`

No body.

**Response 200** (sample data)

```json
{
  "success": true,
  "message": "Data retrieved successfully.",
  "data": {
    "status": "ok",
    "is_provisioned": true,
    "agents": [
      {
        "kind": "agent",
        "id": "cr7a2_auditsamplingagent",
        "name": "Audit Sampling Agent",
        "published": true,
        "modified_on": "2026-10-18T14:22:10Z"
      },
      {
        "kind": "agent",
        "id": "cr7a2_leasetestingagent",
        "name": "Lease Testing Agent",
        "published": false,
        "modified_on": "2026-10-16T09:05:47Z"
      }
    ]
  }
}
```

**Errors**

| Status | `data.reason`                 |
| ------ | ----------------------------- |
| 400    | `no_sso_handle`               |
| 403    | `AI_LABS_ACCESS_DENIED`       |
| 403    | `AI_LABS_TOKEN_REJECTED`      |
| 403    | `caira_access_required`       |
| 429    | `AI_LABS_RATE_LIMITED`        |
| 502    | `AI_LABS_CALL_FAILED`         |
| 502    | `AI_LABS_RESPONSE_UNREADABLE` |
| 503    | `AI_LABS_LMS_UNCONFIGURED`    |
| 401    | - (no / expired token)        |
| 500    | - (unexpected error)          |

`is_provisioned: false` (200) is also possible - see section 2.

---

### Learner's flows

- **App:** `GET /app-api/v1/ai-labs/flows/`
- **Web:** `GET /web-api/v1/ai-labs/flows/`
- **When:** The picker of flows to submit.
- **Replaces legacy:** `/api/ai-lab/flows/`
- **Changed from legacy:** Ported from Legacy Miles Masterclass api/ai-lab/flows/; {status, is_provisioned, flows} inside the envelope; CAIRA 403 gate.
- **Backend:** `AppAILabFlowsViewV1` (AILabs/views_practical.py:572)

**Request**

`GET /app-api/v1/ai-labs/flows/`

No body.

**Response 200** (sample data)

```json
{
  "success": true,
  "message": "Data retrieved successfully.",
  "data": {
    "status": "ok",
    "is_provisioned": true,
    "flows": [
      {
        "kind": "flow",
        "id": "f3c9_journalentryflagger",
        "name": "Journal Entry Flagger Flow",
        "enabled": true,
        "modified_on": "2026-10-17T11:40:02Z"
      },
      {
        "kind": "flow",
        "id": "f3c9_vendormasterreview",
        "name": "Vendor Master Review Flow",
        "enabled": false,
        "modified_on": "2026-10-15T16:28:39Z"
      }
    ]
  }
}
```

**Errors**

| Status | `data.reason`                 |
| ------ | ----------------------------- |
| 400    | `no_sso_handle`               |
| 403    | `AI_LABS_ACCESS_DENIED`       |
| 403    | `AI_LABS_TOKEN_REJECTED`      |
| 403    | `caira_access_required`       |
| 429    | `AI_LABS_RATE_LIMITED`        |
| 502    | `AI_LABS_CALL_FAILED`         |
| 502    | `AI_LABS_RESPONSE_UNREADABLE` |
| 503    | `AI_LABS_LMS_UNCONFIGURED`    |
| 401    | - (no / expired token)        |
| 500    | - (unexpected error)          |

`is_provisioned: false` (200) is also possible - see section 2.

---

### Submit the practical

- **POST** `/api/v1/ai-labs/assignment-submit/<uuid:ai_lab_course_id>/` (shared by app and web)
- **When:** Learner picks an agent/flow and submits.
- **Replaces legacy:** `/api/ai-lab/assignments/submit/`
- **Changed from legacy:** Lab moved from body course_id (int) to the URL UUID. Body is now {artefact_kind, agent_ref}: artefact_kind is 'agent' or 'flow' (required), agent_ref is the `id` of the row the learner picked from agents/ or flows/. The old artefact_env_id / artefact_schema fields are refused with 400 invalid_body. Answers 202 inside the envelope.
- **Backend:** `AILabAssignmentSubmitViewV1` (AILabs/views_practical.py:1140)

**Request**

`POST /api/v1/ai-labs/assignment-submit/{ai_lab_course_id}/`

Body:

```json
{
  "artefact_kind": "agent",
  "agent_ref": "cr7a2_auditsamplingagent"
}
```

**Response 202** (sample data)

```json
{
  "success": true,
  "message": "Submitted for grading. This usually takes a couple of minutes.",
  "data": {
    "status": "ok",
    "outcome": "submission_recorded",
    "ai_lab_course_id": "f6570df7-0ad9-4463-9a4d-75df10e14d59",
    "assessment_status": "in_progress"
  }
}
```

**Errors**

| Status | `data.reason`                                           |
| ------ | ------------------------------------------------------- |
| 400    | `AI_LABS_NOT_PROVISIONED`                               |
| 400    | `AI_LABS_VALIDATION_REJECTED (message is AI Labs' own)` |
| 400    | `invalid_body`                                          |
| 400    | `no_sso_handle`                                         |
| 403    | `AI_LABS_ACCESS_DENIED`                                 |
| 403    | `AI_LABS_TOKEN_REJECTED`                                |
| 403    | `caira_access_required`                                 |
| 403    | `final_assessment_not_passed`                           |
| 404    | `ai_lab_not_found`                                      |
| 404    | `no_ai_lab_enrollment`                                  |
| 409    | `AI_LABS_ALREADY_IN_PROGRESS`                           |
| 409    | `ai_lab_assignment_not_configured`                      |
| 409    | `practical_already_completed`                           |
| 429    | `AI_LABS_RATE_LIMITED`                                  |
| 502    | `AI_LABS_ASSIGNMENT_MISMATCH`                           |
| 502    | `AI_LABS_CALL_FAILED`                                   |
| 503    | `AI_LABS_LMS_UNCONFIGURED`                              |
| 401    | - (no / expired token)                                  |
| 500    | - (unexpected error)                                    |

---

### Practical status / grade

- **App:** `GET /app-api/v1/ai-labs/assignment-status/<uuid:ai_lab_course_id>/`
- **Web:** `GET /web-api/v1/ai-labs/assignment-status/<uuid:ai_lab_course_id>/`
- **When:** Poll after submitting until graded; then stop.
- **Replaces legacy:** `/api/ai-lab/assignments/status/`
- **Changed from legacy:** UUID path (app-api/v1/ai-labs/assignment-status/<uuid>/) instead of ?course_id=<int>; result keys gain grade_card_expires_at, grade_card_is_expired, can_resubmit, artefact_kind, submitted_at and a reconciled flag; no-enrollment is 404 rather than lab_status 'not_started'.
- **Backend:** `AppAILabAssignmentStatusViewV1` (AILabs/views_practical.py:1411)

**Request**

`GET /app-api/v1/ai-labs/assignment-status/{ai_lab_course_id}/`

No body.

**Response 200** (sample data)

```json
{
  "success": true,
  "message": "Data retrieved successfully.",
  "data": {
    "status": "ok",
    "ai_lab_course_id": "f6570df7-0ad9-4463-9a4d-75df10e14d59",
    "reconciled": false,
    "assessment_status": "completed",
    "ai_assessment_completed": true,
    "completed_at": "2026-10-20T10:14:41.902117Z",
    "submission_id": "3d7e9b42-6c1a-4f85-9e2b-7a4c1d8f0e63",
    "artefact_kind": "agent",
    "submitted_at": "2026-10-20T10:12:04.318265Z",
    "score": 39.25,
    "percentage": 78.5,
    "master_comment": "Solid sampling agent with a clear selection rationale.",
    "minor_comment": "Stratification was correct; the agent should cite the policy threshold it applied for each high-value item.",
    "grade_card_pdf_url": "https://ai-labs-grade-cards.s3.amazonaws.com/submissions/3d7e9b42-6c1a-4f85-9e2b-7a4c1d8f0e63/grade-card.pdf?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAEXAMPLEKEY%2F20261020%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20261020T101530Z&X-Amz-Expires=604800&X-Amz-SignedHeaders=host&X-Amz-Signature=5f2c9a1e7d3b8f4a6c0e2d9b1f7a3c5e8d0b4f6a2c9e1d7b3f5a8c0e4d6b2f9a",
    "grade_card_expires_at": "2026-10-27T10:15:30Z",
    "grade_card_is_expired": false,
    "evaluated_at": "2026-10-20T10:14:41.901884Z",
    "can_resubmit": false
  }
}
```

**Errors**

| Status | `data.reason`           |
| ------ | ----------------------- |
| 403    | `caira_access_required` |
| 404    | `no_ai_lab_enrollment`  |
| 401    | - (no / expired token)  |
| 500    | - (unexpected error)    |

---

### Refresh the AI assessment

- **POST** `/api/v1/ai-labs/assessment-refresh/<uuid:ai_lab_course_id>/` (shared by app and web)
- **When:** Manual "Check result" button.
- **Replaces legacy:** `/ai-labs/course/<uuid:ai_lab_course_id>/ai-assessment/refresh/`
- **Changed from legacy:** Path api/v1/ai-labs/assessment-refresh/<uuid>/ (was .../ai-assessment/refresh/); no more 503 POLL_DISABLED - failures are reported in outcome with 200; adds a CAIRA 403 gate.
- **Backend:** `AILabAIAssessmentRefreshViewV1` (AILabs/views.py:2835)

**Request**

`POST /api/v1/ai-labs/assessment-refresh/{ai_lab_course_id}/`

No body.

**Response 200** (sample data)

```json
{
  "success": true,
  "message": "Request completed successfully.",
  "data": {
    "status": "ok",
    "ai_lab_course_id": "f6570df7-0ad9-4463-9a4d-75df10e14d59",
    "reconciled": true,
    "outcome": "OK",
    "ai_assessment_completed": true,
    "assessment_status": "completed",
    "next_step": "feedback"
  }
}
```

**Errors**

| Status | `data.reason`           |
| ------ | ----------------------- |
| 403    | `caira_access_required` |
| 404    | `no_ai_lab_enrollment`  |
| 401    | - (no / expired token)  |
| 500    | - (unexpected error)    |

---

### Practical progress across labs

- **App:** `GET /app-api/v1/ai-labs/practical-progress/`
- **Web:** `GET /web-api/v1/ai-labs/practical-progress/`
- **When:** The learner's AI Labs progress screen.
- **Replaces legacy:** `/api/ai-lab/progress/`
- **Changed from legacy:** Ported from Legacy Miles Masterclass api/ai-lab/progress/, renamed practical-progress; passes their progress body through (snake-cased) and stamps ai_lab_course_id/name/thumbnail per row instead of embedding a NanoLearning course object and recomputing summary totals.
- **Backend:** `AppAILabPracticalProgressViewV1` (AILabs/views_practical.py:1678)

**Request**

`GET /app-api/v1/ai-labs/practical-progress/`

No body.

**Response 200** (sample data)

```json
{
  "success": true,
  "message": "Data retrieved successfully.",
  "data": {
    "status": "ok",
    "is_provisioned": true,
    "progress": {
      "assignments_available": 6,
      "assignments_attempted": 2,
      "assignments_completed": 2,
      "average_percentage": "74.75",
      "assignments": [
        {
          "assignment_id": "b5e1c7a9-2d43-4f6e-8a1b-c9d0e3f72a54",
          "slug": "audit-sampling-agent-aa-01",
          "status": "graded",
          "attempts": 1,
          "best_percentage": "78.50",
          "latest_percentage": "78.50",
          "latest_submission_id": "3d7e9b42-6c1a-4f85-9e2b-7a4c1d8f0e63",
          "ai_lab_course_id": "f6570df7-0ad9-4463-9a4d-75df10e14d59",
          "ai_lab_course_name": "AI for Auditors Lab",
          "ai_lab_square_thumbnail_url": "https://example-assets.s3.ap-south-1.amazonaws.com/AILabs/Course_Thumbnails/Square/ai-for-auditors-lab-square.png"
        },
        {
          "assignment_id": "7c2f9e14-58ab-4d3c-b6e0-1f4a8d92c375",
          "slug": "accounts-payable-three-way-match-agent",
          "status": "graded",
          "attempts": 2,
          "best_percentage": "71.00",
          "latest_percentage": "64.00",
          "latest_submission_id": "a91d5c3e-0f72-4b68-9d14-6e2a8c7b3f05"
        }
      ]
    }
  }
}
```

**Errors**

| Status | `data.reason`                 |
| ------ | ----------------------------- |
| 400    | `no_sso_handle`               |
| 403    | `AI_LABS_ACCESS_DENIED`       |
| 403    | `AI_LABS_TOKEN_REJECTED`      |
| 403    | `caira_access_required`       |
| 429    | `AI_LABS_RATE_LIMITED`        |
| 502    | `AI_LABS_CALL_FAILED`         |
| 502    | `AI_LABS_RESPONSE_UNREADABLE` |
| 503    | `AI_LABS_LMS_UNCONFIGURED`    |
| 401    | - (no / expired token)        |
| 500    | - (unexpected error)          |

`is_provisioned: false` (200) is also possible - see section 2.

---

### Credits balance

- **App:** `GET /app-api/v1/ai-labs/tokens/`
- **Web:** `GET /web-api/v1/ai-labs/tokens/`
- **When:** Show the learner's AI Labs credits.
- **Replaces legacy:** `/api/ai-lab/tokens/`
- **Changed from legacy:** Ported from Legacy Miles Masterclass api/ai-lab/tokens/; balance moves under the merged envelope's data with a CAIRA gate.
- **Backend:** `AppAILabTokensViewV1` (AILabs/views_practical.py:1860)

**Request**

`GET /app-api/v1/ai-labs/tokens/`

No body.

**Response 200** (sample data)

```json
{
  "success": true,
  "message": "Data retrieved successfully.",
  "data": {
    "status": "ok",
    "is_provisioned": true,
    "tokens": {
      "cap": 2500,
      "used": "1840.75",
      "remaining": "659.25",
      "non_billable": "12.50",
      "as_of": "2026-10-19",
      "synced_at": "2026-10-20T06:00:12Z",
      "locked": false,
      "pending_request": null
    }
  }
}
```

**Errors**

| Status | `data.reason`                 |
| ------ | ----------------------------- |
| 400    | `no_sso_handle`               |
| 403    | `AI_LABS_ACCESS_DENIED`       |
| 403    | `AI_LABS_TOKEN_REJECTED`      |
| 403    | `caira_access_required`       |
| 429    | `AI_LABS_RATE_LIMITED`        |
| 502    | `AI_LABS_CALL_FAILED`         |
| 502    | `AI_LABS_RESPONSE_UNREADABLE` |
| 503    | `AI_LABS_LMS_UNCONFIGURED`    |
| 401    | - (no / expired token)        |
| 500    | - (unexpected error)          |

`is_provisioned: false` (200) is also possible - see section 2.

---

### Request more credits

- **POST** `/api/v1/ai-labs/tokens-request/` (shared by app and web)
- **When:** "Request credits" button.
- **Replaces legacy:** `/api/ai-lab/tokens/request/`
- **Changed from legacy:** Path api/v1/ai-labs/tokens-request/ (was api/ai-lab/tokens/request/); same {tokens 500|1000, reason} body but strict; an open request is 409 tokens_request_open; response {status, request} in the envelope.
- **Backend:** `AILabTokensRequestViewV1` (AILabs/views_practical.py:1989)

**Request**

`POST /api/v1/ai-labs/tokens-request/`

Body:

```json
{
  "tokens": 500,
  "reason": "Need more credits to finish the lab."
}
```

**Response 200** (sample data)

```json
{
  "success": true,
  "message": "Your credits request has been raised.",
  "data": {
    "status": "ok",
    "request": {
      "id": "e8a41f36-9b2c-4d57-a0e3-6f1b2c9d84a7",
      "credits_requested": 500,
      "status": "pending",
      "source": "learner"
    }
  }
}
```

**Errors**

| Status | `data.reason`                 |
| ------ | ----------------------------- |
| 400    | `invalid_body`                |
| 400    | `no_sso_handle`               |
| 403    | `AI_LABS_ACCESS_DENIED`       |
| 403    | `AI_LABS_TOKEN_REJECTED`      |
| 403    | `caira_access_required`       |
| 409    | `tokens_request_open`         |
| 429    | `AI_LABS_RATE_LIMITED`        |
| 502    | `AI_LABS_CALL_FAILED`         |
| 502    | `AI_LABS_RESPONSE_UNREADABLE` |
| 503    | `AI_LABS_LMS_UNCONFIGURED`    |
| 401    | - (no / expired token)        |
| 500    | - (unexpected error)          |

`is_provisioned: false` (200) is also possible - see section 2.

---

### AI assessment webhook (NOT FOR FE)

- **POST** `/api/v1/ai-labs/assessment-result/` (shared by app and web)
- **When:** AI Labs calls us. Listed for completeness.
- **Replaces legacy:** `/api/webhook/ai-labs/assessment/`
- **Changed from legacy:** Moved from api/webhook/ai-labs/assessment/ to api/v1/ai-labs/assessment-result/; secret header renamed X-Webhook-Secret -> X-AI-Labs-Secret and a bad secret is 401 not 403.
- **Backend:** `AILabAIAssessmentWebhookViewV1` (AILabs/views.py:2725)

**Request**

`POST /api/v1/ai-labs/assessment-result/`

Body:

```json
{
  "ai_lab_course_id": "{ai_lab_course_id}",
  "sso_user_id": "93390ce0-ee4f-4d77-9c7d-b850b71b1f31",
  "email": "learner@example.com",
  "completed": true,
  "external_ref": "ailabs-result-20261020-0001",
  "submission_id": "53980dbd-2ac9-432f-a23d-25151268a83d",
  "score": 87.5,
  "percentage": 87.5,
  "master_comment": "The agent correctly reconciles the sample bank feed and escalates unmatched items.",
  "minor_comment": "Add a confidence threshold before auto-matching low-value items.",
  "grade_card_pdf_url": "https://labs.example.com/grade-cards/53980dbd-2ac9-432f-a23d-25151268a83d.pdf"
}
```

**Response 200** (sample data)

```json
{
  "success": true,
  "message": "Request completed successfully.",
  "data": {
    "status": "ok",
    "outcome": "latched",
    "ai_assessment_completed": true,
    "changed": true
  }
}
```

**Errors**

| Status | `data.reason`          |
| ------ | ---------------------- |
| 400    | `invalid_body`         |
| 401    | - (no / expired token) |
| 500    | - (unexpected error)   |

---

## 9. Feedback and closing the lab

### Can the learner give feedback?

- **App:** `GET /app-api/v1/ai-labs/course-feedback-gate/<uuid:ai_lab_course_id>/`
- **Web:** `GET /web-api/v1/ai-labs/course-feedback-gate/<uuid:ai_lab_course_id>/`
- **When:** Before showing the feedback form.
- **Replaces legacy:** `/ai-labs/course/<uuid:ai_lab_course_id>/feedback/gate/`
- **Changed from legacy:** Path app-api/v1/ai-labs/course-feedback-gate/<uuid>/ (was ai-labs/course/<uuid>/feedback/gate/); same gate dict inside the envelope.
- **Backend:** `AppAILabFeedbackGateViewV1` (AILabs/views.py:3836)

**Request**

`GET /app-api/v1/ai-labs/course-feedback-gate/{ai_lab_course_id}/`

No body.

**Response 200** (sample data)

```json
{
  "success": true,
  "message": "Data retrieved successfully.",
  "data": {
    "ai_lab_course_id": "f6570df7-0ad9-4463-9a4d-75df10e14d59",
    "allowed": true,
    "reason": null,
    "remark": null,
    "ai_assessment_completed": true,
    "already_submitted": false
  }
}
```

**Errors**

| Status | `data.reason`          |
| ------ | ---------------------- |
| 401    | - (no / expired token) |
| 500    | - (unexpected error)   |

**A refusal here is a 200, not an error:** `allowed: false` with `reason` `no_ai_lab_enrollment` or `ai_assessment_not_completed` (then `remark` carries the sentence to show).

---

### Feedback questions

- **App:** `GET /app-api/v1/ai-labs/course-feedback-questions/<uuid:ai_lab_course_id>/`
- **Web:** `GET /web-api/v1/ai-labs/course-feedback-questions/<uuid:ai_lab_course_id>/`
- **When:** The feedback form.
- **Replaces legacy:** `/ai-labs/course/<uuid:ai_lab_course_id>/feedback/questions/`
- **Changed from legacy:** Path app-api/v1/ai-labs/course-feedback-questions/<uuid>/ (was ai-labs/course/<uuid>/feedback/questions/); questions now come from BadgeCertificateCPE.AILabFeedbackQuestionModule (different ids and snake_case keys) instead of CAIRA_Masterclass_Feedback_Question; enveloped.
- **Backend:** `AppAILabFeedbackQuestionsViewV1` (AILabs/views.py:3888)

**Request**

`GET /app-api/v1/ai-labs/course-feedback-questions/{ai_lab_course_id}/`

No body.

**Response 200** (sample data)

```json
{
  "success": true,
  "message": "Data retrieved successfully.",
  "data": {
    "ai_lab_course_id": "f6570df7-0ad9-4463-9a4d-75df10e14d59",
    "questions": [
      {
        "id": "4fbf1eb1-fecc-4ea5-b721-b341c1034768",
        "feedback_question": "How would you rate the overall quality of this AI Lab?",
        "feedback_question_type": "rating",
        "feedback_question_order": 1
      },
      {
        "id": "b9de7783-f6a6-4c3a-b240-29c67d1cf713",
        "feedback_question": "What one change would make this lab more useful in your accounting work?",
        "feedback_question_type": "text",
        "feedback_question_order": 2
      }
    ]
  }
}
```

**Errors**

| Status | `data.reason`                 |
| ------ | ----------------------------- |
| 403    | `ai_assessment_not_completed` |
| 403    | `feedback_already_submitted`  |
| 403    | `final_assessment_not_passed` |
| 404    | `no_ai_lab_enrollment`        |
| 401    | - (no / expired token)        |
| 500    | - (unexpected error)          |

---

### Submit feedback (closes the lab, awards CPE)

- **POST** `/api/v1/ai-labs/course-feedback-submit/<uuid:ai_lab_course_id>/` (shared by app and web)
- **When:** Last step of the lab.
- **Replaces legacy:** `/ai-labs/course/<uuid:ai_lab_course_id>/feedback/submit/`
- **Changed from legacy:** Path api/v1/ai-labs/course-feedback-submit/<uuid>/; feedback questions/answers now live in BadgeCertificateCPE (AILabFeedbackQuestionModule ids, not CAIRA_Masterclass_Feedback_Question ids); new 409 nasba_conditions_unmet; enveloped.
- **Backend:** `AILabFeedbackSubmitViewV1` (AILabs/views.py:3115)

**Request**

`POST /api/v1/ai-labs/course-feedback-submit/{ai_lab_course_id}/`

Body:

```json
{
  "responses": [
    {
      "question_id": "4fbf1eb1-fecc-4ea5-b721-b341c1034768",
      "rating": 5
    }
  ],
  "optional_feedback_text": "Clear, practical lab."
}
```

**Response 200** (sample data)

```json
{
  "success": true,
  "message": "Request completed successfully.",
  "data": {
    "status": "ok",
    "feedback_submitted": true,
    "already_submitted": false,
    "cpe_awarded": 2.0,
    "lab_certificate_triggered": true,
    "lab_certificate_url": null,
    "badge_issued": false,
    "certificate_triggered": false,
    "masterclass_course_closed": false,
    "masterclass_course_id": "d8b646ce-1e58-4be4-9df8-c4da258fd1f5",
    "next_step": "done"
  }
}
```

**Errors**

| Status | `data.reason`                 |
| ------ | ----------------------------- |
| 400    | `invalid_body`                |
| 400    | `invalid_question_id`         |
| 403    | `ai_assessment_not_completed` |
| 403    | `feedback_already_submitted`  |
| 403    | `final_assessment_not_passed` |
| 404    | `no_ai_lab_enrollment`        |
| 409    | `nasba_conditions_unmet`      |
| 401    | - (no / expired token)        |
| 500    | - (unexpected error)          |

---

## 10. Reason code dictionary

| `data.reason`                                                         | Route(s)                             | Meaning                                                                        |
| --------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------ |
| `video_not_complete`                                                  | quiz / assessment questions + submit | Finish the video first                                                         |
| `quiz_not_complete`                                                   | assessment questions + submit        | Finish the quiz first                                                          |
| `no_quiz_config` / `no_assessment_config`                             | quiz / assessment                    | The lab has no quiz / assessment set up (content issue)                        |
| `already_answered` / `already_completed`                              | quiz                                 | That question / the whole quiz is already done                                 |
| `already_passed`                                                      | assessment                           | Final assessment already passed - move on                                      |
| `cool_off_active`                                                     | assessment                           | Failed recently - wait for the cool-off before retrying                        |
| `answer_count_mismatch` / `invalid_question_id` / `invalid_question`  | quiz / assessment / feedback         | The answers sent do not match the questions                                    |
| `final_assessment_not_passed`                                         | feedback, assignment submit          | Pass the final assessment first                                                |
| `ai_assessment_not_completed`                                         | feedback                             | The AI practical is not graded yet                                             |
| `feedback_already_submitted`                                          | feedback                             | Already given - the lab is done                                                |
| `nasba_conditions_unmet`                                              | feedback submit (409)                | CPE rules not met - the lab stays open                                         |
| `credit_already_earned_via_course` / `started_via_masterclass_course` | course start (409)                   | The parent Masterclass course already covers this credit / was started instead |
| `ai_lab_assignment_not_configured`                                    | brief, submit (409)                  | The lab has no AI Labs assignment set (content issue)                          |
| `tokens_request_open`                                                 | tokens request (409)                 | A credits request is already pending                                           |
| `enrollment_not_found`                                                | release                              | Nothing to release                                                             |

_Generated from the backend code on 2026-10-20: success bodies are the published API-migration page's AI Labs
blocks (real local captures where marked, otherwise code-derived sample data); error codes are traced from every
`Response(...)` each route can reach in `AILabs/views.py` / `views_practical.py`._
