## What

One or two sentences on what this changes.

## Why

Ticket: MIL-___
The problem this solves.

## How to test

1. Open the preview URL at /…
2. …

## Screenshots / recordings

(Required for any UI change: mobile 375px + desktop.)

## Checklist

CI enforces the machine-checkable rules (`pnpm lint` also runs the structure check). These are the ones a
reviewer has to hold you to — see AGENTS.md §3–§4:

- [ ] `pnpm lint`, `pnpm format`, `pnpm ng test --watch=false`, `pnpm build:prod` pass locally
- [ ] No new `eslint-disable`, `@ts-ignore`, skipped tests, or `structure-baseline.json` entries (or each new
      entry has a reason and is called out here)
- [ ] Code sits at the lowest level that uses it; no feature imports another feature (AGENTS.md §3)
- [ ] Reads are `httpResource` / `resource()` in a facade, guarded with `hasValue()`, with loading and error
      states; mutations go through `ApiClient` then `.reload()` (§4.2)
- [ ] Nothing above the fold is `@defer`red; heavy libraries and code-opened dialogs load with `import()` /
      `injectAsync` (§4.4–§4.5)
- [ ] Tailwind utilities and `@theme` tokens; new component CSS only for keyframes, third-party DOM, `:host`
      rules or PDF DOM (§4.6)
- [ ] UI checked at 375 / 768 / 1440 px on the preview URL; intentional visual differences listed above
- [ ] Branch is `type/TICKET-description` and the PR title is a Conventional Commit
