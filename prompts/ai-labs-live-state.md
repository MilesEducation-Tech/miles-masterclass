# AI Labs — the CTA and the lab state stay live without a reload (MIL-117)

Branch `feat/MIL-117-ai-labs-refactor`, on top of the uncommitted flow-bug fixes (`prompts/ai-labs-flow-bugs.md`).

**Ask:** feedback, certificate, quiz/assessment, lab and grade actionables only move after a manual browser refresh.
They must update by themselves, as in v3.

## What I read

- Ours: `ai-lab-course-facade.ts` (every read, the grading poll, the certificate re-read, `open()`),
  `ai-labs-facade.ts` (landing reads, provisioning poll), `ai-lab-credits.ts` (tab-return re-read),
  `ai-lab-quiz-facade.ts`, `ai-lab-assessment-facade.ts`, `ai-lab-feedback-facade.ts`, `ai-labs.routes.ts`, the
  course and landing pages, and their stories and mocks.
- v3 `origin/feat/ai-labs-refactor`:
  - `pages/ai-lab/ai-lab.ts`: the landing facade is **component-scoped** "so the account-status poll stops".
  - `course/ai-lab-course.ts`: the page calls `facade.clear()` on destroy, polls progress every 12 s while grading,
    and bridges a fresh submit.
- Angular 22.2.3 source (`_resource-chunk.mjs`, router `routeInjectorCleanup`).
- Guide `docs/AI_LABS_API.md` (`01c7a4d`): §0 journey, Lab progress, Submit / Status.

## Root causes

| #   | What the learner sees                                                                                                                           | Cause                                                                                                                                                                                                                                                                                                                  |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A   | Back on a page you visited earlier, the CTA, the grade, the feedback gate and the certificate show what they were last time                     | A route's `providers` injector lives as long as the app, so these route-scoped facades and their reads outlive the page. Last turn fixed course, exam and feedback (`open()` re-reads). **Not yet:** the landing's labs, "Where your labs stand", the account and credits, nor the course page's agent and flow lists. |
| B   | The CTA blinks back to "Watch the lab video" and the brief and evaluation panels empty for a moment whenever the lab is re-read                 | `progress`, `brief` and `status` key their request on `started()`, an object. Every `course-started/` re-read makes a new object, which re-keys those three reads, and **Angular resets a re-keyed resource to its default (`null`) until it answers.** `reload()` keeps the value; a re-key does not.                 |
| C   | Built an agent in Copilot Studio (another tab), came back, and the picker doesn't list it; the grade landed while the tab was in the background | Only `AiLabCredits` re-reads on tab return. Our flow sends the learner to Copilot Studio in another tab to build, and browsers slow timers in background tabs, so the 12 s grading poll can lag minutes behind.                                                                                                        |
| D   | (not visible) the grading poll, the certificate re-read and the provisioning poll keep calling AI Labs after you leave the page                 | They are tied to the route injector's `DestroyRef`, which never fires. v3 stops them with `facade.clear()` on page destroy.                                                                                                                                                                                            |

Already live, so unchanged here:

- Start re-reads `course-started/`.
- Crossing 95% of the video re-reads progress (`just_completed`).
- The last quiz answer re-reads progress.
- A submit re-reads status, which starts the 12 s poll; when grading settles, progress and attempts are re-read.
- The cool-off end re-reads progress.
- Feedback leads to the certificate re-read, every 5 s for up to 60 s.

## Locked decisions

1. **Pages tell their facade when they are on screen**, which is v3's `clear()` on destroy.
   - `AiLabCourseFacade` gets `close()`, and `AiLabsFacade` gets `enter()` and `leave()`. Each page calls the pair
     from its constructor and its own `DestroyRef`.
   - While a facade is off screen: no grading poll, no certificate re-read, no cool-off timer, no provisioning poll, no
     tab-return re-read.
   - Opening the page again restarts what applies: the grading poll if still grading, provisioning if still
     requested, and so on.
   - No component-level `providers`. They would shadow the stand-in facades every AI Labs story provides through
     `moduleMetadata`.
2. **Every entry re-reads the live state, keeping what is on screen until the answer lands.**
   - The course page, after the first visit: everything `open()` re-reads today, **plus** the agent and flow lists
     and credits.
   - The landing, after the first visit: `courses/`, `practical-progress/`, `account-ensure/` and credits.
   - The first visit needs no extra read. For the landing, a flag also avoids a second request after SSR hydration.
