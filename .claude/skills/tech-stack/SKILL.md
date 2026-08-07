---
name: tech-stack
description: The exact stack, versions, scripts, build configurations and environments of Miles Masterclass v3. Read before adding or upgrading a dependency, changing a build config, touching environment files, or when unsure which tool is responsible for something.
---

# Tech stack

Every tool in this repo, what it is responsible for, and what must not be reached for instead.

## Runtime + tooling

| Concern         | Choice                                                                       | Notes                                                                                 |
| --------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Framework       | **Angular 22.0.7**                                                           | Standalone components, signals, `@if`/`@for`. No NgModules.                           |
| Language        | **TypeScript 6.0**                                                           | `strict`. No `any`.                                                                   |
| Rendering       | **`@angular/ssr` 22 + Express 5**                                            | Hybrid SSR / SSG / CSR — per-route in `app.routes.server.ts`. `outputMode: "server"`. |
| Package manager | **pnpm 10.9**                                                                | `pnpm-lock.yaml` is the lockfile. There is no `package-lock.json`.                    |
| Node            | 20+                                                                          |                                                                                       |
| Build           | `@angular/build` (esbuild)                                                   | Not the legacy webpack builder.                                                       |
| Tests           | **Vitest 4** + jsdom                                                         | `ng test` runs Vitest, not Karma.                                                     |
| Lint            | **ESLint 10** + `angular-eslint` 22 + `typescript-eslint` + storybook plugin | Flat config: `eslint.config.mjs`.                                                     |
| Format          | **Prettier 3**                                                               | 100 cols, single quotes, `angular` parser for HTML. Config lives in `package.json`.   |
| Hooks           | Husky + lint-staged                                                          | Pre-commit runs `eslint --fix` + `prettier --write`. Never `--no-verify`.             |
| Docs            | **Storybook 10** on port 6006                                                | `*.stories.ts` co-located with the component.                                         |
| Deploy          | Vercel (`vercel.json`, `vercel.sh`)                                          |                                                                                       |

## Libraries and what each owns

| Library                                                                                   | Owns                                                                      | Do not use instead                                    |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------- |
| **Signals + RxJS 7.8**                                                                    | All state. Facades expose `signal`/`computed`; RxJS carries HTTP streams. | NgRx, Akita, NGXS, BehaviorSubject-as-store           |
| **Tailwind CSS v4** (`@tailwindcss/postcss`) + `tailwind-merge` + `clsx`                  | Styling and class composition.                                            | SCSS frameworks, CSS-in-JS, Bootstrap                 |
| **`@angular/aria` + `@angular/cdk` 22**                                                   | Accessible primitives — listbox, overlay, focus, a11y.                    | Headless UI clones, hand-rolled ARIA                  |
| **`@ng-icons` 33** (heroicons, lucide, material, phosphor, bootstrap, font-awesome, svgl) | Icons. Registered in `src/app/configuration/ng-icon.ts`.                  | Inline SVG sprites, a new icon pack                   |
| **Video.js 8** + `@videojs/http-streaming` + `videojs-youtube`                            | Video and audio playback, HLS, YouTube sources.                           | Plyr, hls.js directly, `<video>` with custom controls |
| **Swiper 12**                                                                             | Carousels. Lazy-loaded — see the bundle note below.                       | Any other carousel                                    |
| **`@supabase/supabase-js` 2**                                                             | SEO rows, admin auth, lead capture. Dynamically imported (~150 kB).       | A second Supabase client instance                     |
| **`ngx-cookie-service` / `-ssr` 22**                                                      | Cookies, behind the `Storage` service.                                    | `document.cookie`                                     |
| **jsPDF 4 + html2canvas-pro + jszip**                                                     | Certificate generation and bulk download.                                 | A server-side PDF service                             |
| **canvas-confetti**                                                                       | Celebration effects (badges, completions).                                |                                                       |
| **Express 5**                                                                             | The SSR host only.                                                        | Business logic — the backend is Django                |

