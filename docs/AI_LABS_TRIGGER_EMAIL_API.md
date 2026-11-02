# AI Labs - "Send me test emails" API (FE Guide)

**Last updated 2026-10-29 (revised).** Backend: `ID_UK_Ongoing_Development_Branch`. Not yet committed or deployed - this
reaches UAT with the next deploy. Every response below was produced by the real route on a local database with
AI Labs stubbed; ids are example ids. No migration is needed.

|              |                                                                                                                        |
| ------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Base (UAT)   | `https://uat-api.milescaira.com`                                                                                       |
| Auth         | `Authorization: Bearer <Miles SSO access token>`                                                                       |
| Envelope     | Every response is `{ "success", "message", "data" }`. Branch on the HTTP status and `data.reason`, never on `message`. |
| Empty values | An empty value arrives as `null`, never `""`.                                                                          |

## What changed (bind these first)

| #   | Route                                                                                                                             | Change                                                                            | Action for FE                                              |
| --- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 1   | **NEW** `POST /api/v1/ai-labs/assignment-trigger-email/{ai_lab_course_id}/`                                                       | Asks AI Labs to post the exercise's sample emails into the learner's lab mailbox. | "Send me test emails" button on the practical screen.      |
| 2   | `GET /app-api/v1/ai-labs/assignment-brief/{ai_lab_course_id}/` and `GET /web-api/v1/ai-labs/assignment-brief/{ai_lab_course_id}/` | No change - `tools.trigger_email` was already in the brief.                       | Show the button only when `tools.trigger_email` is `true`. |

## What the feature is

Some AI Lab practicals ask the learner to build an agent that triages an inbox. The inbox is the learner's **lab
mailbox** (`...@mileslabs.ai`) - never their personal email. This button fills that mailbox with sample emails so
the agent has something to work on.

```
Practical screen ...... GET  {app|web}-api/v1/ai-labs/assignment-brief/{id}/   (read tools.trigger_email)
  tools.trigger_email false -> hide the button
  tools.trigger_email true  -> show "Send me test emails"
Learner taps it ....... POST api/v1/ai-labs/assignment-trigger-email/{id}/     (no body)
  200 -> show data.message as-is; the emails arrive in a few minutes
  429 -> show data.message; the allowance for this exercise is used up for now
```

---

## The call

`POST /api/v1/ai-labs/assignment-trigger-email/{ai_lab_course_id}/` - shared by app and web.

- **Body:** none. Sending any body is a `400 invalid_body`.
- **Path:** `ai_lab_course_id` is the AI Lab's `id` (the same id every other AI Labs route takes).
- **Timeout:** allow **at least 30 seconds**. AI Labs calls the exercise's email service inside the request and
  waits up to 15 s for it; our backend waits up to 25 s for AI Labs.
- **NOT IDEMPOTENT - do not retry automatically.** Every success sends a new batch and uses one of the learner's
  sends for that exercise (a rolling 24-hour allowance). Disable the button while the call is in flight. If the call times out on your
  side, do **not** resend; tell the learner to check their lab mailbox first.
- **Accepted, not delivered.** A `200` means AI Labs accepted the request. The emails arrive a few minutes later.
  There is nothing to poll - do not show a spinner that waits for them.

### Before the button can work

| Need                                                                       | Otherwise                            |
| -------------------------------------------------------------------------- | ------------------------------------ |
| Learner is a CAIRA learner                                                 | `403 caira_access_required`          |
| Learner has **started** the lab (`POST api/v1/ai-labs/course-start/{id}/`) | `404 no_ai_lab_enrollment`           |
| Learner has an AI Labs account (`api/v1/ai-labs/account-create/`)          | `400 AI_LABS_NOT_PROVISIONED`        |
| The exercise offers test emails (`tools.trigger_email: true`)              | `409 AI_LABS_TRIGGER_EMAIL_DISABLED` |

### Response 200

`data.message` is written by AI Labs for the learner (it names the mailbox and warns about the delay). **Render it
as-is.**

