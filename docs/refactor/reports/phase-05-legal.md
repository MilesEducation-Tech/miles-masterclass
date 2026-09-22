# Phase 5 — Features: `legal` (+ `compliance`, + `faq-content` promotion)

Part A, structure only. Second session of Phase 5. Run as `/refactor-phase 5 legal`.

## 1. Summary

The session opened **blocked**. The working tree was clean and `page-not-found` was committed, but the
`"dissolve pages/"` decision was still unticked — and `legal` is one of the three features the previous
session explicitly reserved for it. Rather than stop empty-handed, a read-only `import-auditor` sweep
ran first over all 8 candidate symbols (**74 distinct reference lines**), so the decision could be made
on evidence. It produced three findings, **two of which contradict PLAN.md**, and the user settled all
three before any file moved.

| Step | What                                                                                | Files | Refs updated |
| ---- | ----------------------------------------------------------------------------------- | ----- | ------------ |
| 1    | `pages/faq/shared/components/faq-content/` → `shared/components/faq-content/`       | 4     | 3            |
| 2    | Build `features/legal/` from 4 sources; dissolve `pages/shared/`                    | 17    | 2            |
| 3    | `pages/compliance/` → `features/legal/pages/compliance/` (see the correction below) | 4     | 2            |

**25 files moved, every one recorded by git as a rename** — `git diff -M100% --stat` reports
0 insertions / 0 deletions across all of them. Only 4 files carry content edits, and every hunk in them
is an import specifier.

### The three decisions

1. **`compliance` — SUPERSEDED. It now lives at `features/legal/pages/compliance/`, per PLAN.md.**
   This commit (`d12ae67`) did give it its own `features/compliance/`, on the finding that it shares
   **zero** code with the other two legal pages — its only imports are `@angular/core`,
   `@angular/platform-browser` and `@env/environment`, it defines its own local `ComplianceDocument`
   interface, and it never renders `<app-legal-doc>`. **The user reversed that afterwards**, keeping
   PLAN.md's topical grouping, and confirmed the reversal on 2026-09-22. The four files are
   byte-identical either way; only the folder and the two route imports differ. The zero-shared-code
   finding still stands as a fact about the component — it simply was not the deciding factor.
2. **`faq-content` promoted to `shared/components/faq-content/`.** `legal-doc.ts:18` and
   `legal-section.ts:3` both imported it out of `pages/faq/`, so `features/legal → features/faq` — which
   §3 bans. Its three non-spec consumers are legal-doc, legal-section and `faq-item`, i.e. **two
   top-level features**, so §3's placement rule forces `shared/`. **This closes the Phase 4 deferral**,
   whose premise — "after Phase 5 the import may not cross a feature boundary at all" — is now
   disproved. PLAN.md §2 finding 2 reached the right destination by the wrong route: its "16 importers"
   remains wrong, the real count is 3 non-spec.