## Backends

- **Django REST** at `environment.BASE_API_URL` — everything learner-facing. Always via `ApiClient`.
- **Supabase** — `seo_pages`, admin auth, anonymous lead capture. See the `supabase` skill.
- **WordPress REST** — the blog only. See the `blog` skill.

## Scripts

```bash
pnpm start                            # ng serve, port 4100, `local` config  ← default dev command
pnpm start:dev                        # ng serve, `development` config (UAT)
pnpm start:prod                       # ng serve, `production` config
pnpm build                            # build, `local`;  :dev / :prod variants exist
pnpm build:prod                       # the real pre-ship gate (AOT + budgets)
pnpm test                             # vitest
pnpm lint  |  pnpm lint:fix           # eslint
pnpm format  |  pnpm format:fix       # prettier
pnpm storybook                        # port 6006
pnpm serve:ssr:miles-masterclass-v3   # run the built SSR server (port 4000)
pnpm clean                            # nuke .angular + dist + node_modules, reinstall
```

`prestart`/`prebuild` run `scripts/generate-version.mjs`, which stamps the build version consumed by `shared/core/version/` and the update-checker.

## Build configurations

Three, defined in `angular.json`:

| Config        | Environment file             | Used for                                       |
| ------------- | ---------------------------- | ---------------------------------------------- |
| `local`       | `environment.local.ts`       | Local development                              |
| `development` | `environment.development.ts` | UAT (`.us` test domain)                        |
| `production`  | `environment.ts`             | Live (`.com`) — this is `defaultConfiguration` |

**`ng serve` defaults to the `production` configuration.** `environment.production` is therefore `true` on the dev server. Never gate dev-only code on `environment.production` — gate it on hostname.

## Environments

`src/environments/*.ts` hold `SITE_URL`, `BASE_API_URL`, `S3_BUCKET_URL`, `GCS_URL`, `AUTH` storage keys, `SUPABASE` (url + anon key), and the AI-Labs Entra/Copilot config.

Everything in these files is **public by design**: the Supabase anon key is RLS-scoped, and Entra tenant/client IDs are public identifiers. Secrets — the service-role key, the Entra client secret, DirectLine secrets, provisioning tokens — live in the Supabase dashboard or the lab backend and must never be added here. `SITE_ORIGIN` can override `SITE_URL` at runtime without a redeploy.

## Bundle budget

Initial bundle: **2 MB warning / 3 MB error**, and it currently sits close to the warning. Component styles: 12 kB / 16 kB.

- Anything large gets lazy-loaded. Swiper and the Supabase client already are — don't re-add `swiper`'s `register()` to `main.ts`.
- If `build:prod` warns, lazy-load the offender. Do not raise the budget.

## Adding a dependency

Before running `pnpm add`, walk down this list and stop at the first thing that works:

1. Does the feature need to exist at all?
2. Does something in this repo already do it? (grep `shared/` first)
3. Does the browser or TypeScript do it natively? (`Intl`, `<dialog>`, CSS, `structuredClone`)
4. Does Angular do it? (`@angular/aria`, `@angular/cdk`, `@angular/forms`)
5. Does an already-installed package do it?
6. Only then: add one, and say in the prompt why 1–5 didn't cover it.

## Gotchas

- After switching branches, run `pnpm install --frozen-lockfile`. Skipping it is the usual cause of "shared UI suddenly broke."
- `pnpm lint` (~55 errors) and `pnpm test` (~14 failures) are **already red** on `master` from stale mocks and a11y rules. Diff against the baseline; `build:prod` is the gate that must stay green.
- The app is **zoneless by omission** — `provideZoneChangeDetection` is not configured. Signals drive change detection; anything outside a signal won't re-render.
- `@angular/animations` is in `package.json` but no source imports it. Angular deprecated it in v20.2 in favour of `animate.enter`/`animate.leave`. Audit transitive deps before removing.
- Dev port is **4100**, not 4200. `.vscode/launch.json` may still say 4200.
