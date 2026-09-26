# Phase 12 — `shared/dialogs`

## 1. Summary

**Of 14 stylesheets, 11 are deleted and 3 are trimmed. One inline `styles` block was converted.** Every dialog here is
opened from code, so no call site puts classes on these hosts, and moving a `:host` rule to a host class cannot change
the cascade.

**Deleted:**

- `filter-dialog`, `share-dialog` and `utils-dialog` were empty.
- `badge-claim-upsell-dialog` and `badge-info-dialog` held only a comment.
- `block-status-dialog`, `certificate-download-dialog`, `profile-completion-dialog` and `version-update-dialog`:
  their `:host { display: block }` rule became `host: { class: 'block' }`.
- `course-info` and `ai-lab-agent-dialog` became template utilities.
  - Their `.content` + `.content--visible` pair is always applied together, so it collapsed into one static list.
  - `.title`, `.subtitle` and `.description` became utilities, and the class names were dropped. The global
    unlayered `.title` and `.description` in `styles.css` would otherwise outrank the utilities. The title's
    `text-white`, which came from that global rule, is now written out.
  - Both use the global `slideIn` keyframe via `animate-[slideIn_…]`.
  - `course-info`'s `.nav` rule was dead (nothing uses it) and was dropped.
  - `ai-lab-agent-dialog`'s phone block, `@media (max-width: 639px)`, became `max-sm:` variants:
    - `static`, `m-0`, `w-full`, `px-5 pt-36 pb-5`, `animate-none`, `opacity-100`
    - `aspect-auto` on the hero

    Its explanation moved into the template as a comment.

**Trimmed and kept, each with a §4.6 reason:**

- `calendly-dialog`: the iframe rule stays, because Calendly's embed script injects that iframe (third-party DOM).
  Its `:host` became a host class.
- `ai-lab-dialog`: the orbit keyframes stay. Its `:host` became a host class.
- `webinar-details-dialog`: keeps **its own** scoped `@keyframes slideIn`, behind a `.rise-in` class. It is a 20px
  rise, not the global blur-and-20% one, and Angular scopes keyframe names. Its `.content`/`.title` rules converted
  as above.

**Inline:** `video-dialog`'s `:host` became `host: { class: 'block h-full w-full max-h-[inherit]' }`.

**Tokens:** no change, because no hardcoded hex matches a token exactly. `#0E0E10` and `#39434f` are 1–2 units off
`--background` and `--card`. Rounding them onto those tokens would be a visible change.

## 2. Verification

These are the `verifier` subagent's results from the full `verify.mjs` run, which passed first time.

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

- The baseline dir was unchanged after the run.
- `reviewer`: **PASS**. It checked each file against the `HEAD` original, including the `max-sm` mapping.
- Dialog specs: 9 files / 20 tests pass.
- The prod CSS contains every new variant (`max-sm:*`, `max-h-[inherit]`, the text shadow), and `.rise-in` is in the
  webinar-details chunk.

**Bundle:** the initial bundle is 88.4 KB gz, −0.9% vs baseline, up 0.1 KB on the last row. There are 324 lazy chunks,
and they are 1.9 KB gz smaller. This follows the same pattern as the `shared/components` row: lazy component CSS moves
into the initial global sheet.

## 3. Decisions needed / skipped / suspicious

- **None new.** The spinner-colour decision is still open.
- No `@Injectable`, no `NgClass`/`NgStyle`, and no remaining `@apply` in this folder.

## 4. Visual QA list

Check at 375 / 768 / 1440 px, since none of these could be opened locally without UAT course data.

- **Course info ("Learn More" on the hero slider):** hero overlay text, fade-in, text shadow.
- **Webinar details dialog:** its 20px rise-in, which must still differ from course-info's blur.
- **AI Lab agent dialog:**
  - Desktop: the overlay sits at the bottom of the hero.
  - Phone, below 640 px: the block sits in normal flow with 9rem top padding, and there is no animation.
- **AI Lab dialog orbit, Calendly dialog, video dialog:** height and max-height.

## 5. Commit message

```
style(shared): move shared/dialogs styling to Tailwind utilities

- delete 11 dialog stylesheets: 5 empty/comment-only, 4 :host → host
  class, course-info and ai-lab-agent-dialog → template utilities (its
  phone @media block → max-sm: variants)
- calendly (third-party iframe), ai-lab (orbit keyframes) and
  webinar-details (its own scoped slideIn) keep only what Tailwind can't do
- video-dialog: inline :host styles → host class

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```
