# Phase 12 — `features/home`

## 1. Summary

**Both stylesheets were empty, and both are deleted.** Their `styleUrl`s went too: `home-hero` and `home`. The feature
is now stylesheet-free.

**Tokens:** `home-hero.html`'s two top/bottom fade overlays changed from `from-[#0e0e0e]` to `from-background`.

- `--background` is exactly `rgb(14, 14, 14)`.
- The fades exist to blend the hero into the page background, so the token is also the right meaning.
- Only `.admin-theme` redefines `--background`, and home never renders under it.

**Colours left as they are, on purpose.** None matches a token exactly:

- `home.html` `text-[#A8A8A8]`: the nearest is `--muted-foreground` (`#A3A3A3`).
- The hero's decorative blue orb gradient stops: `#016FD9`, `#013B73`, `#013DAF`, `#001949`, `#011A81`, `#00051B`.

**No change needed:** there is no inline `styles`, `NgClass`/`NgStyle` or `@apply`. `subHeadingClass` is a component
input, not a directive.

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

- **Environment:** local, macOS, Node 24.15.
- `reviewer`: **PASS**.
- **Prod CSS:** it contains `.from-background`.
- **SSR:** the course route's `{{title}} | Master Class` title matches the recorded baseline. It is the known,
  pre-existing course-API condition, not a regression.
- **Bundle:** the initial bundle is 88.5 KB gz (−0.8% vs baseline), unchanged. There are 324 lazy chunks.

## 3. Decisions needed / skipped / suspicious

- **None new.** The spinner-colour decision from `shared/ui` is still open.
- **Kept CSS:** none.

## 4. Visual QA list

- **Home hero:** the top and bottom fade overlays should blend seamlessly into the page background, exactly as before,
  at 375 / 768 / 1440 px.

## 5. Commit message

```
style(home): drop the empty home stylesheets and tokenise the hero fades

- delete the 2 empty stylesheets (home-hero, home) and their styleUrl
- home-hero fades: from-[#0e0e0e] → from-background (exact match)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```
