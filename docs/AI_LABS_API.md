# AI Labs APIs - Frontend Guide

Every AI Labs route the merged backend serves (45 routes), with the request, a full success response and
the errors each one can answer. **Last updated 2026-10-26** against the backend at commit `21a0042`. App and web twins are documented together when they answer the same
body; where they differ, both are shown.

|            |                                                                                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Base (UAT) | `https://uat-api.milescaira.com`                                                                                                                             |
| Prefixes   | `app-api/v1/...` = mobile app reads, `web-api/v1/...` = web reads, `api/v1/...` = shared (all writes)                                                        |
| Auth       | `Authorization: Bearer <Miles SSO access token>` on every route (except the webhook)                                                                         |
| Path id    | `{ai_lab_course_id}` = the AI Lab's UUID from the list / detail response                                                                                     |
| Responses  | **real local capture** = taken from the backend; **sample data** = built from the code with invented values. Keys, nesting and types are the code's in both. |
| Long lists | trimmed to 2 items; a `"_more"` entry says how many were cut                                                                                                 |

### What changed since the 2026-10-20 edition (bind these first)

| #   | Route(s)                                                                   | Change                                                                                                                                                                                                                                                                                                                                                                            | Action for FE                                           |
| --- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| 1   | **NEW** `GET {app,web}-api/v1/ai-labs/assignment-attempts/<id>/`           | The learner's most recent graded practical attempts (up to `allowed_attempt`), best score first, each with a grade-card PDF link and the grader's comments. Scores out of 10.                                                                                                                                                                                                     | New screen / section - see section 8.                   |
| 2   | `GET .../assignment-brief/<id>/`                                           | The brief now carries the full learner brief: `slug, name, details, problem_statement, guardrails, requirements, exercise_files, build_guides, sharepoint_links, sample_grade_card, flow_chart, tools`. `input_files`, `logic_flow`, `difficulty`, `version`, `published_date`, `scenarios` are GONE. `problem_statement` is **Markdown**. Response is `Cache-Control: no-store`. | Re-bind the brief screen; render Markdown; never cache. |
| 3   | `GET .../course/<id>/` (lab detail)                                        | `instructors` is now a list of **objects** (was a list of names). New `chapter` object (the lab video). New `final_assessment_status` block. `chapter.hls_video_link` / `transcript_*` are `null` until the learner has started the lab.                                                                                                                                          | Re-bind instructors; play the video from `chapter`.     |
| 4   | `GET .../course-progress/<id>/`, `POST .../course-assessment-submit/<id>/` | New `final_assessment_status` block, always the LAST key.                                                                                                                                                                                                                                                                                                                         | Drive the assessment button from it (section 1a).       |
| 5   | Vendor error vocabulary                                                    | New `AI_LABS_STORAGE_UNAVAILABLE` (503, retry) and `AI_LABS_CONFIGURATION_REJECTED` (502, backend config). On brief / attempts a vendor validation error now answers `409 ai_lab_assignment_not_configured`.                                                                                                                                                                      | Add the two codes to your error switch (section 2).     |
| 6   | `GET api/v1/ai-labs/account-ensure/`                                       | Optional `?include=labs_account` adds the AI Labs side (`exists, entitled, enrolled, provisioned, lab_email, environment_url`).                                                                                                                                                                                                                                                   | Use it on the AI Labs account screen only.              |
| 7   | Quiz / assessment questions                                                | Question rows now come from the AI Labs' own serializer. Same keys (`id, question_text, question_type, options[{id,text,order}]`).                                                                                                                                                                                                                                                | None.                                                   |
| 8   | `POST api/v1/ai-labs/account-reset-password/`                              | New reason `PROVISIONING_IN_PROGRESS` (200) while the lab is still being built; `RESET_EMAIL_FAILED` (502) now also when the password was reset but the mail failed.                                                                                                                                                                                                              | Add the new reason to the reset screen.                 |
| 9   | `GET .../assignment-attempts/<id>/`                                        | New `allowed_attempt`; scores out of 10; per-attempt `master_comment` / `minor_comment`.                                                                                                                                                                                                                                                                                          | Read `allowed_attempt`, never hard-code 3.              |

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
                       GET  assignment-attempts/<id>/ (last 3 graded attempts + grade cards)
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

## 1a. `final_assessment_status` - one block that draws the final-assessment button

Sent on **lab detail**, **lab progress** and **assessment submit**, always as the last key:

```json
"final_assessment_status": {
  "final_assessment_enum_values": "start",
  "final_assessment_cool_off_ends_at": null
}
```

| Value      | Meaning                                                                                                                       | Button                    |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `locked`   | Not started the lab, video not complete, quiz not passed (where the lab has one), or the lab has no MCQ assessment configured | Disabled                  |
| `start`    | Video done (and quiz passed if any), no attempt yet                                                                           | "Take final assessment"   |
| `cool_off` | Last attempt failed and the wait is still running; `final_assessment_cool_off_ends_at` (UTC) says until when                  | Disabled with a countdown |
| `retake`   | Last attempt failed and any wait is over                                                                                      | "Retake"                  |
| `passed`   | Only in the SUBMIT response that scored the pass                                                                              | Show the pass screen      |
| `ended`    | Passed earlier - no more attempts                                                                                             | Hidden / "Passed"         |

It is descriptive only - the questions and submit routes still enforce every rule, so a stale value can only
show a wrong button, never let a learner skip a step. An AI Lab never sends `in_progress` (that value exists for
Masterclass courses only).

---

## 2. AI practical: the AI Labs vendor states

The practical routes (agents, flows, brief, submit, status, practical-progress, tokens, tokens-request)
call AI Labs. Their extra answers:

