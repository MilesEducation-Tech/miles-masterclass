# AI Labs — the course page

## Goal

Port `miles-masterclass-v3@master`'s AI Lab course page: watch the video, pass the final
assessment, then build an agent in Copilot Studio and submit it for evaluation. UI only.

Subtask 3 of 3, after `prompts/ai-labs-ui-parity.md` and `prompts/ai-labs-progress-widgets.md`.

## Why this one is shaped differently

Upstream the page is 1081 lines of template over 1145 lines of TypeScript, and the TypeScript is
mostly wiring: four facades (`MicroLearningCourseFacade`, `ChapterFacade`,
`FinalAssessmentFacade`, `FeedbackFacade`), four `resource()`s and a submission service. **There is
no "just the UI" subset of that file.**

So the template came across nearly verbatim and the component was rewritten: every root is an
input, every action an output, and what survives is the derivation the design encodes — the four
gates, the CTA labels, the picker's either/or rule, the brief's measured clamp, the step bar.

The template needed ten edits in total, all of them service references:
`facade.handleTimeUpdate/handleVideoEnded/handleActionStatus/ctaLoading/loading/error` and
`labsAuth.restoring/signingIn/error/hint`. Everything else is the design as published.

## Three things that could not come across, each for a boundary reason

| Upstream                                    | Here                                    | Why                                                                                                                                                  |
| ------------------------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `deriveActionStatus(reel)` → `ActionStatus` | `ctaStage` input, `AiLabCtaStage` union | That enum lives in `features/offerings`, and a feature may not import another feature (AGENTS.md §3). Spellings match the API, so binding is a cast. |
| `isReelCompleted(reel)`                     | `completed` input                       | Same boundary.                                                                                                                                       |
| `details().lab_assignment_id`               | `labMapped` input                       | Our `ContentDetails` has no such field, and adding one to a core model for a page that cannot use it yet would be speculative.                       |

One more, for a data reason rather than a boundary one: upstream derives watched percentage from
`last_activity`, which is **watched seconds** on their payload and an **ISO timestamp** on ours.
Deriving it here would compute nonsense from a date, so `progress` is an input.

## Files

- `features/ai-labs/pages/ai-lab-course/{ts,html,stories.ts}`
- `features/ai-labs/ai-labs.routes.ts` — the `:courseId/:courseTitle` child
- `features/ai-labs/models/ai-labs.model.ts` — `AiLabCtaStage`, `AiLabAgent`, `AiLabFlow`,
  `AiLabAssignmentBrief`, `AiLabAssignmentStatus`, `AiLabPick`, `AiLabMaterial`
- `shared/components/skeleton/ai-lab-course-skeleton/` — ported, `ml-auto` → `ms-auto` for RTL
- `testing/mocks/ai-labs.mock.ts` — brief, agents, flows and an evaluated submission

Shared components substituted: upstream's `app-aria-select` → our `app-select`; its `size="xs"`
progress → our `sm` (we have no `xs`).

## The route must not inherit the animation providers

The child sits **outside** the landing route's `providers: [provideGsap(), provideMotion()]`. Those
are what pin gsap, lenis and motion to the landing chunk; the course page does not animate, and
nesting it under them would drag all three into its chunk for nothing.

**Verified:** the course page builds as its own 53 kB chunk with **zero** gsap references.

## Known state: the route renders blank

Reached directly, `/{country}/{profession}/ai-labs/:courseId/:courseTitle` returns 200 and mounts
`app-ai-lab-course`, which then renders nothing — the whole page is gated on `@if (course())` and
no data is bound. It is also unreachable by clicking, since subtask 1's catalogue is empty without
its API.

The stories are therefore the only place the design can be seen, and the only honest place until
the reads are bound. An invented "not available" state is deliberately **not** added: it is not in
the source design, and binding is the real fix.

## Not ported

The exam, report and feedback child routes. They are offerings pages behind `authGuard` with their
own facades.

## Checks

`pnpm lint` · `pnpm format:fix` · `pnpm build:prod` · `pnpm build-storybook`. The acceptance
surface is **9 stories** under _AI Labs/Course page_, stepping the four gates: not-started →
awaiting-exam → lab-unlocked → evaluating → evaluated, plus lab-not-mapped, loading and errored.
`lab-unlocked` is the one to read closely — the fixture's disabled flow must not appear in the
workflow select.