```json
{
  "success": true,
  "message": "Test emails are on their way to priya.nair.d7c539@mileslabs.ai. They can take a few minutes to arrive.",
  "data": {
    "status": "ok",
    "ai_lab_course_id": "5e974de7-76c3-45c7-bf42-90c7836e6141",
    "message": "Test emails are on their way to priya.nair.d7c539@mileslabs.ai. They can take a few minutes to arrive.",
    "run": {
      "id": "9f2c1b7e-5a44-4d31-8b02-6c1f9ad3e770",
      "recipient": "priya.nair.d7c539@mileslabs.ai",
      "requested_at": "2026-10-29T07:18:44.312908Z"
    }
  }
}
```

| Field              | Meaning                                                      |
| ------------------ | ------------------------------------------------------------ |
| `message`          | Show this to the learner.                                    |
| `run.id`           | The send's id. Not shown to the learner; useful for support. |
| `run.recipient`    | The lab mailbox the emails went to.                          |
| `run.requested_at` | When AI Labs accepted it (UTC).                              |

### Errors

Every error body has the same shape inside `data`:

```json
{
  "success": false,
  "message": "You have used all your test emails for this exercise for now. The allowance refills over a rolling 24 hours.",
  "data": {
    "status": "error",
    "reason": "AI_LABS_TRIGGER_EMAIL_LIMIT_REACHED",
    "message": "You have used all your test emails for this exercise for now. The allowance refills over a rolling 24 hours."
  }
}
```

| HTTP  | `data.reason`                                         | What happened                                                                                          | What to do                                                                    |
| ----- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `400` | `invalid_body`                                        | A body was sent.                                                                                       | Send no body.                                                                 |
| `400` | `AI_LABS_NOT_PROVISIONED`                             | No AI Labs account yet, so no lab mailbox.                                                             | Send the learner to AI Labs account set-up.                                   |
| `401` | -                                                     | Signed out / no token.                                                                                 | Sign in.                                                                      |
| `403` | `caira_access_required`                               | Not a CAIRA learner.                                                                                   | Hide AI Labs.                                                                 |
| `403` | `AI_LABS_TOKEN_REJECTED`                              | AI Labs did not accept the learner's session.                                                          | Show the message; ask them to sign out and in.                                |
| `404` | `ai_lab_not_found`                                    | No such AI Lab.                                                                                        | -                                                                             |
| `404` | `no_ai_lab_enrollment`                                | Lab not started.                                                                                       | Start the lab first.                                                          |
| `409` | `AI_LABS_TRIGGER_EMAIL_DISABLED`                      | This exercise has no test emails.                                                                      | The button should not have been shown - gate on `tools.trigger_email`.        |
| `409` | `ai_lab_assignment_not_configured`                    | The lab's practical is not set up on our side (AI Labs has no published exercise under our slug).      | Show the message; our team is notified.                                       |
| `429` | `AI_LABS_TRIGGER_EMAIL_LIMIT_REACHED`                 | Allowance for this exercise used up (a rolling 24-hour window, not a calendar day).                    | **Show `message`** (AI Labs' text states the cap). Do not retry.              |
| `429` | `AI_LABS_RATE_LIMITED`                                | AI Labs is busy.                                                                                       | Show the message; let the learner try again shortly.                          |
| `500` | -                                                     | Our error.                                                                                             | Show the message.                                                             |
| `502` | `AI_LABS_TRIGGER_EMAIL_FAILED`                        | The exercise's email service refused. Nothing was sent; no allowance used. Also carries `data.run_id`. | Offer a manual "Try again".                                                   |
| `502` | `AI_LABS_CALL_FAILED` / `AI_LABS_RESPONSE_UNREADABLE` | The answer was lost. **The emails may have been sent.**                                                | Show the message (it says to check the mailbox first). **Do not auto-retry.** |
| `502` | `AI_LABS_CONFIGURATION_REJECTED`                      | AI Labs rejected our platform set-up. Nothing was sent.                                                | Show the message; our team is notified. Do not retry.                         |
| `503` | `AI_LABS_LMS_UNCONFIGURED`                            | AI Labs is switched off in this environment.                                                           | Hide the button.                                                              |

For `409 AI_LABS_TRIGGER_EMAIL_DISABLED` and `429 AI_LABS_TRIGGER_EMAIL_LIMIT_REACHED`, `message` is AI Labs' own
text when they send one, so its wording can differ from the examples above. Branch on `reason`, show `message`.

## Postman

The request is in the collection as **UNIVERSAL POST ai-lab-assignment-trigger-email-v1**, with a saved example
for every row above.