3. **`core/models/faq.model.ts` → `features/faq/models/`: the user chose PLAN.md's row over my
   recommendation to strike it.** Recorded as settled. **Not executed this session**, for a reason
   independent of the disagreement: `features/faq/` does not exist yet, and moving into a
   non-existent feature folder is precisely the error Phase 3 avoided ("moving into a folder that does
   not exist yet would have made every importer a cross-feature import"). It belongs to the `faq`
   session. `faq.model.ts` is untouched in `core/` today, and every `features/legal` reference to it
   correctly uses `@core/models/faq.model`.

### The consequence of decision 3, flagged to the user before building

Decisions 2 and 3 are **jointly inconsistent with §3**. `shared/components/faq-content` imports
`FAQContent` from `faq.model`; once `faq.model` moves into `features/faq/`, that edge becomes
**`shared → features`** — §3's hardest ban, stricter than the `features → features` edge decision 3
knowingly accepts. It cannot be resolved inside the `faq` session by a move alone. Three ways out, for
that session to choose from:

- keep the import but make it `import type` and grant a Phase 7 temporary-warning exemption (the type
  is erased at runtime, so this is a compile-time-only edge);
- move **only** the `FAQContent` / `richContent` pair to `shared/` and leave the rest of `faq.model.ts`
  in the feature;
- revert decision 3 and leave `faq.model.ts` in `core/`.

Nothing in this session depends on which is picked.

### Resulting shape

```
features/legal/
  pages/{privacy-policy,terms-of-service}/
  components/{legal-doc,legal-section}/
  constants/{privacy-policy,terms-of-service}.ts
  models/legal-doc.model.ts
features/legal/pages/compliance/          ← moved here by the user after this commit
shared/components/faq-content/
```

**`pages/shared/` is completely dissolved** — it held nothing but `legal-doc` and `legal-section`, so
the emptied directories were removed. That is one of the four folders the `"dissolve pages/"` decision
names. `src/app/pages/` is down to **9** folders.

**No routes file was created for either feature.** Every page here is registered **eagerly** via
`component:`, across three mount points: `app.routes.ts:25` (top-level `/compliance`), `features.ts:60-61`
(locale-scoped), and `features.ts:69-77` (the `mobile/` plain-layout subtree). `features.ts` _is_ one of
§5's four route tables, but it belongs to the `features` slug, not this one. Extracting anything here
would change loading behaviour, which Part A forbids. Reviewer confirmed the reasoning.

## 2. Verification

`verifier`, full run, **8/8 GREEN**. No baseline flag passed;
`git status --porcelain docs/refactor/baseline/` is empty, verified.

| Gate            | Result | Time |
| --------------- | ------ | ---- |
| lint            | pass   | 5s   |
| unit tests      | pass   | 19s  |
| build (local)   | pass   | 27s  |
| build (prod)    | pass   | 33s  |
| storybook build | pass   | 23s  |
| format check    | pass   | 15s  |
| bundle report   | pass   | 0s   |
| ssr smoke       | pass   | 4s   |

**Bundle — byte-identical for the third phase running:** initial 12 files / 501.5 KB raw / 101.5 KB
gzip (**+0 KB, +0.0%**); 271 lazy chunks / 10254.9 KB raw / 3042.4 KB gzip; largest lazy
`chunk-6HHQGW3L.js` 3418.2 KB / 839.1 KB gz. 25 renames, a promotion across two top-level folders, and
not one byte of bundle drift.

**SSR smoke — OK on all 4 routes**, titles unchanged from the previous run.

Per-step gating used `tsc -p tsconfig.app.json` + `tsc -p tsconfig.spec.json` + `pnpm lint` directly,
since the harness guard blocks Claude from invoking the `--quick` wrapper (harness-owned path).

**`reviewer`: PASS, zero violations, no suppressions.** It independently confirmed via
`git diff -M100% --stat` that all 25 moved files are **0-insertion / 0-deletion renames**; that no
`features → features`, `shared → features` or `core → features` edge exists in the new tree; that
`shared/components/faq-content` imports only `@angular/*` plus `@core/models/faq.model`; that
intra-feature imports are relative and cross-folder ones aliased, per §3; that the
`LegalSection` component vs `LegalSectionModel` interface aliasing is preserved untouched; and — the
check that mattered most — that **every route path string is unchanged**, so SEO `STATIC_PATHS`,
legacy redirects and footer links are unaffected.

## 3. Decisions needed / skipped / suspicious

1. **For the `faq` session: resolve the `shared → features` conflict** described in §1. This is the only
   open item this session creates. **UPDATE (`connect-us` session, 2026-09-22): dissolved, not
   resolved.** The user chose to promote the routed `Faq` component to `shared/components/faq/`, which
   empties `pages/faq/` completely — so **there is no `features/faq/` at all**, decision 3 has no
   destination, and `faq.model.ts` + `constants/faq.ts` stay in `core/`. The §3 conflict this section
   describes cannot arise. See [phase-05-connect-us](phase-05-connect-us.md).
2. **`/compliance` is registered twice at inconsistent scopes, and has no locale-scoped page route.**
   `app.routes.ts:25` mounts it **top-level** (outside `:country/:profession_type`); `features.ts:77`
   mounts it **only** under the mobile-webview subtree. There is no `/:c/:p/compliance`.
   `footer.ts:168` links to the unscoped `/compliance` and `legacy-redirects.spec.ts:188` asserts
   `/compliance` is deliberately not a legacy path — so the shape looks intentional, but it is the only
   page in the app that works this way. **Logged, not changed** (PROMPT.md §7). Worth confirming before
   Phase 14 documents the route map.
3. **`legal-doc` and `legal-section` have no specs.** The three routed pages each have one. Not a
   blocker; noted because Part B Phases 9–10 will touch these components.
4. **Name collision, already handled — do not "tidy" it.** `legal-section.ts` exports a _component_
   `LegalSection`; `legal-doc.model.ts` exports an _interface_ of the same name, imported aliased as
   `LegalSectionModel`. Renaming either would be a logic-adjacent change Part A forbids.
5. **19 URL-string references must never be touched by a move** — `src/seo.ts:77-78` (`STATIC_PATHS`,
   the prerender/sitemap list), `core/models/seo.constants.ts:95-96`, a seeded Supabase `seo_pages` row
   (`supabase/migrations/20260427000000_seo_pages.sql:157`), `legacy-redirects.ts:67-68` + its spec,
   `layout/footer/footer.ts:164,168,172`, `auth/.../login.ts:39-40`,
   `features/payment/.../invoice.ts:65`, `shared/components/enquiry-form/enquiry-form.html:44,48`,
   `pages/faculty/faculty.html:259,265`, `shared/components/consent-banner/consent-banner.html:20`
   (a hardcoded absolute `/us/accounting/privacy-policy`), and an inline `<a href="/privacy-policy">`
   inside the `terms-of-service` constant. All key off the **URL**, not the file path, and all were
   verified unchanged.
6. **No `@Injectable` kept and no CSS deleted** — nothing in scope qualified.
7. **Build churn recurred and was cleaned.** `public/version.json` and
   `src/app/core/version/app-version.ts` were regenerated by the verifier's builds and restored with
   `git checkout HEAD --`. The diff is commit-ready: 25 renames plus 4 import-only edits plus STATE.md.

## 4. Visual QA list

None required — Part A, zero template/style/selector change, every route path verified unchanged.
Optional spot check with `pnpm start` (port **4101**): `/us/accounting/privacy-policy`,
`/us/accounting/terms-of-service`, `/compliance`, `/us/accounting/mobile/privacy-policy` (plain layout,
no header/footer), and any FAQ page — `faq-content` renders inside all of them and moved folders this
session.

## 5. Commit message

```
refactor(structure): phase 5 legal and compliance

Dissolve pages/shared/ and move the legal pages into features/, splitting
compliance into its own feature and promoting faq-content to shared/.

- features/legal/{pages,components,constants,models}/ built from four
  sources: pages/{privacy-policy,terms-of-service}, pages/shared/components/
  {legal-doc,legal-section}, core/constants/{privacy-policy,terms-of-service}
  and core/models/legal-doc.model.ts
- pages/shared/ is now gone entirely; pages/ is down to 9 folders
- compliance moved to its own features/compliance/ rather than into
  features/legal/, because it shares no code with the legal pages
  (NOTE: reversed by the user after this commit — it now lives at
  features/legal/pages/compliance/, per PLAN.md's grouping)
- faq-content promoted to shared/components/: its consumers span two
  top-level features, so PROMPT.md section 3 requires shared/
- no routes files added: every page is registered eagerly via component:
  and none is one of the four route tables section 5 extracts

25 files moved, all recorded as renames with zero content change. Every
route path string verified unchanged, so SEO STATIC_PATHS, legacy redirects
and footer links are unaffected.

Verifier 8/8 green, bundle byte-identical (+0.0%), SSR smoke OK on all 4
routes. Reviewer PASS.
```
