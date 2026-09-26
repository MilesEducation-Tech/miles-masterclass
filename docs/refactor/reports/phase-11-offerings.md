# Phase 11 — `features/offerings`

## 1. Summary

15 source files changed and 2 specs, with no new files and no moves. This is the largest Phase 11 row, but here it is
all dialogs.

- **17 programmatic dialog opens → `import()` at open**, across 11 files. Each static import is now `import type`:
  - webinar: `webinar-meet-cta` (Calendly) and `webinar-facade.promptSignIn` (UtilsDialog)
  - `course-resources` (HtmlContent, Video), `video-chapter` (HtmlContent), `app-download-prompt` (AppDownload)
  - masterclass: `masterclass-chapter.handleFirstChapterEnded` (UtilsDialog), `masterclass-facade`
    `selectCpeModeDialog` (SelectCpeMode) and `toggleCpeMode` (UtilsDialog)
  - micro-learning: `micro-learning-course` (FilterSheet, HtmlContent, AboutPanel), `micro-learning-course-facade`
    `toggleCpeMode` (UtilsDialog) and `launchQuizDialog` (QuizDialog)
  - assessments: `course-feedback` (UtilsDialog), `final-assessment-exam` (UtilsDialog ×2, AssessmentResult).
    `canDeactivate` still returns an `Observable<boolean>` via `from(import).pipe(switchMap)`, the same pattern as
    `auth/profile`.
- **Heavy static imports removed:**
  - `canvas-confetti` in `assessment-result-dialog` → `await import()` inside `fireConfetti()`. It is the last
    static heavy import PLAN §7 listed.
  - `swiper/modules` in `webinar/swiper-strip` → loaded alongside `swiper/element` in `initSwiper()`, the same as the
    shared `carousel` row.
- Every synchronous guard or early return still runs before the first `await`, and fire-and-forget callers use `void`.
- **Specs:** `app-download-prompt` and `final-assessment-exam` now `vi.waitFor` the open, because the dialog class
  arrives through `import()`. No assertion was weakened.
- **Audited, no change:**
  - `podcast-hero`'s `<app-wave-canvas />` stays. It is a plain 2D canvas (no three.js; §4.4's list is wrong about
    it), and it sits in the hero, the first viewport, which §4.4 says never to defer.
  - The chapter video and audio players are the page's primary content. The reel-card player is already gated by
    `@if (preloaded())`.
  - All 22 existing `@defer` blocks already have aspect-ratio-sized placeholders.
  - No `injectAsync` candidates: no offerings service pulls in a heavy library.

## 2. Verification

`verifier` subagent, full `verify.mjs`, first run:

| Gate            | Result                                    |
| --------------- | ----------------------------------------- |
| lint            | pass                                      |
| unit tests      | pass (190 files / 698 passed + 1 skipped) |
| build (local)   | pass                                      |
| build (prod)    | pass                                      |
| storybook build | pass                                      |
| format check    | pass                                      |
| bundle report   | pass                                      |
| ssr smoke       | pass: 4 of 4 routes                       |

The baseline dir was unchanged after the run. `reviewer`: **PASS**, no violations.

**Bundle:**

- Initial is unchanged at 88.0 KB gz (−1.3% vs baseline). None of these files is initial-bundle; the gain is in the
  offerings page chunks.
- There are now 312 lazy chunks. Each dialog landed in its own chunk (checked in the prod build):

  | Dialog                   | Chunk            |
  | ------------------------ | ---------------- |
  | AssessmentResult         | `chunk-2EXI47NW` |
  | SelectCpeMode            | `chunk-7E5P75VQ` |
  | HtmlContent              | `chunk-RSSRT3LL` |
  | MicroLearningQuizDialog  | `chunk-HD3T6VYV` |
  | MicroLearningFilterSheet | `chunk-MTMWNHFQ` |
  | MicroLearningAboutPanel  | `chunk-7OKKNQ3K` |

- canvas-confetti (`chunk-JBXAPQPL`, 10.7 KB) is reached only through one dynamic `import()` from the result
  dialog's chunk (4.0 KB).

## 3. Decisions needed / skipped / suspicious

- **None needed.**
- **Logged, not fixed (§2.7):**
  - `assessment-result-dialog` still uses constructor `@Inject(PLATFORM_ID)` and `OnInit`. Phase 8 (§4.1) and
    AGENTS.md §8 both miss it. It should be its own `refactor(offerings)` commit.
  - `micro-learning-course-facade.toggleCpeMode` has **zero callers** (dead). I converted it anyway so it no longer
    holds a static `UtilsDialog` import. Listed as dead code, not deleted.
  - PROMPT.md §4.4 lists `wave-canvas` as a three.js scene. It is not one, so you may want to correct the spec.
- No `@Injectable` was kept, no CSS changed, and no heavy-library service is left eager.

## 4. Visual QA list

Each dialog should open exactly as before, with at most a one-time sub-second delay on its first open:

- **Webinar:** "Book 15-Min Call" (Calendly). "Register" while signed out shows the sign-in prompt. The rails scroll
  with the mouse wheel and free-mode (swiper-strip).
- **Masterclass/podcast course page:**
  - "Watch Now" on a first visit (CPE-mode picker)
  - the CPE/Preview toggle (confirm dialog)
  - Resources → Glossary, and the navigation video
- **Chapter page:**
  - the Transcript dialog
  - finishing chapter 1 in Preview shows "Switch to CPE Mode?"
- **Micro-learning reel page:**
  - the filter sheet
  - the ⋯ menu → About / Transcript / Glossary
  - the reel CTA quiz dialog. The reel should pause first.
- **Final assessment:**
  - leave mid-exam (exit confirm)
  - submit with unanswered questions (clickable list)
  - pass: the result dialog plus confetti
- **Course feedback** submit (the profile-incomplete dialog)
- **Mobile course detail:** the app-download prompt after about 1 s, once per session

## 5. Commit message

```
perf(offerings): lazy-load the offerings dialogs, confetti and swiper modules

- 17 programmatic dialog opens across webinar, masterclass, micro-learning,
  course resources, chapters, feedback and the final assessment load their
  component with import() when opened; only the data types stay static
- assessment-result-dialog imports canvas-confetti on a pass, not statically
- swiper-strip loads swiper/modules alongside swiper/element in initSwiper()
- app-download-prompt and final-assessment-exam specs wait for the lazy open

Each dialog now lands in its own lazy chunk; initial bundle unchanged.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```
