@AGENTS.md

# Working rules for this repo

Angular 22 (standalone, SSR, v20+ naming, OnPush default) · TypeScript 6 · Tailwind v4 · ng-primitives ·
Vitest via `ng test` · ESLint 10 flat config · Storybook 10 · pnpm · Vercel.

Detailed docs — read them when the task touches them, don't inline them here:

- Architecture & folder rules → `AGENTS.md`
- Branching, commits, PRs → `docs/engineering/git-workflow.md`
- Versioning, releases, deploys → `docs/engineering/versioning.md`
- Refactor spec & progress → `docs/refactor/PROMPT.md`, `docs/refactor/STATE.md`

## Always

- **pnpm only.** Never npm, yarn or npx.
- **Never commit or push.** Write the files, then give me the commit message and let me run it.
- **Never weaken a check.** No `eslint-disable`, `@ts-ignore`, `--no-verify`, skipped or focused tests,
  and never disable or edit a verification gate. If something genuinely can't pass, stop and tell me.
- **Never edit** `.claude/`, `scripts/refactor/`, `docs/refactor/PROMPT.md`, or `docs/refactor/baseline/`.
  These belong to me.
- **Conventional Commits** for every message you propose: `type(scope): subject`.
  Types: feat, fix, refactor, chore, docs, test, style, perf, build, ci.
  Scope = area of the app (core, shared, layout, admin, payment, offerings, cpe-tracker, partners, blog, seo, auth).
- **Branch names:** `type/TICKET-short-description`, e.g. `feat/MIL-231-seat-allocation`.
- **One ticket = one branch = one PR.** Keep PRs under ~400 changed lines; propose a split when a task is bigger.
- **Don't mix a refactor with a feature** in the same change.

## Code rules (enforced by ESLint; don't wait for CI to catch them)

- Place code at the lowest level that uses it. Respect the import boundaries in `AGENTS.md`:
  core imports nothing from shared/features/admin; shared imports nothing from features/admin;
  features never import from other features.
- Use path aliases (`@core/*`, `@shared/*`, `@layout/*`, `@features/*`, `@admin/*`) across top-level folders;
  relative imports only within a feature.
- Services: `@Service()` with `inject()`. Keep `@Injectable` only where the provider needs it, with a `// why:` comment.
- Data: `httpResource` (or `resource()` for Supabase) for reads; `HttpClient` for mutations, then `.reload()`.
- Headless UI: ng-primitives only. Never `@angular/aria`, and no hand-rolled a11y widgets.
- Styling: Tailwind utilities in templates. New component CSS only for keyframes, third-party overrides,
  or `:host`/pseudo-element rules. No `NgClass`/`NgStyle` — use `[class]` or `cn()`.
- Lazy-load heavy work: `@defer` (never above the fold, always with a sized `@placeholder`) and
  `injectAsync` for services that pull heavy libraries or serve rare flows.
- Don't change a component's `changeDetection`.

## Versioning (detail in docs/engineering/versioning.md)

- Version numbers come from commit messages, never by hand-editing `package.json` outside a release.
- Build identity (`version`, `sha`, `builtAt`) flows through `scripts/generate-version.mjs` → `version.json`
  and the `APP_BUILD` define. Never `import` `package.json` into app code.
- The SSR bundle and browser bundle always ship together from the same build.

## Verification

Before telling me something is done, run what applies: `pnpm lint`, `pnpm ng test --watch=false`,
`pnpm build:prod`. During the refactor, use `node scripts/refactor/verify.mjs` instead.

## Active work: structure refactor & modernization

While `docs/refactor/` exists, all refactor work follows `docs/refactor/PROMPT.md`. Progress and handoff live in
`docs/refactor/STATE.md`. Phases run only through `/refactor-phase <n> [feature]`; `/refactor-status` shows
what's next. Each phase ends with a report and a commit message, then stops.
