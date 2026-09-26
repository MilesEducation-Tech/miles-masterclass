// @ts-check
import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import angular from 'angular-eslint';
import storybook from 'eslint-plugin-storybook';
import boundaries from 'eslint-plugin-boundaries';

// Top-level folders under src/. Any import crossing one of them must use its path alias,
// so a relative specifier that climbs into one is banned (PROMPT.md §3). A leading "../"
// followed by a globstar also matches the depth-1 case, because "**" spans zero segments.
const CROSS_FOLDER_RELATIVE_IMPORTS = [
  'core',
  'shared',
  'layout',
  'features',
  'admin',
  'testing',
  'environments',
].map((folder) => `../**/${folder}/**`);

// Built by concatenation so this file does not itself contain the banned identifiers.
const BANNED_CLASS_DIRECTIVES = ['Class', 'Style'].map((suffix) => `Ng${suffix}`);

export default [
  {
    // Vendored / generated data files — not source code. The location*.ts
    // bundles are ~1.4M lines of country/state JSON-as-TS literals; linting
    // them produces hundreds of `no-useless-escape` errors on regex-shaped
    // value strings and offers no review value.
    ignores: [
      'src/app/core/constants/location.ts',
      'src/app/features/payment/constants/location-min.ts',
    ],
  },
  ...defineConfig([
    {
      files: ['**/*.ts'],
      extends: [
        eslint.configs.recommended,
        tseslint.configs.recommended,
        tseslint.configs.stylistic,
        angular.configs.tsRecommended,
      ],
      processor: angular.processInlineTemplates,
      plugins: { boundaries },
      settings: {
        // Anchor classification to the repo root rather than process.cwd(): every element
        // pattern below is written as a full path from it.
        'boundaries/root-path': import.meta.dirname,
        // The default (true) injects captured values at the template top level, where they
        // shadow real variables. Keep captures in the `captured` namespace only.
        'boundaries/legacy-templates': false,
        // Flat config activates no resolver by default, and an unresolvable alias is
        // classified `external`, which `boundaries/dependencies` skips. Left at its default
        // this setting would turn a broken resolver into a silent, fully green lint run.
        'boundaries/flag-as-external': { unresolvableAlias: false },
        'import/resolver': {
          typescript: { alwaysTryTypes: true, project: './tsconfig.json' },
        },
        // `partialMatch: false` on every descriptor is mandatory, not stylistic. The v7
        // default matches patterns right-to-left against path suffixes, which would classify
        // src/app/admin/core/** as element `core` and src/app/admin/layout/** as `layout` —
        // inverting the admin rules and inventing false core-imports-shared errors. It is
        // also the plugin's announced future default.
        //
        // Order is precedence. The last two are catch-alls and must stay last:
        //   app-root  -> app.*.ts, configuration/, features/features.routes.ts
        //   bootstrap -> main.ts, server.ts, seo.ts, legacy-redirects.ts, environments/
        // Both are composition roots, so they deliberately carry no outbound restriction.
        'boundaries/elements': [
          { type: 'core', pattern: 'src/app/core', partialMatch: false },
          { type: 'shared', pattern: 'src/app/shared', partialMatch: false },
          { type: 'layout', pattern: 'src/app/layout', partialMatch: false },
          { type: 'testing', pattern: 'src/app/testing', partialMatch: false },
          // One element, not one per admin feature: §3 lets admin import itself, so
          // admin-to-admin edges are intra-element and free. To ban them later, change this
          // to `pattern: "src/app/admin/*", capture: ["adminFeature"]`.
          { type: 'admin', pattern: 'src/app/admin', partialMatch: false },
          {
            type: 'feature',
            pattern: 'src/app/features/*',
            capture: ['feature'],
            partialMatch: false,
          },
          { type: 'app-root', pattern: 'src/app', partialMatch: false },
          { type: 'bootstrap', pattern: 'src', partialMatch: false },
        ],
        'boundaries/files': [
          { category: 'test', pattern: '**/*.spec.ts' },
          { category: 'story', pattern: '**/*.stories.ts' },
          // Load-bearing catch-all: an array query returns false against a null value, so
          // without a category on ordinary files the `noneOf` selector in the testing policy
          // would never match and @testing/* would be importable from anywhere, silently.
          { category: 'source', pattern: 'src/**/*.ts' },
        ],
      },
      rules: {
        // AGENTS.md §8: no `any`. An error everywhere, so no new file can introduce it; the
        // files that already use it are downgraded to a warning in LEGACY_ANY_FILES below.
        '@typescript-eslint/no-explicit-any': 'error',
        '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
        '@typescript-eslint/no-empty-object-type': 'off',
        '@typescript-eslint/no-non-null-asserted-optional-chain': 'off',
        '@angular-eslint/no-output-native': 'off',
        '@angular-eslint/template/click-events-have-key-events': ['off'],
        // AGENTS.md §4.1: dependencies come from `inject()`, never constructor parameters.
        // Phase 8 converted every constructor; this keeps it that way.
        '@angular-eslint/prefer-inject': 'error',
        '@angular-eslint/directive-selector': [
          'error',
          {
            type: 'attribute',
            prefix: 'app',
            style: 'camelCase',
          },
        ],
        '@angular-eslint/component-selector': [
          'error',
          {
            type: 'element',
            prefix: 'app',
            style: 'kebab-case',
          },
        ],
        // PROMPT.md §3 import boundaries. `default: "allow"` plus explicit disallow policies
        // is a 1:1 transcription of §3, which is itself written as a list of bans. A
        // disallow-by-default config would instead need an allow entry for every
        // architecturally empty arrow out of the composition roots (app.routes.ts,
        // features.routes.ts, src/server.ts, @env/*, ./configuration/ng-icon).
        // Dynamic import() is covered: `boundaries/dependency-nodes` includes it by default.
        'boundaries/dependencies': [
          'error',
          {
            default: 'allow',
            message:
              '{{from.element.types.[0]}} must not import {{to.element.types.[0]}} ({{dependency.source}}) — see docs/refactor/PROMPT.md §3',
            policies: [
              {
                from: { element: { type: 'core' } },
                disallow: {
                  to: { element: { types: { anyOf: ['shared', 'layout', 'feature', 'admin'] } } },
                },
              },
              {
                from: { element: { type: 'shared' } },
                disallow: {
                  to: { element: { types: { anyOf: ['feature', 'admin', 'layout'] } } },
                },
              },
              {
                // `to: feature` means a *different* feature: same-element imports have
                // relationship `internal` and are skipped by `checkInternals: false`.
                from: { element: { type: 'feature' } },
                disallow: {
                  to: { element: { types: { anyOf: ['feature', 'admin', 'layout'] } } },
                },
              },
              {
                from: { element: { type: 'admin' } },
                disallow: { to: { element: { types: { anyOf: ['feature', 'layout'] } } } },
              },
              {
                // Extends §3, which states outbound rules for core, shared, features, admin
                // and testing but is silent on layout. Without this, layout importing a
                // feature goes unreported.
                from: { element: { type: 'layout' } },
                disallow: { to: { element: { types: { anyOf: ['feature', 'admin'] } } } },
              },
              {
                to: { element: { type: 'testing' } },
                disallow: { from: { file: { categories: { noneOf: ['test', 'story'] } } } },
                message: '@testing/* is importable only from specs and stories',
              },
            ],
          },
        ],
        // The web app does not call `app-api/` routes. That surface belongs to the
        // mobile app; this project uses `api/v1/` and `web-api/v1/` only.
        //
        // This is a lint rule rather than a convention because the temptation is
        // specific and already documented: `app-api/v1/events/all-bookings/` is
        // the ONLY place the attended-duration and poll-count fields exist, and
        // the design asks for them (the "110/120 Minutes" line on a completed
        // card). Someone will find that endpoint and reach for it. See
        // `docs/WEBINAR_API_QUESTIONS.md` Q2 — the answer is to ask for a
        // `web-api` twin, not to cross the surface.
        //
        // Matches the URL string, not an import, so `no-restricted-imports`
        // cannot express it. Comments are not AST nodes, so the explanatory
        // comments naming this endpoint do not trip it.
        'no-restricted-syntax': [
          'error',
          {
            selector: 'Literal[value=/app-api\\//]',
            message:
              "Banned: the web app does not call `app-api/` routes (that surface is the mobile app's). Use `api/v1/` or `web-api/v1/`; if only an app-api route has the data, ask for a web twin — see docs/WEBINAR_API_QUESTIONS.md.",
          },
          {
            selector: 'TemplateElement[value.raw=/app-api\\//]',
            message:
              "Banned: the web app does not call `app-api/` routes (that surface is the mobile app's). Use `api/v1/` or `web-api/v1/`; if only an app-api route has the data, ask for a web twin — see docs/WEBINAR_API_QUESTIONS.md.",
          },
        ],
        '@typescript-eslint/no-restricted-imports': [
          'error',
          {
            paths: [
              {
                name: '@angular/common',
                importNames: BANNED_CLASS_DIRECTIVES,
                message:
                  'Banned (PROMPT.md §4.6). Use a [class] / [style] binding, or cn() for conditional classes.',
              },
              {
                name: '@angular/aria',
                message: 'Banned (PROMPT.md §1). Build headless primitives on ng-primitives.',
              },
              // PROMPT.md §4.1 / Phase 8. `@Service()` is `providedIn: 'root'` and
              // `@Service({ autoProvided: false })` is a bare `@Injectable()` —
              // identical at runtime (`ɵɵdefineService` sets
              // `providedIn: autoProvided === false ? null : 'root'`).
              //
              // The allowlist for this rule is deliberately EMPTY, because the
              // Phase 8 audit found nothing to put in it: zero `InjectionToken`,
              // zero `multi: true`, and zero `providedIn` other than `'root'`
              // anywhere in `src/`.
              //
              // What WOULD justify an exception, since `@Service` cannot express
              // any of it: `useClass` / `useValue` / `useExisting` / `useFactory` /
              // `deps`, or `providedIn: 'platform' | 'any' | <NgModule>`. If one of
              // those ever lands, add a scoped `files: [...]` override block turning
              // this rule off for that file, and say why at the call site.
              {
                name: '@angular/core',
                importNames: ['Injectable'],
                message:
                  'Banned (PROMPT.md §4.1). Use @Service() for a root singleton, or @Service({ autoProvided: false }) for one listed in a providers array. Keep @Injectable only for a provider shape @Service cannot express (useClass/useValue/useExisting/useFactory/deps, or providedIn other than root) — and add a scoped override here if so.',
              },
              // AGENTS.md §8: cleanup runs through `DestroyRef` (+ `takeUntilDestroyed()`),
              // never the `OnDestroy` lifecycle interface.
              {
                name: '@angular/core',
                importNames: ['OnDestroy'],
                message:
                  'Banned (AGENTS.md §8). Inject DestroyRef and register cleanup with destroyRef.onDestroy(...) or takeUntilDestroyed().',
              },
            ],
            patterns: [
              {
                group: ['@angular/aria/*'],
                message: 'Banned (PROMPT.md §1). Build headless primitives on ng-primitives.',
              },
              {
                group: CROSS_FOLDER_RELATIVE_IMPORTS,
                message:
                  'Relative imports must not cross a top-level folder (PROMPT.md §3). Use @core/*, @shared/*, @layout/*, @features/*, @admin/*, @testing/* or @env/*.',
              },
            ],
          },
        ],
      },
    },
    // LEGACY_ANY_FILES — the ratchet for `no-explicit-any` (AGENTS.md §8). These 34 files
    // already used `any` when the rule became an error (MIL-240, 135 hits), so they only warn:
    // the debt stays visible in every lint run without failing it. Every other file errors.
    // Remove a file from this list once its `any`s are gone; never add one.
    {
      files: [
        'src/app/core/models/feature.model.ts',
        'src/app/core/models/http.model.ts',
        'src/app/core/models/library-filters.model.ts',
        'src/app/core/services/feature-facade/feature-facade.ts',
        'src/app/core/services/location/location.ts',
        'src/app/core/services/logger/logger.ts',
        'src/app/core/services/section-filters-facade/section-filters-facade.spec.ts',
        'src/app/features/offerings/components/chapter-quiz/chapter-quiz.ts',
        'src/app/features/offerings/components/course-resources/course-resources.ts',
        'src/app/features/offerings/pages/course-feedback/course-feedback.ts',
        'src/app/features/offerings/pages/final-assessment-exam/final-assessment-exam.spec.ts',
        'src/app/features/offerings/pages/final-assessment-exam/final-assessment-exam.ts',
        'src/app/features/offerings/pages/final-assessment-report/final-assessment-report.ts',
        'src/app/features/offerings/services/chapter-facade.ts',
        'src/app/features/payment/pages/plan/plan.ts',
        'src/app/layout/footer/footer.stories.ts',
        'src/app/layout/footer/footer.ts',
        'src/app/layout/header/header.stories.ts',
        'src/app/shared/components/app-download/app-download.ts',
        'src/app/shared/components/cards/horizontal/horizontal.ts',
        'src/app/shared/components/cards/hover/hover.ts',
        'src/app/shared/components/cards/vertical/vertical.ts',
        'src/app/shared/components/carousel/carousel.ts',
        'src/app/shared/components/laptop/laptop.ts',
        'src/app/shared/components/marquee/marquee.ts',
        'src/app/shared/components/slider/slider.ts',
        'src/app/shared/dialogs/filter-dialog/filter-dialog.ts',
        'src/app/shared/dialogs/utils-dialog/utils-dialog.ts',
        'src/app/shared/ui/aria/aria-autocomplete/aria-autocomplete.ts',
        'src/app/shared/ui/aria/aria-input/aria-input.ts',
        'src/app/shared/ui/aria/aria-multiselect/aria-multiselect.ts',
        'src/app/shared/ui/aria/aria-select/aria-select.ts',
        'src/app/shared/ui/otp/otp.ts',
        'src/app/testing/mocks/services.mock.ts',
      ],
      rules: { '@typescript-eslint/no-explicit-any': 'warn' },
    },
    {
      files: ['**/*.html'],
      extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
      rules: {
        // AGENTS.md §8: built-in control flow (`@if` / `@for` / `@switch`), never `*ngIf` / `*ngFor`.
        '@angular-eslint/template/prefer-control-flow': 'error',
      },
    },
  ]),
  ...storybook.configs['flat/recommended'],
];
