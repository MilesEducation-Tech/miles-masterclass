# AI Labs: bind "Send me test emails"

MIL-117 · branch `feat/MIL-117-ai-labs-refactor` · asked for directly (backend guide shared 2026-10-29).

## Goal

Replace the Test emails row's "isn't available yet" toast with the new route,
`POST api/v1/ai-labs/assignment-trigger-email/<ai_lab_course_id>/` (contract: `docs/AI_LABS_TRIGGER_EMAIL_API.md`).
The route reaches UAT with the backend's next deploy.

## Decisions

- **Gate.** The row shows only when the brief's `tools.trigger_email` is `true` and the lab is open (unchanged).
  It also hides once the route answers `AI_LABS_TRIGGER_EMAIL_DISABLED` or `AI_LABS_LMS_UNCONFIGURED`.
- **One tap, one batch.** The route is not idempotent and spends a rolling 24-hour allowance:
  - the row is disabled while the request is in flight, and says "Sending…" (the request can take ~25 s);
  - there is no automatic retry.
- **Copy.** A success shows AI Labs' `data.message` as-is. A refusal shows the backend's `message`, except:
  - `AI_LABS_NOT_PROVISIONED` and a refused session use the copy the submit flow already uses;
  - a lost answer (status 0 or 504) says the emails may have gone out, so check the mailbox first.
- **Loading bar.** None. The row shows its own busy state.

## Files

- `constants/ai-labs-api.ts`: the route.
- `models/ai-labs.model.ts`: `AiLabTestEmailRun`.
- `services/ai-lab-course-facade.ts`: `sendTestEmails()`, `sendingTestEmails`, `testEmailsOff`.
- `pages/ai-lab-course`: the busy row.
- The stories mock.
- `docs/AI_LABS_TRIGGER_EMAIL_API.md`: the backend's guide.

## Checks

`pnpm lint` · `pnpm format` · `pnpm build:prod` · `pnpm build-storybook`. CDP on dev 4101 with the route faked:
success (one POST for a double tap), 429 limit, 409 disabled, 502 lost answer.