| Status  | `data.reason`                                                                         | What to show                                                                                                                                            |
| ------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **200** | `AI_LABS_NOT_PROVISIONED` with **`is_provisioned: false`**                            | **Not an error.** The learner has no AI Labs account yet - show "Create AI Labs account" (section 7). Always check `is_provisioned` on a 200.           |
| 403     | `AI_LABS_ACCESS_DENIED` / `AI_LABS_TOKEN_REJECTED`                                    | AI Labs refused this session - usually the login token is older than the account. Ask the learner to **sign out and in again**.                         |
| 429     | `AI_LABS_RATE_LIMITED`                                                                | Busy - retry shortly.                                                                                                                                   |
| 502     | `AI_LABS_CALL_FAILED` / `AI_LABS_RESPONSE_UNREADABLE` / `AI_LABS_ASSIGNMENT_MISMATCH` | AI Labs could not be reached / answered oddly. Nothing was changed.                                                                                     |
| 502     | `AI_LABS_CONFIGURATION_REJECTED`                                                      | **New.** AI Labs refused OUR platform key (brief only). A backend configuration fault - show a generic "try later"; do not ask the learner to re-login. |
| 503     | `AI_LABS_LMS_UNCONFIGURED`                                                            | AI Labs is switched off in this environment.                                                                                                            |
| 503     | `AI_LABS_STORAGE_UNAVAILABLE`                                                         | **New.** AI Labs could not sign the file / grade-card links (brief, attempts). Transient - retry in a moment.                                           |
| 409     | `ai_lab_assignment_not_configured`                                                    | The lab has no AI Labs assignment set, or AI Labs does not recognise it (brief, attempts, submit). A content issue on our side.                         |
| 400     | `no_sso_handle`                                                                       | The learner's account has no SSO id - a backend data issue, report it.                                                                                  |

**Signed links expire.** Every file `url` in the brief and every `grade_card_url` in attempts is a signed link that
dies in about 15 minutes. Those two responses are sent with `Cache-Control: no-store`: do not cache them, and
re-fetch the route when the learner clicks a file after sitting on the page, instead of retrying the dead URL.

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
- **Backend:** `AppAILabCourseListViewV1` (AILabs/views.py:3463)

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
- **Backend:** `AppAILabTrackListViewV1` (AILabs/views.py:3594)

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
- **Changed 2026-10-22/23:** `instructors` is a list of OBJECTS (was names); new `chapter` (the lab's single video, `null` while the lab is still being authored); `chapter.hls_video_link`, `transcript_url` and `transcript_text` are `null` until THIS learner has started the lab (the public preview is `ai_lab_course_trailer_url`); new `final_assessment_status` (section 1a). `lock_state` and `final_assessment_status` are per learner; the rest is shared.
- **Backend:** `AppAILabCourseDetailViewV1` (AILabs/views.py:3644)

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
    "instructors": [
      {
        "id": "2d0f6b8e-4c1a-4b7e-9a35-6f1e8c2b9d40",
        "name": "Uttam Pai",
        "designation": "Partner, Audit Technology",
        "bio": "Uttam leads audit automation engagements and builds Copilot Studio agents for assurance teams.",
        "profile_image": "https://milesone-backend-assets.s3.ap-south-1.amazonaws.com/MilesOne/Instructors/Square/uttam-pai.jpg",
        "horizontal_image_url": null,
        "vertical_image_url": null,
        "square_image_url": "https://milesone-backend-assets.s3.ap-south-1.amazonaws.com/MilesOne/Instructors/Square/uttam-pai.jpg",
        "video_url": null,
        "social_links": [
          {
            "title": "LinkedIn",
            "url": "https://www.linkedin.com/in/example-uttam-pai",
            "icon_url": null
          }
        ],
        "linkedin_url": "https://www.linkedin.com/in/example-uttam-pai"
      }
    ],
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
    "chapter": {
      "id": "a4e39360-3fed-44aa-973e-7065cdd22350",
      "name": "Lease Audit Agent - Build Walkthrough",
      "mini_description": "Build the lease assurance agent end to end.",
      "description": "Walk through the agent's topics, knowledge sources and exception routing, then test it against the sample lease pack.",
      "hls_video_link": "https://d1example.cloudfront.net/ailabs/lease-audit-agent/master.m3u8",
      "duration_seconds": 2613,
      "transcript_url": "https://milesone-backend-assets.s3.ap-south-1.amazonaws.com/MilesOne/AILabs/Transcripts/lease-audit-agent.vtt",
      "transcript_text": null,
      "order": 1
    },
    "lock_state": {
      "locked": false,
      "lock_reason": null,
      "lock_remark": null,
      "masterclass_course_id": "7158ee5b-5cff-442c-b217-9703379e2cf8",
      "credit_source": null
    },
    "final_assessment_status": {
      "final_assessment_enum_values": "start",
      "final_assessment_cool_off_ends_at": null
    }
  }
}
```

**Learner has NOT started the lab** - same body, but the video and transcript are withheld and the assessment is locked:

```json
"chapter": {
  "id": "a4e39360-3fed-44aa-973e-7065cdd22350",
  "name": "Lease Audit Agent - Build Walkthrough",
  "mini_description": "Build the lease assurance agent end to end.",
  "description": "Walk through the agent's topics, knowledge sources and exception routing, then test it against the sample lease pack.",
  "hls_video_link": null,
  "duration_seconds": 2613,
  "transcript_url": null,
  "transcript_text": null,
  "order": 1
},
"final_assessment_status": {
  "final_assessment_enum_values": "locked",
  "final_assessment_cool_off_ends_at": null
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
- **Backend:** `AILabCourseStartViewV1` (AILabs/views.py:1009)

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
- **Backend:** `AppAILabCourseStartedStatusViewV1` (AILabs/views.py:3696)

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
- **Changed 2026-10-23:** new `final_assessment_status` block as the last key.
- **Backend:** `AppAILabCourseProgressViewV1` (AILabs/views.py:3748)

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
    },
    "final_assessment_status": {
      "final_assessment_enum_values": "ended",
      "final_assessment_cool_off_ends_at": null
    }
  }
}
```

`next_step` is one of `video`, `quiz`, `final_assessment`, `ai_assessment`, `feedback`, `done`.
`final_assessment_status` is section 1a.

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
- **Backend:** `AILabCourseVideoProgressViewV1` (AILabs/views.py:1488)

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
- **Backend:** `AILabCourseReleaseViewV1` (AILabs/views.py:1297)

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
- **Changed from legacy:** Path app-api/v1/ai-labs/course-quiz-questions/<uuid>/ (was ai-labs/course/<uuid>/quiz/questions/); question keys come from the AI Labs' own `AILabsQuizQuestionSerializer` since 2026-10-23 (same keys as before: id, question_text, question_type, options[{id,text,order}] - correct answers are never sent) instead of CAIRA_Masterclass_Question_*; enveloped.
- **Backend:** `AppAILabQuizQuestionsViewV1` (AILabs/views.py:3800)

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
- **Backend:** `AILabQuizSubmitViewV1` (AILabs/views.py:2076)

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
- **Backend:** `AppAILabAssessmentQuestionsViewV1` (AILabs/views.py:3852)

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
- **Changed 2026-10-23:** new `final_assessment_status` block as the last key (`passed`, `cool_off` or `retake`).
- **Backend:** `AILabAssessmentSubmitViewV1` (AILabs/views.py:2434)

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
    "ai_assessment_completed": false,
    "final_assessment_status": {
      "final_assessment_enum_values": "passed",
      "final_assessment_cool_off_ends_at": null
    }
  }
}
```