3. **Tab return re-reads the live state**, the `AiLabCredits` pattern extended.
   - Trigger: `visibilitychange` to `visible`, browser only, while on screen, at most once every 10 s.
   - Course page: progress, status, attempts, agents and flows.
   - Landing: labs and practical progress.
   - Credits keeps its own listener.
   - The manual Refresh buttons stay as a fallback.
4. **Stable request keys.** `progress`, `brief` and `status` gate on a boolean `isStarted` computed, not on the
   `started()` object. A re-read of `course-started/` then only reloads them (value kept), and never re-keys them
   (value blanked). This fixes the blink in B.
5. **Not doing:**
   - **v3's submit bridge.** Our 202 records the submission before answering, so the status re-read right after it
     already reads `in_progress` and starts the poll.
   - **An app-wide `withAutoCleanupInjectors()`.** Angular 22 has it, and it would destroy every route injector a
     navigation leaves, which is the true root of A across the whole app. It changes the lifetime of every
     route-scoped facade in every feature, so it is its own PR and your call. I'll list it under open questions.

## Files touched

| File                                                    | Change                                                                                                                                        |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `features/ai-labs/services/ai-lab-course-facade.ts`     | `onScreen` signal, `close()`, `isStarted` key, polls and timers gated on `onScreen`, tab-return re-read, agents/flows in the re-entry re-read |
| `features/ai-labs/services/ai-labs-facade.ts`           | `enter()` / `leave()`, re-entry and tab-return re-reads, provisioning poll stopped off screen and resumed on entry                            |
| `features/ai-labs/services/ai-lab-credits.ts`           | `refresh()`; the tab listener skips when off screen                                                                                           |
| `features/ai-labs/pages/ai-lab-course/ai-lab-course.ts` | `close()` + `credits.refresh()` wired to the page lifecycle                                                                                   |
| `features/ai-labs/pages/ai-labs/ai-labs.ts`             | `enter()` / `leave()` + `credits.refresh()`                                                                                                   |
| `testing/mocks/ai-labs.mock.ts`                         | the stand-in facades gain the no-op lifecycle methods                                                                                         |
| `docs/refactor/STATE.md`                                | Now + step log                                                                                                                                |

About 100–130 changed lines. With the uncommitted flow-bug work (~310) the branch goes over the ~400-line guide, so this
lands as **its own commit**. Commit the flow-bug fixes first; I'll give you both messages.

## Security

No new endpoints, no new data. Every re-read uses the existing quiet `ApiClient` / `httpResource` path with the
interceptors' token; nothing goes to the network outside them.

## Acceptance (all with no browser refresh)

1. **Grade → feedback:** on the lab page with a submission `in_progress`, when status turns `completed` and progress
   says `feedback`, the CTA becomes "Submit Feedback" within one poll (~12 s).
2. **Feedback → certificate:** after Return to Home, the CTA reads "Certificate is being generated", then "Download
   Certificate" once the URL arrives (already verified; re-checked).
3. **Exam → lab:** after passing, back on the lab page the CTA moves on, and the lab section unlocks.
4. **Quiz:** the last answer moves the CTA to "Take final assessment".
5. **Tab return:** with a new agent added server-side and the tab hidden then shown, the picker lists it. With the
   grade completed while hidden, the CTA moves on at once.
6. **Landing:** lab page → back to AI Labs with a lab newly graded: "Where your labs stand" shows it in the graded
   group, and the counts follow.
7. **No blink:** re-entering the lab page never shows the CTA, brief or evaluation panel empty between the old state
   and the new.
8. **Stand down:** leave the lab page while grading, and no further `assignment-status/` request goes out.

## Checks

`pnpm lint` · `pnpm check:structure` · `pnpm format:fix` · `pnpm build:prod` · `pnpm build-storybook`.

## How I'll verify

I'll extend the CDP script (headless Chrome, dev server on 4101) with a **stateful** AI Labs stand-in. The script
moves the server state (grade lands, agent added, certificate issued) and never reloads the page. It asserts each
acceptance item:

- the CTA label and panel text, sampled by a `MutationObserver` so a blink is caught;
- a count of requests per route after leaving.

Tab return is driven by emitting `visibilitychange` with `visibilityState` overridden.

Then you re-run the real flow on UAT.

## Risks

- **More AI Labs reads.** One set per page entry and per tab return (≤ 1 per 10 s); everything else is unchanged. All
  reads are quiet, so there is no loading bar and no toasts.
- **A page that forgets `close()`/`leave()`** keeps today's behaviour, never worse. Only the two pages with polls need
  them.