`next_step` is `feedback` when the AI practical is already graded, else `ai_assessment`.

**Response 200 - failed attempt** (sample data). Still a 200: `passed: false`. With a cool-off configured the
status is `cool_off` and carries when it ends; without one it is `retake`.

```json
{
  "success": true,
  "message": "Request completed successfully.",
  "data": {
    "passed": false,
    "score_percent": 50.0,
    "pass_threshold_percent": 70.0,
    "answers": [
      {
        "question_id": "b4fcae42-a90a-445f-bb4c-611f380c3efe",
        "is_correct": false,
        "explanation": "Testing the agent's matching logic against known exceptions is direct evidence that its output can be relied on.",
        "correct_option_ids": ["756fcf51-317e-4cd0-84ad-1803455e8a40"],
        "options_feedback": [
          {
            "_more": "3 item(s) with the same shape as the pass example"
          }
        ]
      },
      {
        "_more": "1 more item(s) with the same shape"
      }
    ],
    "next_step": "final_assessment",
    "final_assessment_status": {
      "final_assessment_enum_values": "cool_off",
      "final_assessment_cool_off_ends_at": "2026-10-26T11:42:10.512334Z"
    }
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
- **Backend:** `AILabsAccountEnsureViewV1` (AILabs/views_practical.py:2432)

**Request**

`GET /api/v1/ai-labs/account-ensure/` or `GET /api/v1/ai-labs/account-ensure/?include=labs_account`

No body. Without `include` this makes no call to AI Labs (cheap, use on page load). With
`?include=labs_account` it also asks AI Labs and adds a `labs_account` block - use it on the AI Labs account
screen, where you need the learner's lab e-mail / environment link.

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

**Response 200 - with `?include=labs_account`** (sample data)

```json
{
  "success": true,
  "message": "Data retrieved successfully.",
  "data": {
    "eligible": true,
    "reason": "OK",
    "account_created": true,
    "labs_account": {
      "exists": true,
      "entitled": true,
      "enrolled": true,
      "provisioned": true,
      "lab_email": "learner.4f2a@milesailabs.onmicrosoft.com",
      "environment_url": "https://copilotstudio.microsoft.com/environments/Default-4f2a"
    }
  }
}
```

`labs_account` is absent when AI Labs could not be asked. `provisioned: false` (with `lab_email` null) means the
account is still being built - keep showing "Setting up". `entitled: false` means the learner's login token
predates the account - force a re-login.

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
- **Backend:** `AILabsAccountCreateViewV1` (AILabs/views_practical.py:2491)

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

| Status | `data.reason`              | Meaning                                                                                                 |
| ------ | -------------------------- | ------------------------------------------------------------------------------------------------------- |
| 202    | `PROVISIONING_STARTED`     | first call - account is being created in the background (2-3 min)                                       |
| 202    | `PROVISIONING_IN_PROGRESS` | a create is already running for this learner                                                            |
| 200    | `ACCOUNT_EXISTS`           | already has an account; carries `labs_account` + `entitlement_refresh_required` (see the example below) |
| 200    | `NO_CAIRA_ENROLLMENT`      | `eligible: false` - not a CAIRA learner                                                                 |
| 422    | `MISSING_REQUIRED_FIELDS`  | profile is missing name / email / SSO id                                                                |
| 503    | `AI_LABS_DISABLED`         | AI Labs is switched off in this environment                                                             |
| 401    | -                          | no / expired token                                                                                      |
| 500    | -                          | unexpected error                                                                                        |

**Response 200 - `ACCOUNT_EXISTS`** (sample data). When `entitlement_refresh_required` is `true`, sign the learner
out and back in before calling agents / flows / submit.

```json
{
  "success": true,
  "message": "Request completed successfully.",
  "data": {
    "eligible": true,
    "reason": "ACCOUNT_EXISTS",
    "account_created": true,
    "entitlement_refresh_required": true,
    "labs_account": {
      "exists": true,
      "entitled": false,
      "enrolled": true,
      "provisioned": true,
      "lab_email": "learner.4f2a@milesailabs.onmicrosoft.com",
      "environment_url": "https://copilotstudio.microsoft.com/environments/Default-4f2a"
    }
  }
}
```

---

### Reset AI Labs password

- **POST** `/api/v1/ai-labs/account-reset-password/` (shared by app and web)
- **When:** "Forgot AI Labs password" button.
- **Replaces legacy:** `/ai-labs/account/reset-password`
- **Changed from legacy:** Path api/v1/ai-labs/account-reset-password/ (was ai-labs/account/reset-password); same reason/status matrix inside the envelope.
- **Note:** every successful call **replaces** the learner's lab password (AI Labs stores none), so "send my credentials again" always means "give me new ones". Do not call it automatically.
- **Backend:** `AILabsAccountResetPasswordViewV1` (AILabs/views_practical.py:2575)

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

| Status | `data.reason`              | Meaning                                                                                                                                                                                                                               |
| ------ | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 200    | `RESET_EMAIL_SENT`         | AI Labs reset the lab password and e-mailed the new credentials                                                                                                                                                                       |
| 200    | `ACCOUNT_NOT_CREATED`      | no AI Labs account yet - nothing to reset                                                                                                                                                                                             |
| 200    | `PROVISIONING_IN_PROGRESS` | **New 2026-10-26.** The account exists but its Microsoft side is still being built (`account_created: true`). Nothing was reset - show "Your lab is being set up, try again in a few minutes".                                        |
| 200    | `NO_CAIRA_ENROLLMENT`      | `eligible: false`                                                                                                                                                                                                                     |
| 422    | `MISSING_REQUIRED_FIELDS`  | profile is missing name / email / SSO id                                                                                                                                                                                              |
| 429    | `RESET_EMAIL_RATE_LIMITED` | too many reset requests; try later                                                                                                                                                                                                    |
| 502    | `RESET_EMAIL_FAILED`       | AI Labs did not send it. **Since 2026-10-26 this also covers "password reset, but the e-mail failed"** - the old password no longer works, so tell the learner to try again (each retry issues a new password; limit 3 per 5 minutes) |
| 503    | `AI_LABS_DISABLED`         | AI Labs is switched off in this environment                                                                                                                                                                                           |
| 401    | -                          | no / expired token                                                                                                                                                                                                                    |
| 500    | -                          | unexpected error                                                                                                                                                                                                                      |

---

## 8. AI practical (the graded agent)

### Assignment brief

- **App:** `GET /app-api/v1/ai-labs/assignment-brief/<uuid:ai_lab_course_id>/`
- **Web:** `GET /web-api/v1/ai-labs/assignment-brief/<uuid:ai_lab_course_id>/`
- **When:** The practical's instructions screen. Fetch when the learner opens it, and again when they click a file after a while (links expire).
- **Replaces legacy:** `/api/ai-lab/assignments/brief/`
- **Changed from legacy:** Lab addressed by UUID in the path instead of legacy ?course_id=<int NanoLearning id>; response {status, is_provisioned, brief}; unknown lab 404, unconfigured 409.
- **Changed 2026-10-22/23:** `brief` now relays AI Labs' full learner brief (12 keys below). Withdrawn by AI Labs and no longer sent: `input_files` (read `exercise_files`), `logic_flow`, `difficulty`, `version`, `published_date`, `scenarios`. The marking scheme (expected logic / outcome, rubric, statics, hard rules) is never sent. `Cache-Control: no-store`.
- **Backend:** `AppAILabAssignmentBriefViewV1` (AILabs/views_practical.py:839)

**Request**

`GET /app-api/v1/ai-labs/assignment-brief/{ai_lab_course_id}/`

No body.

**Response 200** (sample data - the `brief` contents are AI Labs' own, relayed unchanged)

```json
{
  "success": true,
  "message": "Data retrieved successfully.",
  "data": {
    "status": "ok",
    "is_provisioned": true,
    "brief": {
      "slug": "lease-audit-agent",
      "name": "Lease Audit Agent",
      "details": "Build an agent that compares lease contracts to schedules and flags exceptions.",
      "problem_statement": "## Scenario\n\nThe audit team tests 40 leases a quarter against the lease schedule. Build a Copilot Studio agent that reads each contract, compares it to the schedule and routes every mismatch to a reviewer.",
      "guardrails": "The agent must not approve or reject a lease, and must not invent figures that are not in the files provided.",
      "requirements": ["A Copilot Studio trial", "The lease schedule CSV"],
      "exercise_files": [
        {
          "url": "https://milesai-lab-attachments.s3.amazonaws.com/lease-audit-agent/lease-schedule.csv?X-Amz-Expires=900&X-Amz-Signature=0aac...",
          "doc_type": "csv",
          "filename": "lease-schedule.csv",
          "content_type": "text/csv",
          "size_bytes": 4096,
          "sort_order": 0
        }
      ],
      "build_guides": [
        {
          "url": "https://cdn.milesailabs.com/lease-audit-agent/build-guide.pdf",
          "doc_type": "pdf",
          "filename": "build-guide.pdf",
          "content_type": "application/pdf",
          "size_bytes": 182044,
          "sort_order": 1
        }
      ],
      "sharepoint_links": [
        {
          "url": "https://contoso.sharepoint.com/sites/leases",
          "label": "Lease library",
          "sort_order": 2
        }
      ],
      "sample_grade_card": {
        "url": "https://milesai-lab-attachments.s3.amazonaws.com/lease-audit-agent/sample-grade-card.pdf?X-Amz-Expires=900&X-Amz-Signature=48a8...",
        "doc_type": "pdf",
        "filename": "sample-grade-card.pdf",
        "content_type": "application/pdf",
        "size_bytes": 96211,
        "sort_order": 3,
        "sample_grade": "7.85"
      },
      "flow_chart": {
        "url": "https://milesai-lab-attachments.s3.amazonaws.com/lease-audit-agent/flow-chart.png?X-Amz-Expires=900&X-Amz-Signature=c885...",
        "doc_type": "image",
        "filename": "flow-chart.png",
        "content_type": "image/png",
        "size_bytes": 55302,
        "sort_order": 4
      },
      "tools": {
        "trigger_email": true
      }
    }
  }
}
```

**The `brief` fields**

| Field               | Type            | Notes                                                                                                                                                                                                            |
| ------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `slug`              | string          | The exercise's key at AI Labs.                                                                                                                                                                                   |
| `name`              | string          | Display title.                                                                                                                                                                                                   |
| `details`           | string / null   | One-line summary for cards.                                                                                                                                                                                      |
| `problem_statement` | string          | **Markdown** - render it, do not show raw.                                                                                                                                                                       |
| `guardrails`        | string / null   | What the agent must NOT do.                                                                                                                                                                                      |
| `requirements`      | string[] / null | Short checklist of what the exercise needs.                                                                                                                                                                      |
| `exercise_files`    | array           | Files the learner downloads. May be empty. Each: `url` (**signed, expires in ~15 min**), `doc_type` (`excel`/`csv`/`pdf`/`text`/`json`/`image`/`other`), `filename`, `content_type`, `size_bytes`, `sort_order`. |
| `build_guides`      | array           | Walkthroughs on PUBLIC links (do not expire). Same entry shape.                                                                                                                                                  |
| `sharepoint_links`  | array           | `url`, `label` (may be null - fall back to the url), `sort_order`.                                                                                                                                               |
| `sample_grade_card` | object / null   | Same shape as a file, plus `sample_grade` (a decimal STRING out of 10, like `"7.85"`).                                                                                                                           |
| `flow_chart`        | object / null   | Same shape as a file.                                                                                                                                                                                            |
| `tools`             | object          | `{"trigger_email": true/false}` - whether to offer the "send me test e-mails" helper.                                                                                                                            |

Every key is always present; a value AI Labs did not send arrives as `null`. Sort each array by `sort_order`.

**Response 200 - learner has no AI Labs account yet** (`brief` is empty - show "Create AI Labs account"):

```json
{
  "success": true,
  "message": "Set up your AI Labs account to continue.",
  "data": {
    "status": "ok",
    "is_provisioned": false,
    "reason": "AI_LABS_NOT_PROVISIONED",
    "brief": {}
  }
}
```

**Errors**

| Status | `data.reason`                                         | What to show                                                             |
| ------ | ----------------------------------------------------- | ------------------------------------------------------------------------ |
| 403    | `caira_access_required`                               | CAIRA upsell                                                             |
| 404    | `ai_lab_not_found`                                    | Wrong / inactive lab id                                                  |
| 404    | `no_ai_lab_enrollment`                                | "Start this AI Lab before reading its brief."                            |
| 409    | `ai_lab_assignment_not_configured`                    | "This AI Lab's practical is not set up yet." (content issue on our side) |
| 429    | `AI_LABS_RATE_LIMITED`                                | Busy - retry shortly                                                     |
| 502    | `AI_LABS_CONFIGURATION_REJECTED`                      | AI Labs refused our platform key - generic "try later"                   |
| 502    | `AI_LABS_CALL_FAILED` / `AI_LABS_RESPONSE_UNREADABLE` | AI Labs unreachable - retry                                              |
| 503    | `AI_LABS_STORAGE_UNAVAILABLE`                         | File links could not be signed - retry in a moment                       |
| 503    | `AI_LABS_LMS_UNCONFIGURED`                            | AI Labs is off in this environment                                       |
| 401    | - (no / expired token)                                |                                                                          |
| 500    | - (unexpected error)                                  |                                                                          |

The brief is read with OUR platform key, so `AI_LABS_ACCESS_DENIED` / `AI_LABS_TOKEN_REJECTED` (re-login) never
come from this route.

---

### Practical attempts (NEW 2026-10-23)

- **App:** `GET /app-api/v1/ai-labs/assignment-attempts/<uuid:ai_lab_course_id>/`
- **Web:** `GET /web-api/v1/ai-labs/assignment-attempts/<uuid:ai_lab_course_id>/`
- **When:** "How did I do?" on the practical / progress screen: the learner's last graded attempts with a grade-card PDF each.
- **Replaces legacy:** none - new in merged.
- **Rules:** the newest **`allowed_attempt`** graded attempts (3 today - read the field, do not hard-code 3), shown **best score first** (not the all-time best). Scores are **out of 10**. `total_attempts` counts every submission, including ones still grading, so you can say "3 of 5". Scores are decimal **strings** (`"8.80"` out of `"10.00"`, percentage `"88.00"`) - display as-is or parse as decimal, never `parseFloat`. `grade_card_url` is a signed link that stops working at `grade_card_urls_expire_at`; `null` means no PDF for that attempt (not an error). `Cache-Control: no-store`.
- **Backend:** `AppAILabAssignmentAttemptsViewV1` (AILabs/views_practical.py:1068)

**Request**

`GET /app-api/v1/ai-labs/assignment-attempts/{ai_lab_course_id}/`

No body, no query parameters.

**Response 200** (sample data - the attempt rows are AI Labs' own, relayed unchanged)

```json
{
  "success": true,
  "message": "Data retrieved successfully.",
  "data": {
    "status": "ok",
    "is_provisioned": true,
    "ai_lab_course_id": "f6570df7-0ad9-4463-9a4d-75df10e14d59",
    "total_attempts": 5,
    "allowed_attempt": 3,
    "grade_card_urls_expire_at": "2026-10-26T10:26:31.254795Z",
    "attempts": [
      {
        "attempt_number": 3,
        "status": "graded",
        "score": "8.80",
        "max_score": "10.00",
        "percentage": "88.00",
        "submitted_at": "2026-10-24T10:00:00Z",
        "graded_at": "2026-10-24T10:07:00Z",
        "grade_card_url": "https://s3.ap-south-1.amazonaws.com/milesai-lab-attachments/grade-cards/lease-audit-agent/3.pdf?X-Amz-Signature=...",
        "master_comment": "Routes every lease exception to a reviewer with the right evidence.",
        "minor_comment": "Cite the schedule row for each flagged field."
      },
      {
        "attempt_number": 4,
        "status": "graded",
        "score": "6.10",
        "max_score": "10.00",
        "percentage": "61.00",
        "submitted_at": "2026-10-25T10:00:00Z",
        "graded_at": "2026-10-25T10:07:00Z",
        "grade_card_url": null,
        "master_comment": "Flags most mismatches but misses the renewal-option path.",
        "minor_comment": "Guardrails need work before the live tests."
      },
      {
        "attempt_number": 2,
        "status": "graded",
        "score": "4.00",
        "max_score": "10.00",
        "percentage": "40.00",
        "submitted_at": "2026-10-23T10:00:00Z",
        "graded_at": "2026-10-23T10:07:00Z",
        "grade_card_url": null,
        "master_comment": null,
        "minor_comment": null
      }
    ]
  }
}
```

| Field                                           | Notes                                                                                                                                               |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `total_attempts`                                | Every submission, still-grading ones included. Can be larger than `attempts.length` and than `allowed_attempt`.                                     |
| `allowed_attempt`                               | The attempt allowance and the cap on `attempts`. Not enforced at submit - show it as the allowance. `null` when the learner has no AI Labs account. |
| `grade_card_urls_expire_at`                     | When every `grade_card_url` in THIS response stops working. `null` when none was signed.                                                            |
| `attempts[].attempt_number`                     | The learner's own 1-based numbering. Stable.                                                                                                        |
| `attempts[].status`                             | Always `graded` today; still-grading attempts are not rows.                                                                                         |
| `attempts[].score` / `max_score` / `percentage` | Decimal **strings**; score out of `max_score` (`"10.00"`).                                                                                          |
| `attempts[].master_comment` / `minor_comment`   | The grader's headline and the line under it, as on the PDF. Either may be `null`.                                                                   |
| `attempts[].submitted_at` / `graded_at`         | UTC ISO-8601.                                                                                                                                       |
| `attempts[].grade_card_url`                     | Signed PDF link or `null`.                                                                                                                          |

**Response 200 - no graded attempt yet** (show "No attempts yet"):

```json
{
  "success": true,
  "message": "Data retrieved successfully.",
  "data": {
    "status": "ok",
    "is_provisioned": true,
    "ai_lab_course_id": "f6570df7-0ad9-4463-9a4d-75df10e14d59",
    "total_attempts": 0,
    "allowed_attempt": 3,
    "grade_card_urls_expire_at": null,
    "attempts": []
  }
}
```

**Response 200 - no AI Labs account yet** (show "Create AI Labs account"). Note: this variant has no
`ai_lab_course_id`.

```json
{
  "success": true,
  "message": "Set up your AI Labs account to continue.",
  "data": {
    "status": "ok",
    "is_provisioned": false,
    "reason": "AI_LABS_NOT_PROVISIONED",
    "total_attempts": 0,
    "allowed_attempt": null,
    "grade_card_urls_expire_at": null,
    "attempts": []
  }
}
```

**Errors**

| Status | `data.reason`                                                                            | What to show                                      |
| ------ | ---------------------------------------------------------------------------------------- | ------------------------------------------------- |
| 403    | `caira_access_required`                                                                  | CAIRA upsell                                      |
| 403    | `AI_LABS_ACCESS_DENIED` / `AI_LABS_TOKEN_REJECTED`                                       | Sign out and back in                              |
| 404    | `ai_lab_not_found`                                                                       | Wrong / inactive lab id                           |
| 404    | `no_ai_lab_enrollment`                                                                   | "Start this AI Lab before viewing your attempts." |
| 409    | `ai_lab_assignment_not_configured`                                                       | Practical not set up yet (content issue)          |
| 429    | `AI_LABS_RATE_LIMITED`                                                                   | Busy - retry shortly                              |
| 502    | `AI_LABS_CALL_FAILED` / `AI_LABS_RESPONSE_UNREADABLE` / `AI_LABS_CONFIGURATION_REJECTED` | AI Labs unreachable - retry                       |
| 503    | `AI_LABS_STORAGE_UNAVAILABLE`                                                            | Grade-card links could not be signed - retry      |
| 503    | `AI_LABS_LMS_UNCONFIGURED`                                                               | AI Labs is off in this environment                |
| 401    | - (no / expired token)                                                                   |                                                   |
| 500    | - (unexpected error)                                                                     |                                                   |

---

### Learner's agents

- **App:** `GET /app-api/v1/ai-labs/agents/`
- **Web:** `GET /web-api/v1/ai-labs/agents/`
- **When:** The picker of agents to submit.
- **Replaces legacy:** `/api/ai-lab/agents/`
- **Changed from legacy:** Ported from Legacy Miles Masterclass api/ai-lab/agents/ (not a MilesOne route); body {status, is_provisioned, agents} inside {success,message,data} instead of {status_code, data, message}; adds a CAIRA 403 gate.
- **Backend:** `AppAILabAgentsViewV1` (AILabs/views_practical.py:407)

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
- **Backend:** `AppAILabFlowsViewV1` (AILabs/views_practical.py:583)

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
- **Backend:** `AILabAssignmentSubmitViewV1` (AILabs/views_practical.py:1406)

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

| Status | `data.reason`                                                                                                                                                        |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 400    | `AI_LABS_NOT_PROVISIONED`                                                                                                                                            |
| 400    | `AI_LABS_VALIDATION_REJECTED (message is AI Labs' own)`                                                                                                              |
| 400    | `invalid_body`                                                                                                                                                       |
| 400    | `no_sso_handle`                                                                                                                                                      |
| 403    | `AI_LABS_ACCESS_DENIED`                                                                                                                                              |
| 403    | `AI_LABS_TOKEN_REJECTED`                                                                                                                                             |
| 403    | `caira_access_required`                                                                                                                                              |
| 403    | `final_assessment_not_passed`                                                                                                                                        |
| 404    | `ai_lab_not_found`                                                                                                                                                   |
| 404    | `no_ai_lab_enrollment`                                                                                                                                               |
| 409    | `AI_LABS_ALREADY_IN_PROGRESS` (any 409 from AI Labs; `reason` may read `AI_LABS_ASSIGNMENT_MISMATCH` - treat every 409 here as "already being graded, check status") |
| 409    | `ai_lab_assignment_not_configured`                                                                                                                                   |
| 409    | `practical_already_completed`                                                                                                                                        |
| 429    | `AI_LABS_RATE_LIMITED`                                                                                                                                               |
| 502    | `AI_LABS_ASSIGNMENT_MISMATCH` ("practical is misconfigured")                                                                                                         |
| 502    | `AI_LABS_CALL_FAILED`                                                                                                                                                |
| 503    | `AI_LABS_LMS_UNCONFIGURED`                                                                                                                                           |
| 401    | - (no / expired token)                                                                                                                                               |
| 500    | - (unexpected error)                                                                                                                                                 |

---

### Practical status / grade

- **App:** `GET /app-api/v1/ai-labs/assignment-status/<uuid:ai_lab_course_id>/`
- **Web:** `GET /web-api/v1/ai-labs/assignment-status/<uuid:ai_lab_course_id>/`
- **When:** Poll after submitting until graded; then stop.
- **Replaces legacy:** `/api/ai-lab/assignments/status/`
- **Changed from legacy:** UUID path (app-api/v1/ai-labs/assignment-status/<uuid>/) instead of ?course_id=<int>; result keys gain grade_card_expires_at, grade_card_is_expired, can_resubmit, artefact_kind, submitted_at and a reconciled flag; no-enrollment is 404 rather than lab_status 'not_started'.
- **Backend:** `AppAILabAssignmentStatusViewV1` (AILabs/views_practical.py:1697)
- **Notes:** `assessment_status` is `not_started`, `in_progress`, `completed` or `error`. While it is `in_progress` this read also asks AI Labs once (so a missed result heals itself) - poll every ~10 s and stop at `completed`. Once completed, each read fetches a FRESH grade-card link (`grade_card_pdf_url` + `grade_card_expires_at`), so re-read rather than reusing an old link. `can_resubmit` is `true` only for `not_started` / `error`. Unlike brief and attempts this response is not marked `no-store`, but do not cache it either.

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
- **Backend:** `AILabAIAssessmentRefreshViewV1` (AILabs/views.py:2903)

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
- **Backend:** `AppAILabPracticalProgressViewV1` (AILabs/views_practical.py:1968)

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
- **Backend:** `AppAILabTokensViewV1` (AILabs/views_practical.py:2150)

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
- **Changed from legacy:** Path api/v1/ai-labs/tokens-request/ (was api/ai-lab/tokens/request/); same {tokens 500|1000, reason} body but strict - `tokens` must be exactly 500 or 1000 (anything else is 400), `reason` optional, max 500 chars; any 409 from AI Labs is answered 409 tokens_request_open; response {status, request} in the envelope.
- **Backend:** `AILabTokensRequestViewV1` (AILabs/views_practical.py:2279)

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
- **Backend:** `AILabAIAssessmentWebhookViewV1` (AILabs/views.py:2793)

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
- **Backend:** `AppAILabFeedbackGateViewV1` (AILabs/views.py:3904)

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
- **Backend:** `AppAILabFeedbackQuestionsViewV1` (AILabs/views.py:3956)

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
- **Backend:** `AILabFeedbackSubmitViewV1` (AILabs/views.py:3183)

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

| `data.reason`                                                                                                                                                        | Route(s)                                                                | Meaning                                                                        |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `video_not_complete`                                                                                                                                                 | quiz / assessment questions + submit                                    | Finish the video first                                                         |
| `quiz_not_complete`                                                                                                                                                  | assessment questions + submit                                           | Finish the quiz first                                                          |
| `no_quiz_config` / `no_assessment_config`                                                                                                                            | quiz / assessment                                                       | The lab has no quiz / assessment set up (content issue)                        |
| `already_answered` / `already_completed`                                                                                                                             | quiz                                                                    | That question / the whole quiz is already done                                 |
| `already_passed`                                                                                                                                                     | assessment                                                              | Final assessment already passed - move on                                      |
| `cool_off_active`                                                                                                                                                    | assessment                                                              | Failed recently - wait for the cool-off before retrying                        |
| `answer_count_mismatch` / `invalid_question_id` / `invalid_question`                                                                                                 | quiz / assessment / feedback                                            | The answers sent do not match the questions                                    |
| `final_assessment_not_passed`                                                                                                                                        | feedback, assignment submit                                             | Pass the final assessment first                                                |
| `ai_assessment_not_completed`                                                                                                                                        | feedback                                                                | The AI practical is not graded yet                                             |
| `feedback_already_submitted`                                                                                                                                         | feedback                                                                | Already given - the lab is done                                                |
| `nasba_conditions_unmet`                                                                                                                                             | feedback submit (409)                                                   | CPE rules not met - the lab stays open                                         |
| `credit_already_earned_via_course` / `started_via_masterclass_course`                                                                                                | course start (409)                                                      | The parent Masterclass course already covers this credit / was started instead |
| `ai_lab_assignment_not_configured`                                                                                                                                   | brief, submit (409)                                                     | The lab has no AI Labs assignment set (content issue)                          |
| `tokens_request_open`                                                                                                                                                | tokens request (409)                                                    | A credits request is already pending                                           |
| `enrollment_not_found`                                                                                                                                               | release                                                                 | Nothing to release                                                             |
| `ai_lab_not_found`                                                                                                                                                   | detail, start, brief, attempts, submit                                  | Wrong / inactive lab id                                                        |
| `no_ai_lab_enrollment`                                                                                                                                               | progress, quiz, assessment, brief, attempts, status, feedback           | Learner has not started this lab                                               |
| `caira_access_required`                                                                                                                                              | start, practical routes                                                 | No CAIRA access - upsell                                                       |
| `practical_already_completed`                                                                                                                                        | assignment submit (409)                                                 | Practical already graded - nothing to submit                                   |
| `no_sso_handle`                                                                                                                                                      | agents, flows, practical-progress, tokens, submit, tokens request (400) | Account not linked to Miles SSO - support issue                                |
| `AI_LABS_NOT_PROVISIONED`                                                                                                                                            | practical routes (200 with `is_provisioned: false`; 400 on submit)      | No AI Labs account - show "Create AI Labs account"                             |
| `AI_LABS_ACCESS_DENIED` / `AI_LABS_TOKEN_REJECTED`                                                                                                                   | learner-token practical routes (403)                                    | Sign out and back in                                                           |
| `AI_LABS_ALREADY_IN_PROGRESS`                                                                                                                                        | assignment submit (409)                                                 | Already being graded - poll status                                             |
| `AI_LABS_VALIDATION_REJECTED`                                                                                                                                        | assignment submit (400)                                                 | AI Labs refused the submission; `message` is theirs                            |
| `AI_LABS_RATE_LIMITED`                                                                                                                                               | practical routes (429)                                                  | Busy - retry shortly                                                           |
| `AI_LABS_CALL_FAILED` / `AI_LABS_RESPONSE_UNREADABLE`                                                                                                                | practical routes (502)                                                  | AI Labs unreachable - retry                                                    |
| `AI_LABS_ASSIGNMENT_MISMATCH`                                                                                                                                        | assignment submit (502)                                                 | Practical misconfigured on our side                                            |
| `AI_LABS_CONFIGURATION_REJECTED`                                                                                                                                     | brief (502)                                                             | **New.** Our platform key refused - backend config                             |
| `AI_LABS_STORAGE_UNAVAILABLE`                                                                                                                                        | brief, attempts (503)                                                   | **New.** File / grade-card links could not be signed - retry                   |
| `AI_LABS_LMS_UNCONFIGURED` / `AI_LABS_DISABLED`                                                                                                                      | practical routes / account routes (503)                                 | AI Labs is off in this environment                                             |
| `PROVISIONING_STARTED` / `PROVISIONING_IN_PROGRESS` / `ACCOUNT_EXISTS` / `ACCOUNT_NOT_CREATED` / `MISSING_REQUIRED_FIELDS` / `NO_CAIRA_ENROLLMENT` / `RESET_EMAIL_*` | account routes                                                          | See section 7                                                                  |

`final_assessment_status.final_assessment_enum_values`: `locked`, `start`, `cool_off`, `retake`, `passed`, `ended`
(section 1a).

---

## 11. Related route outside AI Labs

- `GET /web-api/v1/masterclass/ai-labs/?login_type=pre_login|post_login&page=&page_size=` - the AI Labs rail on the
  web Masterclass home page. It lists the **Masterclass courses that have an AI Lab**, as standard course cards
  (paginated block under `data`, slug `masterclass_ai_labs_courses_web`, default 6). Served by the Masterclass app
  (`WebMasterclassAILabsViewV1`), not counted in the 45 above.

_Updated 2026-10-26 from the backend at `21a0042`: new attempts route, re-cut brief, lab detail `chapter` /
instructor objects, `final_assessment_status`, the two new vendor codes and current backend line numbers;
samples for those are code-derived (vendor-relayed bodies follow AI Labs' published contracts). First generated
on 2026-10-20: success bodies are the published API-migration page's AI Labs
blocks (real local captures where marked, otherwise code-derived sample data); error codes are traced from every
`Response(...)` each route can reach in `AILabs/views.py` / `views_practical.py`._
