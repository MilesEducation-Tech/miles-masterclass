# Refactor state

Cross-session handoff. Claude updates "Now", the trackers, open questions and the step log.
The user owns the "Decisions" section.

Status legend: ⬜ not started · 🟡 in progress · ✅ done (verified, reported) · ⛔ blocked · ⏸ awaiting decision

## Now

- Phase: **5 — Features (per feature) 🟡.** Committed: `page-not-found` (`1462e72`),
  `legal`+`compliance` (`d12ae67`), and `connect-us`+`Faq` + `uae-caira` + **the magnet promotion ✅**
  (`9961f69`, merged `3f49678`). Report:
  [phase-05-magnet-promotion](reports/phase-05-magnet-promotion.md). `verifier` **8/8 green**,
  `reviewer` **PASS, zero violations**.
- **The magnet promotion resolved the `uae-caira` decision — user chose option (a), all six.**
  It became **seven**: 16 files moved, 26 import sites rewritten, `features/partners/shared/models/`
  deleted.
- **The audit is what turned six into seven, and it was the whole point of running it.**
  `partner-content-list.ts:4` imported `iconXPartner` from a sibling `partner-icons.ts` that was **not**
  on the list and would have stayed in `features/partners/`. Promoting the component without it would
  have created exactly the **`shared → features`** edge this step exists to remove. `partner-icons.ts`
  moved too; its 4 other importers (`for-firms-panel`, `corporate`, `illinois`, `bkn`) stay in partners
  and now use `@core/constants/partner-icons` — a legal direction.
  **The other five were clean**, including the two that looked riskiest:
  `webinar-registration-form`, buried 4 levels inside `features/offerings/webinar/shared/components/`,
  imports only `@shared/ui/*` and `@core/*` — nothing from offerings at all.
- **Both icon files went to `core/constants/`, not `shared/`.** They are plain SVG string constants with
  zero imports — §3 sends non-UI to `core/`, `core/constants/icon.ts` is already exactly this shape, and
  §3 gives `shared/` no `models/` folder at all.
- **No new boundary violation.** A repo-wide sweep finds only the **six pre-existing** `shared → features`
  edges documented since Phase 4 (`subscription-dialog` ×2, `ai-lab-agent-dialog` ×2, `utils.ts` ×2).
  None of the five promoted components appears. `core/` is clean.
- **The step's real risk did not materialise:** promoting 5 components out of lazy feature chunks into
  `shared/` could have pulled them into the initial bundle. **Initial is identical to baseline**
  (12 files / 501.5 KB raw / 101.5 KB gzip, +0.0%) and lazy chunks stay at **271**.
  SSR `/us/accounting/partners/cpacanada` → **200 with a real title**, which is the strongest evidence
  the 26 rewrites resolve at **runtime**, not just at typecheck.
- ⚠️ **FOUR units of work are now uncommitted in ONE entangled diff** (`uae-caira.ts` is touched by
  three of them), so splitting by path is no longer practical. **Recommend one commit for the lot** —
  the message in [phase-05-magnet-promotion](reports/phase-05-magnet-promotion.md) §5 covers everything
  in the tree.
- ⚠️ **Widest visual blast radius of the refactor so far** — `partner-content-list` renders on 11
  partner landing pages plus 5 other features. Gates prove compile/build/SSR, not render.
  **QA list in the report §4.**
- **Still owed by Phase 5:** 5 `pages/` folders (`ai-labs`, `faculty`, `how-to-claim-credly-badge`,
  `instructor-details`, `milesverse`); `app/auth/` → `features/auth/`; **13 internal `shared/` layers**
  (partners' still has 5 components + pages); `payment/shared/service` → `services/`; the 4 route-table
  extractions; the tracker merge; home/blog normalisation; then delete `app/pages/`.

- ⚠️ **Out-of-band feature work landed on `auth` (2026-09-23) — NOT a refactor step, uncommitted.**
  Learner sign-in now calls `auth-identify/` as soon as the identifier looks complete, as an **async
  validator on the identifier field** (`validateHttp`, 400 ms debounce), so the form itself gates the
  submit. A follow-up simplification pass then cut **171 lines** from the same files: `auth-facade.ts`
  638 → **514**, `login.html` 273 → **248**, `auth-session.ts` −22.
  Touched: `src/app/auth/shared/services/auth-facade.ts` (+ new `auth-facade.spec.ts`),
  `src/app/auth/shared/pages/login/login.html`, `src/app/core/models/auth.model.ts` (+ spec),
  `src/app/core/services/auth-session/auth-session.ts`, `docs/AUTH_API.md`.
  Gates green: lint, `build:prod`, **444 tests passing / 0 failing**.
  Three consequences for this refactor:
  1. **`src/app/auth/` is still unmoved** and is one of the folders Phase 5 has left. When it moves to
     `features/auth/`, the `import-auditor` must pick up the **new spec file** and the facade's new
     `@core/services/api-client` (`apiUrl`) and `@core/models/auth.model` imports.
  2. **Part B is largely pre-done for `features/auth`.** The facade is `@Service()`, the HTTP is
     signal-forms async validation, and the dead flow signals are already gone — which is most of what
     Phases 8 and 9 were going to do to it. Check before redoing it.
  3. **`auth-session.ts` lost `identify()` and `failureOf()`** (no callers once the form owns
     identify). Anything in a later phase that assumed `AuthSession.identify` exists needs rechecking.

## Part A tracker

| Phase | Scope           | Status | Report                                                                                                                                                                                                                                                                                                                                                                                                                          | Committed                                     |
| ----- | --------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| 0     | Audit & plan    | ✅     | [phase-00](reports/phase-00.md)                                                                                                                                                                                                                                                                                                                                                                                                 |                                               |
| 1     | Hygiene         | ✅     | [phase-01](reports/phase-01.md)                                                                                                                                                                                                                                                                                                                                                                                                 |                                               |
| 2     | Path aliases    | ✅     | [phase-02](reports/phase-02.md)                                                                                                                                                                                                                                                                                                                                                                                                 |                                               |
| 3     | Core            | ✅     | [phase-03](reports/phase-03.md)                                                                                                                                                                                                                                                                                                                                                                                                 |                                               |
| 4     | Shared & layout | ✅     | [phase-04](reports/phase-04.md)                                                                                                                                                                                                                                                                                                                                                                                                 |                                               |
| 5     | Features        | 🟡     | `page-not-found` ✅ [phase-05-page-not-found](reports/phase-05-page-not-found.md) · `legal`+`compliance` ✅ [phase-05-legal](reports/phase-05-legal.md) · `connect-us`+`Faq` ✅ [phase-05-connect-us](reports/phase-05-connect-us.md) · `uae-caira` ✅ [phase-05-uae-caira](reports/phase-05-uae-caira.md) · magnet promotion ✅ [phase-05-magnet-promotion](reports/phase-05-magnet-promotion.md) · 5 folders left in `pages/` | `1462e72`, `d12ae67`; **4 units uncommitted** |
| 6     | Admin           | ⬜     |                                                                                                                                                                                                                                                                                                                                                                                                                                 |                                               |
| 7     | Boundaries      | ⬜     |                                                                                                                                                                                                                                                                                                                                                                                                                                 |                                               |

## Part B tracker

Filled by Phase 0 from PLAN.md §13. Each cell holds a status. **Run features top to bottom** —
ordered smallest/lowest-risk first so the pattern is proven before it reaches `offerings`.
Names are the **post-Part-A** folder names (so `features/tracker` = today's caira-tracker + cpe-tracker).
`—` = not applicable to that phase.

| Feature / area                 | 8 Services | 9 Data | 10 UI | 11 Defer+Lazy  | 12 Tailwind |
| ------------------------------ | ---------- | ------ | ----- | -------------- | ----------- |
| `shared/ui` (primitives)       | —          | —      | ⬜    | —              | ⬜          |
| `features/blog`                | ⬜         | ⬜     | —     | ⬜             | ⬜          |
| `features/library`             | ⬜         | ⬜     | —     | ⬜             | ⬜          |
| `features/tracker` (caira+cpe) | ⬜         | ⬜     | —     | ⬜             | ⬜          |
| `features/auth`                | ⬜         | ⬜     | —     | ⬜             | ⬜          |
| `layout`                       | ⬜         | ⬜     | ⬜    | — (above fold) | ⬜          |
| `features/home`                | ⬜         | ⬜     | —     | ⬜             | ⬜          |
| `features/partners`            | ⬜         | ⬜     | —     | ⬜             | ⬜          |
| `features/payment`             | ⬜         | ⬜     | —     | ⬜             | ⬜          |
| `features/offerings`           | ⬜         | ⬜     | —     | ⬜             | ⬜          |
| `admin/*` (non-partner)        | ⬜         | ⬜     | —     | ⬜             | ⬜          |
| `admin/partner-platform(-v2)`  | ⬜         | ⬜     | —     | ⬜             | ⬜          |

Phase 11 also has two **one-off, first-session** items that are not per-feature:
enable `provideClientHydration(withIncrementalHydration())`, and move
`@import 'video.js/dist/video-js.css'` out of the global `styles.css`.
Phase 12's first session moves design tokens into `@theme`.

| Phase | Scope                         | Status | Report |
| ----- | ----------------------------- | ------ | ------ |
| 13    | Partner landing consolidation | ⏸      |        |
| 14    | Documentation                 | ⬜     |        |

## Decisions (owner: user)

- [x] **PLAN.md approved (Phase 0)** — approved by the user 2026-09-22.
- [x] Baseline recorded on untouched code — done 2026-09-22 (see the course-route caveat, Q8)
- [ ] Phase 6: v1 partner platform removal and v2 → `partner-platform` rename.
      **Phase 0 finding:** v1 is not removable as a unit. Its routed pages are dead (routes commented
      out in `admin.routes.ts`), but `partner-platform/shared/` is the live models/services layer for
      v2 (39 edges) and 6 other admin features (17 edges), and v2 imports 3 dialogs out of v1's dead
      pages. Phase 6 extracts that layer to `admin/core/` first; removal is a later decision.
- [ ] Phase 7: temporary warnings allowed for violations Part B will fix. **Expected list:** the
      `Utils` → shared-dialog imports that Phase 11 converts to dynamic `import()`.
- [ ] Phase 10: CDK usages. **Phase 0 finding: only 2 exist** — `CdkTrapFocus` (`layout/header`) and
      `BreakpointObserver` (`how-to-claim-credly-badge`). ng-primitives has no equivalent for either.
      **Recommendation: keep both**, migrate neither.
- [ ] Phase 13: consolidate partner landing pages (yes/no). **Phase 0 finding: strongly supported** —
      `ctcpa` vs `dscpa` differ by 8 hunks, all name/id swaps; 10 of 12 pages collapse into one
      config-driven page. See PLAN.md §10.
- [x] ~~Components with explicit `ChangeDetectionStrategy.Eager`~~ — **NOT APPLICABLE.** All 18
      explicit `changeDetection:` lines in `src/` are `OnPush`; there are zero `Eager` and zero
      `Default`. Closed by Phase 0.

New decisions raised by Phase 4 — **five PLAN.md Phase 4 rows were refused**, on the same test
Phase 3 used: execute the rows that clear a boundary violation, refuse the ones that create one.
Each needs your call before the phase that would own it.

- [ ] **`app-download-dialog` must NOT go to `features/home/`.** Its importers are `features/home`
      **and** `features/offerings` — two features, so §3's placement rule puts it in `shared/`.
      Recommendation: **strike the row**; it is shared UI.
- [ ] **`certificate-download-dialog` must NOT go to the tracker.** Importers are
      `features/cpe-tracker`, `features/library` and `Utils` — again two features.
      Recommendation: **strike the row.**
- [ ] **`subscription-dialog` → `features/payment/` is net zero, so it was not done.** Its only two
      importers are `Utils` and `EngagementDialog`, both of which now live in `shared/services/`.
      Moving the dialog would trade its 2 outbound `→ features/payment` edges for 2 new inbound
      `shared → features` edges, and the new ones are **static** where nothing improves.
      Recommendation: **defer to Phase 11**, which converts those two services' dialog imports to
      dynamic `import()` and unblocks the move properly.
- [ ] **`faq-content` → `shared/components/` was NOT done — PLAN.md §2 finding 2 is wrong about it.**
      The finding claims 16 importers "across offerings, blog, home, partners, uae-caira, connect-us
      and pages/shared", which is what justified promoting it to `shared/`. The real count is **5**,
      and every one is inside `pages/faq` (3) or `pages/shared` (2, the legal-doc/legal-section
      components). The 12 `features/* → pages/faq` edges PLAN.md §2 counts are imports of the routed
      **`pages/faq/faq`** page component, not of `faq-content`. Both actual consumers become Phase 5
      features (`features/faq`, `features/legal`). Recommendation: **strike the row** and let Phase 5
      decide, since after that phase the import may not cross a feature boundary at all.
- [ ] **`{cpe-tracker,caira-badge,badge}.model.ts` stay in `core/models/` — closing the Phase 3 row.**
      Phase 3 deferred these here on the theory that their dialogs were the blocker. They are not.
      `cpe-compliance-dialog` and `caira-badge-info-dialog` did move out this phase, and the models
      still cannot follow, because the real blockers are shared **cards** that §3 keeps in
      `shared/components/`: `cards/badge-{card,course-card,level-card}`, `cards/badge-hero-card`, and
      `caira-level-stack`. `shared → core` is legal and `shared → features` is not, so leaving the
      models in core is the boundary-correct outcome, not a compromise.
      Recommendation: **strike all three rows permanently** — they are core models.

Also settled by Phase 4, no action needed:

- [x] **`admin-rbac.model.ts` moved to `admin/core/`** as the Phase 3 row recommended, together with
      `edit-admin-roles-dialog`. 13 specifiers repointed; `core/models/admin/` no longer exists.
- [ ] **Correction to the Phase 3 claim that Phase 4 closes the last `core → features` edge.**
      It does not. Moving `utils.ts` into `shared/services/` **relabels** that edge `shared → features`,
      which §3 bans just as firmly. `utils.ts` still imports `PaymentFacade` statically (line 48) and
      `cart-drawer-dialog` dynamically (line 767). This is a **Phase 11** item — and note that
      promoting `PaymentFacade` into `core/` the way `FeatureFacade` was promoted in Phase 3 is the
      wrong fix here: it would pull the payment domain into core. **Confirm you are content for this
      edge to survive Part A.**

New decisions raised by Phase 3 — **PLAN.md §3's Phase 3 push-down table is partly wrong.**
The `import-auditor` sweep (35 files, 128 references) found that 6 of its rows would create a new
boundary violation instead of clearing one. I executed the rows that are safe and stopped on these.
Each needs your call before the phase that owns it:

- [ ] **`models/seo.models.ts` + `services/seo/supabase-seo.ts` must NOT go to `admin/seo/`.**
      PLAN.md sends them there, but `core/services/seo/seo-manager.ts` imports both, and
      `shared/utils/seo/course-seo-{config,setup}.ts` import `SeoConfig`. That is the SEO render path
      for **every page on the site**, not an admin path — the move would force `core → admin` and
      `shared → admin`. Recommendation: **strike these two rows from the plan**; they are core.
- [ ] **`models/form.model.ts` is not an offerings model.** PLAN.md sends it to `features/offerings/`,
      but it holds the generic `SelectOption` / `AutoCompleteOption` types used by
      `core/services/job-sectors`, `shared/components/ui/autocomplete`, `shared/components/enquiry-form`
      and `shared/components/dialog/firm-sponsorship-dialog`. Recommendation: **strike the row**; it is core.
- [ ] **`models/video-player.model.ts` + `constants/video-player.ts` cannot go to `features/offerings/`.**
      `shared/components/{video-js,audio-js}` both import **and re-export** `VideoState`/`PlayerMode`,
      so every consumer of those players would transitively depend on `features/offerings`. PROMPT.md §3
      explicitly lists `video-js` under `shared/components/`. Recommendation: **strike the rows**; they are core.
- [ ] **`models/{cpe-tracker,caira-badge,badge}.model.ts` are blocked by shared UI, not by core.**
      Six `shared/components` cards/dialogs (`badge-hero-card`, `badge-info-dialog`,
      `badge-claim-upsell-dialog`, `cpe-compliance-dialog`, `caira-level-stack`,
      `caira-badge-info-dialog`) and three `shared/components/cards/badge-*` import them directly.
      PLAN.md §3 **Phase 4** already moves feature-specific dialogs to their owners. Recommendation:
      **move these three models in Phase 4/5, after their dialogs move** — not in Phase 3.
- [ ] **`models/admin/admin-rbac.model.ts` is blocked the same way**, by
      `shared/components/dialog/edit-admin-roles-dialog`. PLAN.md §3 Phase 4 (line 216) already assigns
      that dialog to `admin/`. Recommendation: **move the model in Phase 4 with its dialog.**
      Consequence today: `core/models/admin/` holds exactly one file.
- [ ] **Phase 3 added a move PLAN.md does not list: `core/interceptors/admin-token/` → `admin/core/interceptors/`.**
      It was mandatory — that interceptor imports `AdminAuth`, `AuditLog` and `AuditCategory` directly,
      so moving those three to `admin/core/` without it would have inverted the layering to `core → admin`.
      PROMPT.md §3 lists interceptors under `admin/core/`, so this is the spec-correct home, but note it is
      still registered globally in `app.config.ts` (`withInterceptors`), which now imports from `@admin/`.
      **Confirm you are happy with the composition root reaching into `admin/`.**
- [ ] **Phase 3 deferred PLAN.md's faq / legal / milesverse / faculty / auth push-downs (12 files) to Phase 5.**
      Every consumer still lives in `src/app/pages/**` or `src/app/auth/`, and none of the destination
      feature folders exist yet. Doing them now would create five near-empty feature folders and split each
      feature across two phases. Recommendation: **accept** — Phase 5 moves each feature's pages and its
      constants/models/services in one session.

New decisions raised by Phase 0:

- [ ] Phase 5: dissolve `pages/` per PLAN.md §3 (the target structure has no top-level `pages/`;
      the destination of each page folder is the judgement call).
      **Still unticked, and `page-not-found` was run against it anyway — deliberately, for that
      feature only.** Its destination is not a judgement call: PROMPT.md §5 mandates
      `app/pages/*` → `features/` outright, and PLAN.md §3's Phase 5 table names this exact folder's
      destination in an already-approved plan. **Tick this before the features where the destination
      genuinely is a judgement call:** `faq` (and whether `faq-content` follows it), the three legal
      folders (`privacy-policy`, `terms-of-service`, `compliance` + `pages/shared/components/legal-*`),
      `instructor-details` vs `faculty` (PLAN.md sends them to two different features), and
      `pages/shared` itself.
- [x] **Phase 5 / `compliance` placement — REVERSED by the user 2026-09-22 and confirmed.**
      It lives at **`features/legal/pages/compliance/`**, per PLAN.md's grouping, not the separate
      `features/compliance/` that commit `d12ae67` created. The zero-shared-code finding still stands
      as a fact; it simply was not the deciding factor. Report corrected.
- [x] **Phase 5 / `legal` — SETTLED by the user 2026-09-22, all three calls. Executed; see
      [phase-05-legal](reports/phase-05-legal.md).** Outcome: (1) `compliance` → its **own**
      `features/compliance/`; (2) `faq-content` → `shared/components/` ✅ done; (3) `faq.model.ts` →
      `features/faq/models/` **accepted but deferred to the `faq` session** (`features/faq/` does not
      exist yet). ⚠️ **(2) and (3) are jointly inconsistent with §3** — see the `faq` item below.
      Original analysis kept for reference: 1. **Does `compliance` join `features/legal/`?** It shares **zero** code with the other two legal
      pages (verified: no shared component, model, constant or util). Options: (a) **own
      `features/compliance/`** — recommended, it is a security-documentation PDF viewer, not a legal
      document page; (b) `features/legal/pages/compliance/` per PLAN.md, accepting that the grouping
      is topical only. 2. **`faq-content` → `shared/components/faq-content/`?** Now **provable**: its consumers are
      `legal-doc` + `legal-section` (→ `features/legal`) and `faq-item` (→ `features/faq`) — two
      top-level features, so §3's placement rule promotes it to `shared/`. **Recommendation: yes.**
      This closes the Phase 4 deferral, whose premise ("the import may not cross a feature boundary
      after Phase 5") is now disproved. Note PLAN.md §2 finding 2's importer count (16) stays wrong;
      the real count is 3 non-spec. Right destination, wrong reasoning. 3. **`core/models/faq.model.ts` stays in `core/` — strike PLAN.md §3's Phase 3 row.**
      `richContent`/`FAQContent` feed **both** the legal constants and the faq components, so
      sending it to `features/faq/models/` would create `features/legal → features/faq`. Same class
      of error as the six Phase 3 rows already refused. **Recommendation: strike the row.**
      Consequence: `core/constants/{privacy-policy,terms-of-service}.ts` and
      `core/models/legal-doc.model.ts` may still move down into `features/legal/`, because
      `features/legal → @core/models/faq.model` is a legal direction.
- [x] **Phase 5 / `Faq` component — SETTLED 2026-09-22: option (a), promoted to
      `shared/components/faq/`. Executed; see [phase-05-connect-us](reports/phase-05-connect-us.md).**
      All 13 banned edges cleared outright. Knock-on: `pages/faq/` is empty and deleted, so there is
      **no `features/faq/`**. Original analysis kept for reference:
      **Blocks `connect-us`, and 13 import sites in total.** Raised 2026-09-22 by the `connect-us`
      audit. `Faq` is the routed `/faq` page **and** an embeddable section — `faq.ts:14` has a
      `standalone` input that exists purely for embedding. **13 files import it**, spanning **7
      top-level features**: `offerings` (6), `blog` (3), `home`, `partners`, plus `connect-us` and
      `uae-caira` which become features this phase. §3's two rules conflict here: the placement rule
      says promote to `shared/`; "routed components always live in `pages/`" says keep it in the
      feature. - **(a) Promote the whole component to `shared/components/faq/`.** A pure move, zero logic
      change, clears all 13 edges at once, and directly follows the placement rule — the same
      reasoning already approved for `faq-content`. Cost: a routed component lives in `shared/`, so
      `features.ts` would route `component: Faq` out of `@shared/`. **Recommended.** - **(b) Keep it in `features/faq/pages/faq/` and accept 13 `features → features` edges**, all
      covered by a Phase 7 temporary-warning exemption. Cheapest now, largest permanent residue, and
      it makes `features/faq` a dependency of most of the app. - **(c) Split it: a shared `faq` widget plus a thin routed page that wraps it.** The correct end
      state, but it is a **logic change**, which Part A forbids — so this is Part B (Phase 10/12)
      work and `connect-us` would stay blocked until then. Not recommended for now.
- [x] **Phase 5 / `faq` — DISSOLVED 2026-09-22, not resolved.** Promoting `Faq` to `shared/` empties
      `pages/faq/`, so **`features/faq/` does not exist** and the decision to move `faq.model.ts` there
      has no destination. `faq.model.ts` and `constants/faq.ts` stay in `core/` — the originally
      recommended outcome — and PLAN.md §3's Phase 3 row for them is permanently moot. Original:
      `shared/components/faq-content` imports `FAQContent` from `faq.model`. Moving `faq.model.ts` into
      `features/faq/models/` turns that into **`shared → features`**, which §3 bans outright — a
      stricter ban than the `features → features` edge decision 3 accepted, and not fixable by a move.
      Options: (a) **`import type` + a Phase 7 temporary-warning exemption** — the type is erased at
      runtime, so the edge is compile-time only (recommended, smallest change); (b) move **only**
      `FAQContent` / `richContent` into `shared/` and leave the rest of `faq.model.ts` in the feature;
      (c) revert decision 3 and keep `faq.model.ts` in `core/`. `faq.model.ts` is untouched today.
- [x] **Phase 5: the cross-feature "magnet" components — SETTLED 2026-09-22, user chose option (a):
      promote ALL SIX. Executed as SEVEN;** see
      [phase-05-magnet-promotion](reports/phase-05-magnet-promotion.md).
      5 components → `shared/components/`, and **both icon files → `core/constants/`** (plain SVG
      string constants, zero imports; §3 sends non-UI to `core/` and gives `shared/` no `models/`).
      The seventh, `partner-icons.ts`, was **not on the list but mandatory** — `partner-content-list`
      imported it, so promoting without it would have created the very `shared → features` edge the
      step removes. ⚠️ **Phase 0's separate `home/components/offerings/*` item (claimed 14 importers)
      is still open and still unverified — PLAN.md's counts have been wrong twice; re-derive it.**
      Original analysis kept for reference:
      Raised by Phase 0, **now blocking nothing but growing**: the `uae-caira` move (2026-09-22)
      converted 6 of these from unclassified `pages → features` edges into §3-banned
      `features → features` edges. PLAN.md §3 wants them resolved **in Phase 5**.
      **Counts re-derived from the import graph** (PLAN.md's have been wrong twice):

      | Component (current home) | own feature | external features | total |
                      | --- | --- | --- | --- |
                      | `partners/shared/components/partner-content-list` | 11 | offerings (3), home, library, uae-caira | **5** |
                      | `partners/shared/components/caira-steps-grid` | 1 | uae-caira | 2 |
                      | `partners/shared/components/caira-feature-grid` | 1 | uae-caira | 2 |
                      | `partners/shared/models/caira-step-icons` | 1 | uae-caira | 2 |
                      | `home/components/app-download` | 1 | uae-caira | 2 |
                      | `offerings/webinar/shared/components/webinar-registration-form` | 2 | uae-caira | 2 |

                      All six meet §3's "2+ top-level features → promote to `shared/`" bar, and Phase 4 set the
                      precedent by keeping `app-download-dialog` in `shared/` on exactly a 2-feature count.
                      **`partner-content-list` is the strong case at 5 features; the other five are 2-feature only
                      because `uae-caira` exists.** Note Phase 0's separate `home/components/offerings/*` item
                      (14 importers) is still open and unverified — treat its count with the same suspicion.
                      - **(a) Promote all six.** Follows §3 and PLAN.md literally; clears every edge. ~20 files across
                        partners (11 pages), offerings, home, library.
                      - **(b) Promote only `partner-content-list`**, leave the other five for Phase 7's
                        temporary-warning list. Smallest diff that fixes the real magnet. **Recommended.**
                      - **(c) Make `uae-caira` a sub-feature of `partners`.** Four of the six edges point into
                        `partners/shared/`, and `partners` already owns `caira-landing`, so this dissolves them
                        structurally. Contradicts PLAN.md's explicit `pages/uae-caira/ → features/uae-caira/` mapping,
                        so it needs an explicit override.

- [ ] Phase 11: how to fix the **839 KB gzip** `constant/location-min.ts` chunk — serve from the API
      (`v2/locations/autocomplete/` already exists) or `await import()` behind the country field.
      Biggest single perf win in the audit.

Decisions the user already settled in-session on 2026-09-22 (recorded, no action needed):

- [x] Trackers: **merge** `caira-tracker` + `cpe-tracker` → `features/tracker/{caira,cpe}/` in
      Phase 5, breaking their circular dependency.
- [x] Dead code: **list only, do not delete.** Consequence: `constant/location.ts` (25 MB,
      969,250 lines, zero importers) gets `git mv`'d in Phase 3 and stays in the ESLint ignore list.
- [x] `Utils` service: **move to `shared/services/utils.ts`** in Phase 4, not into `core/`.

## Findings from Phase 2 (logged, not fixed — PROMPT.md §7)

1. **Six component `.css` files use `@reference '../../../../styles/styles.css'`.** TS path aliases do
   not cover CSS — Tailwind resolves these on disk — so they break when those components move in
   **Phase 4**. PLAN.md does not cover them.
2. **Phase 3's reference-update checklist**, beyond the move itself. None are alias problems; all are
   hardcoded `src/app/shared/core/...` paths in the same blast radius:
   - `tsconfig.json` **and** `.storybook/tsconfig.json` — the `@core/*` target
   - `tsconfig.spec.json` — explicit `include` of `"src/app/shared/core/constant/icon.ts"`
   - `eslint.config.mjs` — `ignores` entries for `constant/location.ts` and `location-min.ts`
   - `angular.json` — the `fileReplacements` pair for
     `src/app/shared/core/interceptors/dev/dev-interceptors.ts`
   - `scripts/generate-version.mjs:42` — **writes** `src/app/shared/core/version/app-version.ts`
     (harness-owned; the user edits this one)

## Findings from spec repair (logged, not fixed — PROMPT.md §7)

These are environment and product observations the repair surfaced. None changed production code.

1. **`environment.production` is `false` during `ng test`.** The unit-test builder resolves
   `environment.development.ts` (UAT API URL) — confirmed by probe. Anything gated on
   `environment.production` is therefore **dead code under test by default**; `SalesforceLead.create`
   had three assertions passing vacuously against a method that had already returned. `vi.mock` is
   rejected outright for relative imports by the Angular unit-test system, so that spec flips the
   flag on the shared object and restores it in `afterAll`. Worth deciding whether the test target
   should point at the production configuration instead.
2. **Zoneless TestBed changes how host specs must be written.** Reassigning a plain field on a test
   host and calling `detectChanges()` no longer marks the view dirty, so the binding keeps its old
   value and the test asserts stale DOM without failing loudly. `section-nav.spec.ts` was doing
   exactly this. Test hosts need **signal** inputs. Any spec written before this is suspect.
3. **Two jsdom gaps are now polyfilled centrally in `src/test-setup.ts`:** no `IntersectionObserver`
   (constructed unguarded inside `afterNextRender` by section-nav, the three library pagination
   pages and the tracker badge lists — it threw on a timer and Vitest blamed unrelated suites), and
   no `Blob.prototype.text` (so `partnerBlobErrorMessage()` always fell into its catch and its test
   asserted the fallback string instead of the path it names).
4. **`video-list-wrapper`: the `videoList` default of `[]` is unreachable.** The template
   dereferences `activeVideo().videoSrc` with no guard, so rendering it with the default throws.
   Every real call site passes a list. Either the default should go or the template should guard.
5. **`badge-info-dialog` close button lost its specific accessible name.** It now renders the shared
   `<app-button variant="close">`, whose `aria-label` is hard-coded to `'Close'`; the spec was still
   looking for `'Close badge dialog'`. A generic "Close" is a small a11y regression on a dialog.
6. **`footer-overlay.isAllowedRoute` is NOT a product bug** — closes open question 5. The spec
   contradicted itself: one test asserted descendants match, the next asserted a `masterclass`
   descendant must not. Prefix matching is intended; `CONTINUE_CARD_ROUTES` + `isExactRoute` exist
   precisely to narrow the Continue Learning card alone. The expectation was corrected, not the code.
7. **`section-nav` docking in jsdom** — confirms open question 4. `getBoundingClientRect()` is
   all-zeros, so `rect.top (0) <= TRIGGER_OFFSET (80)` and the service always reports
   `showInHeader`, hiding the inline nav. The render tests opt out via `shareWithHeader`; the
   docking rule now has its own two tests instead of silently breaking the other six.
8. **`micro-learning-course.spec.ts` had a drifted hand-written facade stub** (missing
   `scrollToIdRequest`). Replaced with the real route-scoped facades behind the testing HTTP
   backend, which cannot go stale. Other specs with hand-written facade stubs carry the same risk.

## Findings from Phase 5 (logged, not fixed — PROMPT.md §7)

1. **`page-not-found.css` is 0 bytes but still carries a `styleUrl`.** Kept deliberately — deleting
   emptied CSS is PROMPT.md §4.6, a **Phase 12** item. Recorded so Phase 12 need not rediscover it.
2. **`page-not-found.html`'s "Return Home" control is a `<button role="link" routerLink="/">`.**
   `routerLink` on a `<button>` does navigate, but the element is not a real link: no `href`, no
   middle-click, no open-in-new-tab, no copy-link-address, and link semantics are asserted via `role`
   instead of being native. An `<a routerLink="/">` with the same classes would be correct.
   Pre-existing; untouched by this phase.

## Findings from the Phase 5 `legal` audit (logged, not fixed — PROMPT.md §7)

1. **`/compliance` is registered twice, at inconsistent scopes, and has no locale-scoped page route.**
   `app.routes.ts:25` mounts it **top-level** (`/compliance`, outside `:country/:profession_type`), and
   `features.ts:77` mounts it **only** under the mobile-webview subtree
   (`/:c/:p/mobile/compliance`). There is no `/:c/:p/compliance`. `footer.ts:168` links to the
   unscoped `/compliance`, and `legacy-redirects.spec.ts:188` asserts `/compliance` is deliberately not
   a legacy path — so the current shape looks intentional, but it is the only page in the app that
   works this way. Worth confirming before Phase 13/14 documents the route map.
2. **`pages/shared/` holds exactly two components** — `legal-doc` and `legal-section`, nothing else.
   No services, no barrel. Moving the legal feature therefore dissolves `pages/shared/` completely,
   which is one of the four folders the "dissolve `pages/`" decision names.
3. **Name collision already handled, do not "tidy" it:** `legal-section.ts` exports a **component**
   named `LegalSection`, while `@core/models/legal-doc.model.ts` exports an **interface** of the same
   name. The component file imports the interface aliased as `LegalSectionModel` (`legal-section.ts:2`).
   Renaming either during the move would be a logic-adjacent change Part A forbids.
4. **`legal-doc` has no spec and `legal-section` has no spec.** Both are untested; `privacy-policy`,
   `terms-of-service` and `compliance` each have one. Not a refactor blocker — noted because Part B
   Phase 9/10 will touch these.
5. **19 URL-string references to `privacy-policy` / `terms-of-service` / `compliance` exist and must
   not be touched by any move** — `src/seo.ts:77-78` (`STATIC_PATHS`, the prerender/sitemap list),
   `core/models/seo.constants.ts:95-96`, a seeded Supabase `seo_pages` row
   (`supabase/migrations/20260427000000_seo_pages.sql:157`), `legacy-redirects.ts:67-68` + its spec,
   `layout/footer/footer.ts:164,168,172`, `auth/.../login.ts:39-40`,
   `features/payment/.../invoice.ts:65`, `shared/components/enquiry-form/enquiry-form.html:44,48`,
   `pages/faculty/faculty.html:259,265`, `shared/components/consent-banner/consent-banner.html:20`
   (a hardcoded absolute `/us/accounting/privacy-policy`), and an inline `<a href="/privacy-policy">`
   inside `core/constants/terms-of-service.ts:26`. All key off the **URL**, not the file path.

## Findings from the Phase 5 `connect-us` audit (logged, not fixed — PROMPT.md §7)

1. **STATE.md carry-over (c) was wrong and is now corrected.** It claimed the `features/* → pages/faq`
   edges "clear when `pages/faq` becomes `features/faq`". They **relabel** to `features/* → features/faq`,
   which §3 bans identically — the same relabeling error as the Phase 3 `utils.ts` claim that Phase 4
   corrected. No edge is cleared by that move; only a decision on `Faq`'s home clears them.
2. **`connect-us` is almost nothing of its own.** The whole component is
   `<app-enquiry-form [enquiry_type]="…" /> <app-faq />` inside one container div, with a single
   `enquiryType` input. Once `Faq`'s home is settled the move is ~4 files and one import line.
3. **`connect-us.css` is empty (0 bytes) but still carries a `styleUrl`** — same Phase 12 item as
   `page-not-found.css`.
4. **`connect-us` has no story and no inbound import besides its own spec.** Its only registration is
   the lazy `loadComponent` at `features.ts:91-93` — it is the first Phase 5 feature that is genuinely
   lazy-loaded, unlike `page-not-found` and the legal pages, which are all eager.
5. **URL strings that must not change:** `seo.ts:79` (`STATIC_PATHS`), `legacy-redirects.ts:189`
   (`/accounting/help-desk` → `/{c}/{p}/connect-us`), `legacy-redirects.spec.ts:31,164`, and
   `features/payment/shared/pages/plan/plan.ts:285` which navigates to `/${country}/${profession}/connect-us`.
   All key off the URL segment, not the file path.
6. **False positive worth recording so nobody chases it:**
   `pages/how-to-claim-credly-badge/how-to-claim-credly-badge.html:36` contains
   `scrollToSection('connect-us')` inside a **commented-out** button — a dead in-page anchor id, not a
   route or a component reference.

## Open questions (from Claude)

0. **NEW (Phase 0) — bugs found, logged not fixed** (spec §7). Full list in
   `reports/phase-00.md` §3. The ones worth acting on outside the refactor:
   `--radius-4xl` is used at `styles.css:297,303,308` but never defined; the 8 `@ng-icons/*` packages
   are in `devDependencies` while production code imports them via `configuration/ng-icon.ts`;
   `lenis` is an unused dependency; `app.config.ts` wires a dev-only mock interceptor into the
   production root injector (Phase 1 fixes that one). Two AGENTS.md §9 statements are stale —
   `pnpm start` uses port **4101** not 4100, and the initial bundle is **501.9 KB**, not "near its
   2.00 MB budget". Phase 14 should correct both.
1. ~~**Branch.**~~ **RESOLVED 2026-09-22.** We are on `refactor/structure-1` with a clean working
   tree, so Phase 1 is free to move source once the test gate is green.
2. ~~**Storybook gate.**~~ **RESOLVED 2026-09-22.** User chose restore. `git checkout 8271fa4^ -- .storybook`
   brought back main/preview/manager/tsconfig×2/typings; `pnpm build-storybook` completes successfully.
   Config-only, nothing under `src/`.
3. ~~**Unit tests.**~~ **RESOLVED 2026-09-22** — `prompts/spec-repair.md` approved and executed;
   `ng test` is 0 failed and the full verifier is 8/8 green. Original analysis kept below for
   reference; the live group counts turned out to differ (see "Now").
   _Historical:_ Implementation prompt written to `prompts/spec-repair.md` (AGENTS.md §1 step 5).
   Root causes now traced; 58 of 79 are mechanical:
   - 16 × missing `provideRouter([])` / `ActivatedRoute`
   - 16 × `NG0950` required input never set (`setInput` + `__mocks__/content.mock.ts`)
   - 13 × route-scoped facades not in the spec's `providers` (`MasterclassFacade` 6, `ChapterFacade` 4,
     `FinalAssessmentFacade` 2, `Tracks` 1)
   - 7 × dialog specs missing their data/ref token
   - 3 × specs making **real network calls** to `https://uat-api.milescaira.com` (library badge/course/
     instructor) — need `provideHttpClientTesting()`
   - 2 × `IntersectionObserver` undefined → new `src/test-setup.ts` wired via `angular.json`
   - ~22 × genuine assertion failures, judged individually
4. ~~**`section-nav.spec.ts` (7 failures)**~~ **RESOLVED 2026-09-22.** Confirmed, plus a second
   cause the original diagnosis missed: zoneless change detection meant the host's plain `mode`
   field never reached the binding, so the sidenav tests were asserting against an inline render.
   See findings 2 and 7 above. Original note kept below. `shareWithHeader` defaults
   `true`; `afterNextRender` → `registerNav` → `checkNavPosition()` reads `getBoundingClientRect()`,
   all-zeros in jsdom, so `0 ≤ TRIGGER_OFFSET (80)` sets `showInHeader = true` and the inline
   `@if (!shareWithHeader() || !showInHeader())` renders nothing. Probe confirmed: same host renders
   full markup in `sidenav` mode, four empty `<!--container-->` comments in `inline`. Spec fix
   (`[shareWithHeader]="false"`), not a component change.
5. ~~**Suspected real bug**~~ **RESOLVED 2026-09-22 — it was NOT a product bug.** The spec
   contradicted itself; prefix matching is the intended design. See finding 6 above. No production
   fix was needed, so "0 failed" was reachable without you approving any. Original note below.
   "rejects routes outside the allowlist" expects `false`, gets `true`. That reads like a genuine
   product defect, not a stale spec. PROMPT.md §7 says log bugs, don't fix them — so I plan to log it
   and leave that test red. Same treatment for any other group-G failure that turns out to be a real
   defect, which means a literal "0 failed" may not be reachable without you approving production fixes.
6. **`src/app/shared/core/version/app-version.ts` is tracked but auto-generated** by
   `scripts/generate-version.mjs` on every build, so it dirties the working tree after each `pnpm build`
   and will pollute every refactor phase diff. Phase 1 hygiene candidate (gitignore + generate at build).
7. **`docs/refactor/README.md` does not exist** — referenced in the setup request but not in the repo.
8. **The recorded course-route SSR baseline captured DEGRADED SEO — needs your call.**
   `baseline/ssr.json` for `/us/accounting/masterclass/154/adulting-in-business` recorded
   `title: "Miles Masterclass"`, `canonical: ""`, `jsonLdBlocks: 0`. Live production for the same URL
   serves `<title>Adulting in Business | Miles Masterclass</title>`. So the local prod SSR could not
   resolve course 154's data (consistent with `https://api.milescaira.com/v2/library/` returning 404
   from this machine) and fell back to generic SEO. `textLength` was still 23907, so the page body
   rendered — only the course-specific SEO is missing.
   **Consequence:** that route currently pins the fallback state, so course-page SEO could regress
   during the refactor and the SSR gate would still report OK — exactly the regression that route was
   added to catch. The other three routes are fine (`/` 302 → `/us/accounting/home`; the partner page
   recorded a real canonical + 1 JSON-LD block; `/admin/login` is `RenderMode.Client`, textLength 72,
   as expected).
   Options: (a) accept it — the route still guards status, structure and text length, just not course
   SEO; (b) find why SSR can't reach the course API locally (auth header? egress? different host?) and
   re-record; (c) swap in a different route — though any dynamic course page hits the same wall.
   I cannot re-record (harness-owned); you run `--record-baseline` after deciding.

## Step log (latest first; keep the last 30 lines)

- 2026-09-23 **`auth` simplification pass (still outside the refactor, still uncommitted): −171 lines.**
  Replaced a hand-rolled identify chain — `validIdentifier` + `settledIdentifier` + `httpResource` +
  `currentIdentity` + an `effect`/`setTimeout`/`untracked` debounce — with one `validateHttp` async
  validator on the identifier field, which owns the debounce, the cancellation and the gating. Also
  deleted nine dead flow signals (`isIdentifying`, `canUsePassword`, `showPasswordFirst`, `otpMethod`,
  `maskedDestination`, `supportEmailParts`, `expectedDeliveryNote`, `isDevLogin`, `loginType`), three
  unread `AuthModel` fields, and two unused `AuthSession` members. One real bug found on the way:
  gating `when` on `state.invalid()` is a **computation cycle**, because the validator feeds that
  signal — it now gates on the value only. 444 tests green; the debounce assertion still fails if the
  debounce is set to 0, so it is not vacuous.

- 2026-09-23 **Feature work on `auth`, outside the refactor (uncommitted).** `auth-identify/` now
  fires on valid identifier input, debounced, and the login form is driven by the returned `methods`.
  Recorded here only because it changes files Phase 5 has yet to move — see the ⚠️ bullet under
  "Now". Three things worth carrying forward: the previous code matched `methods.includes('otp')`,
  which the API **never** sends (`email_otp` / `phone_otp` / `password` / `saml`), so every login was
  dead — fixed; `debounced()` from `@angular/core` was tried and **removed**, because it returns a
  lazy `Resource` that never activates when read only from inside another resource's request function
  (an `effect` replaced it); and password sign-in is **gated off**, because the backend proxies no
  password route — a one-route backend ask, written up in `docs/AUTH_API.md` §7.

- 2026-09-22 **Phase 5 magnet promotion ✅ — 16 files moved, 26 import sites, 8/8 GREEN, reviewer
  PASS with zero violations.** Resolves the cross-feature-edge decision the `uae-caira` move raised;
  user chose **option (a), all six**. Largest single step of Phase 5 so far.
  **Six became seven, and the audit is the only reason.** `partner-content-list.ts:4` imported
  `iconXPartner` from a sibling `partner-icons.ts` that was **not on the list** and would have stayed
  in `features/partners/shared/models/` — promoting the component without it would have created
  precisely the **`shared → features`** edge the step exists to eliminate. So `partner-icons.ts` moved
  too; its 4 other importers (`for-firms-panel`, `corporate`, `illinois`, `bkn`) stay in partners and
  now import `@core/constants/partner-icons`, a legal direction. `features/partners/shared/models/` is
  now **deleted**.
  **The two promotions that looked riskiest were the two cleanest.** `webinar-registration-form`, four
  levels deep inside `features/offerings/webinar/shared/components/`, imports only `@shared/ui/*` and
  `@core/*` — nothing from offerings. `app-download` imports only `@core/constants/icon` and
  `@core/models/footer.model`. Neither had any outbound feature dependency.
  **Both icon files → `core/constants/`, not `shared/`:** plain SVG string constants with zero imports
  and no Angular metadata, so §3's non-UI rule sends them to `core/`; `core/constants/icon.ts` is
  already exactly that shape, and §3 gives `shared/` no `models/` bucket to land in.
  **No new boundary violation:** a repo-wide sweep returns only the **six pre-existing**
  `shared → features` edges from Phase 4 (`subscription-dialog` ×2, `ai-lab-agent-dialog` ×2,
  `utils.ts` ×2); none of the five promoted components appears. `core/` clean.
  Gates: lint 5s, unit 16s, local 23s, prod 26s, storybook 23s, format 15s, bundle, ssr 4s.
  **The step's real risk — pulling 5 components out of lazy feature chunks into the eager initial
  bundle — did NOT materialise:** initial identical to baseline at 12 files / 501.5 KB raw / 101.5 KB
  gzip (**+0.0%**), lazy chunk count **271 unchanged**, largest lazy unchanged in size.
  `/us/accounting/partners/cpacanada` → **200 with a real populated title**; that page exercises the
  moved `partner-content-list` and both relocated icon constants, so it is the strongest evidence the
  26 rewrites resolve at **runtime**, not merely at typecheck. Reviewer verified 15 of 16 moves are
  `R100`, the sole exception `partner-content-list.ts` at `R096` whose only diff is the one import that
  had to change, and that **no selector and no template markup changed**.
  **Two items logged, not fixed:** `app-download.ts:32` has `getIcon(...): any` (AGENTS.md §8 bans
  `any`) — pre-existing, but now more visible in `shared/`; and `webinar-registration-form` is a
  **design-only shell** with inert `submit`/`verifyOtp`/`resendOtp`/`goToLogin`, which promoting to
  `shared/` makes look like a finished reusable primitive. That second one is the most likely to
  mislead someone later.
  ⚠️ **Four units of work now sit uncommitted in one entangled diff** (`uae-caira.ts` is touched by
  three of them). Splitting by path is no longer practical — **one commit recommended**, message in
  the report §5.
  ⚠️ **Widest visual blast radius yet:** `partner-content-list` renders on 11 partner landing pages
  plus home, library, and 3 offerings pages. QA list in the report §4.

- 2026-09-22 **Phase 5 `uae-caira` ✅ — 9 moved + 1 deleted, 8/8 GREEN, reviewer PASS with zero
  violations.** First feature with a real internal `shared/` layer to dissolve, and the first to delete
  a file. Layer gone: components up to `components/`, and the facade **flattened** from
  `shared/services/uae-caira-facade/uae-caira-facade.ts` to `services/uae-caira-facade.ts`, per §3's
  "services and models are flat files".
  **The duplicate pipe was merged, not moved.** `pages/uae-caira/shared/pipes/local-time-zone.pipe.ts`
  deleted — it differs from `shared/pipes/local-time-zone/local-time-zone.pipe.ts` by **one word in a
  doc comment**; same class, same `@Pipe({name:'localTimeZone'})`, byte-identical `transform`. Both
  consumers repointed. Plan-sanctioned (PLAN.md "duplicates to merge"; `phase-00.md:121-122` says
  "Merge in Phase 3/5"), and the reviewer independently confirmed both the equivalence and that it is
  **not** §7 feature-code deletion. Phase 3 could not do it because both consumers still lived in
  `pages/`.
  **Tiny move thanks to the audit: only 2 inbound references repo-wide** — `features.ts:4` (facade in
  `providers`) and `:39` (lazy `loadComponent`). Zero specs, zero stories, zero config hits. 5 internal
  relatives rewritten; the 6 cross-feature imports were already aliased and are byte-identical to the
  pre-move file, which the reviewer verified — **no new edge introduced.**
  **Nothing URL-facing changed and nothing could:** the route is `path: 'home'` gated by
  `uaeCairaMatchGuard` (`ae` + `accounting`), sharing the `home` string with the default `Home` and
  `CpaLanding`; the URL comes from `features.ts` + the guard, both outside the moved folder, and the
  guard has no diff.
  Gates: lint 5s, unit 16s, local 23s, prod 23s, storybook 20s, format 13s, bundle, ssr 3s. Initial
  bundle **+0.0%**, lazy chunk count **271 unchanged**. Lazy total moved −0.4 KB raw / −0.3 KB gzip,
  directionally consistent with the pipe dedup but **classified as noise by the verifier and not
  claimed as a saving** — the deleted pipe sat in a lazy chunk and the shared one replaces it there, so
  a near-wash is expected either way.
  ⚠️ **`/ae/accounting/home` is not in the SSR smoke list**, so the gate does not cover this feature's
  own route — green means the other four did not regress, nothing more. QA list in the report §4; the
  timezone label is the merged pipe's only visible output.
  🔶 **Left as a decision, deliberately:** the move reclassifies 6 pre-existing edges into §3-banned
  `features/uae-caira → features/{home,offerings,partners}`. Unlike `connect-us`'s `Faq` import there is
  **no build-level problem forcing a fix**, so they were reported rather than fixed. Exact importer
  counts re-derived and written into Decisions with three options; `partner-content-list` is the only
  5-feature magnet, the other five are 2-feature purely because `uae-caira` exists.
  ⚠️ **Committed nothing — two features now sit uncommitted in one entangled diff** (`uae-caira.ts` was
  already modified by the `connect-us` session's `Faq` rewrite). The user chose to continue past the
  commit gate; flagged at the time and again here.

- 2026-09-22 **Phase 5 `connect-us` + the `Faq` promotion ✅ — 12 R100 renames, 8/8 GREEN, reviewer
  PASS with zero violations, lazy chunk count held at 271.** Started ⏸ blocked: `connect-us` is a
  2-line composite (`<app-enquiry-form>` + `<app-faq />`) importing the **routed FAQ page** from
  `'../faq/faq'`, so moving it would have produced `'../../../../pages/faq/faq'` — a relative import
  crossing top-level folders, forbidden by §3, with **no `@pages/*` alias** (Phase 2 left `pages/`
  un-aliased by design). Creating a violation instead of clearing one is the Phase 3/4 refusal test, so
  nothing moved until the user decided.
  **⚠️ Corrected a wrong claim this file had carried since Phase 4:** the `features/* → pages/faq`
  edges do **not** "clear when `pages/faq` becomes `features/faq`" — they **relabel** to
  `features/* → features/faq`, banned identically. Exactly the Phase 3 `utils.ts` error Phase 4 had to
  correct. Same mistake, two different files, twice — **worth watching for a third.**
  Counts re-derived from the import graph rather than trusted from PLAN.md (wrong twice already):
  **13 importers of the routed `Faq` across 7 top-level features** — offerings 6, blog 3, home,
  partners, plus `connect-us` and `uae-caira` — and `features.ts:6`, the legitimate route registration.
  Root cause: `faq.ts:14`'s `standalone = input<boolean>(true)`, an input that exists **only** so the
  routed page can be embedded as a widget. User chose §3's placement rule over §3's "routed components
  live in `pages/`" → **`shared/components/faq/`**, with `faq-item` beside it. The audit had confirmed
  it was safe: neither component imports anything from `features/*` or `pages/*`, so no
  `shared → features` edge is created, and `AccordionMode` is consumed only by its own sibling.
  **`pages/faq/` is now deleted — fully emptied** (`faq-content` had already left in the `legal`
  session). **Consequence: there is no `features/faq/` and never will be**, which **dissolves** the
  open `shared → features` item — the `faq.model.ts → features/faq/models/` decision has no
  destination, so `faq.model.ts` and `constants/faq.ts` stay in `core/`, the originally recommended
  outcome. Nothing outstanding.
  One Prettier reflow: the `@features/…` alias pushed `connect-us`'s `loadComponent` line past the
  100-char `printWidth` — same mechanism as Phases 3 and 4, and again only that one file was formatted.
  `connect-us` stays **lazy**, the first Phase 5 feature that genuinely is.
  Also handled: the user's out-of-band `compliance` move to `features/legal/pages/compliance/` (plain
  `mv`, not `git mv`) — left alone, verified byte-identical to `HEAD`, confirmed intentional, and the
  `phase-05-legal` report corrected in five places. It rides in this commit as delete + untracked.
  Gates: lint 5s, unit 16s, local 23s, prod 29s, storybook 23s, format 14s, bundle, ssr 4s. Bundle
  **+0.0%**, and the phase's specific risk — that promoting a component out of a lazy route tree
  reshuffles chunks — did **not** materialise: 271 → 271, largest lazy unchanged in size and rank, only
  its content hash moved. Reviewer separately confirmed zero relative `Faq` crossings remain, both
  route registrations survive, and the `faq` / `mobile/faq` / `connect-us` path strings are
  byte-unchanged. **`src/app/pages/` is down to 7 folders.**
  ⚠️ **First session with real visual blast radius — `Faq` renders on 13 pages.** The gates prove it
  compiles and SSRs, not that it renders. QA list in the report §4.

- 2026-09-22 **Phase 5 `connect-us` ⏸ BLOCKED — read-only audit only, ZERO source changes.**
  Preconditions passed (tree clean, `legal` committed at `d12ae67`, destination spec-named in the same
  PLAN.md row as `page-not-found`), but the `import-auditor` found that moving it would **create** a §3
  violation rather than clear one — the test Phases 3 and 4 used to refuse PLAN.md rows.
  **`connect-us` is a 2-line composite: `<app-enquiry-form>` + `<app-faq />`.** It imports `Faq`, the
  **routed FAQ page**, from `'../faq/faq'`. Moving it to `features/connect-us/pages/connect-us/` while
  `Faq` stays at `pages/faq/` turns that into `'../../../../pages/faq/faq'` — a relative import crossing
  top-level folders, forbidden by §3, and **no `@pages/*` alias exists** (Phase 2 left `pages/`
  un-aliased by design).
  **⚠️ Corrected a wrong claim this file has been carrying: carry-over (c).** It said the
  `features/* → pages/faq` edges "clear when `pages/faq` becomes `features/faq`". **They do not — they
  relabel to `features/* → features/faq`, banned identically.** Precisely the Phase 3 `utils.ts`
  error ("closes the last `core → features` edge" → actually relabels it `shared → features`) that
  Phase 4 had to correct. Counts re-derived from the import graph rather than trusted from PLAN.md,
  whose figures have now been wrong twice: **13 files import the routed `Faq`**, spanning **7
  top-level features** — offerings (6), blog (3), home, partners, plus `connect-us` and `uae-caira`
  which become features this phase — plus `features.ts:6`, the legitimate route registration.
  **Root cause: `Faq` is deliberately dual-purpose.** `faq.ts:14` declares
  `standalone = input<boolean>(true)`, an input that exists only so the routed page can be embedded as
  a section widget. §3's placement rule (2+ features → promote to `shared/`) and §3's "routed
  components always live in `pages/`" point in opposite directions for this one component, so it is a
  user decision, not a judgement I should make silently. Three options recorded under Decisions;
  **(a) promote to `shared/components/faq/`** is recommended — a pure move, zero logic change, clears
  all 13 edges, and the same reasoning the user already approved for `faq-content`.
  `connect-us` is a ~4-file move the moment that lands.

- 2026-09-22 **Phase 5 `legal` + `compliance` ✅ — 25 renames, 3 decisions settled, 8/8 GREEN,
  reviewer PASS with zero violations.** Started ⏸ blocked (the `"dissolve pages/"` decision was
  unticked and `legal` is one of the three features reserved for it), so a **read-only**
  `import-auditor` sweep over 8 symbols / **74 reference lines** ran before anything moved. It
  contradicted PLAN.md twice, and the user settled all three calls on that evidence.
  **(1) `compliance` shares ZERO code** with privacy-policy/terms-of-service — only `@angular/core`,
  `@angular/platform-browser`, `@env/environment`, its own local `ComplianceDocument` interface, and it
  never renders `<app-legal-doc>`. PLAN.md grouped it topically. → its **own `features/compliance/`**.
  **(2) `legal-doc.ts:18` + `legal-section.ts:3` both imported `faq-content`** out of `pages/faq/`, so
  `features/legal → features/faq`. Its 3 non-spec consumers span **two** top-level features → §3 forces
  `shared/components/`. **Closes the Phase 4 deferral, whose premise ("after Phase 5 the import may not
  cross a feature boundary at all") is disproved.** PLAN.md §2 finding 2: right destination, wrong
  reasoning — 16 claimed importers, 3 real.
  **(3) `faq.model.ts` → `features/faq/models/`: user chose PLAN.md's row over my recommendation to
  strike it.** Recorded, **not executed** — `features/faq/` does not exist, and moving into a
  non-existent feature folder is the exact error Phase 3 avoided. It is the `faq` session's job.
  **⚠️ Decisions 2 and 3 are jointly inconsistent with §3, flagged to the user BEFORE building:**
  `shared/components/faq-content` needs `FAQContent`, so once `faq.model` lands in `features/faq/` the
  edge becomes **`shared → features`** — a harder ban than the `features → features` edge decision 3
  accepted, and unfixable by a move. Three options recorded under Decisions.
  Steps: faq-content promoted (4 files, 3 refs); `features/legal/{pages,components,constants,models}/`
  built from 4 sources (17 files) **dissolving `pages/shared/` entirely** — it held nothing but
  legal-doc and legal-section, so the emptied dirs were `rmdir`'d; compliance moved (4 files).
  Import fix-ups worth noting: the two legal constants' `'../models/faq.model'` and
  `'../models/route-params.model'` had to become `@core/...` (those models did **not** move), while
  `'../models/legal-doc.model'` stayed valid **by accident of depth** — `constants/` and `models/` are
  siblings in the new feature, so the same string resolves to the right file. Intra-feature imports
  were left relative per §3; everything crossing a top-level folder aliased.
  Gates: lint 5s, unit 19s, local 27s, prod 33s, storybook 23s, format 15s, bundle, ssr 4s.
  **Bundle byte-identical for the third phase running** — 501.5 KB raw / 101.5 KB gzip (+0.0%), 271
  lazy chunks, largest 3418.2/839.1 gz. `reviewer` verified via `git diff -M100% --stat` that all 25
  moves are **0-insertion / 0-deletion**, that no `features → features` / `shared → features` /
  `core → features` edge exists, that the `LegalSection` component vs `LegalSectionModel` interface
  aliasing survived untouched, and — the check that mattered most — that **every route path string is
  unchanged**, so `seo.ts` `STATIC_PATHS`, the legacy redirects and the footer links are unaffected.
  `src/app/pages/` is down to **9** folders. Build churn restored with `git checkout HEAD --`.

- 2026-09-22 **Phase 5 `legal` ⏸ BLOCKED — read-only audit only, ZERO source changes.** Working tree
  was clean and `page-not-found` committed (`1462e72`), so the only failing precondition is the
  unticked "dissolve `pages/`" decision — and `legal` is one of the three features the previous session
  explicitly reserved for it. Rather than stop empty-handed I ran the `import-auditor` over all 8
  candidate symbols (the 3 pages, `legal-doc`, `legal-section`, both `resolve*` constants and
  `legal-doc.model.ts`): **74 distinct reference lines**, so the decision can now be made on evidence
  instead of on PLAN.md's grouping.
  **Three findings, and two of them contradict PLAN.md.** (a) **`compliance` shares zero code** with
  privacy-policy/terms-of-service — its only imports are `@angular/core`,
  `@angular/platform-browser`, `@env/environment`; it has its own local `ComplianceDocument` interface
  and never renders `<app-legal-doc>`. PLAN.md groups it under `features/legal/` topically, not
  structurally. (b) **`legal-doc.ts:18` and `legal-section.ts:3` both import `faq-content`**, so
  `features/legal → features/faq` — banned by §3. `faq-content`'s three non-spec consumers are those
  two plus `faq-item`, i.e. **two top-level features**, so §3 forces it into `shared/components/`.
  **This disproves the Phase 4 deferral's premise** ("after Phase 5 the import may not cross a feature
  boundary at all" — it does). PLAN.md §2 finding 2 lands on the right destination via a wrong
  importer count (16 claimed, 3 real). (c) **`core/models/faq.model.ts` must stay in `core/`** —
  `richContent`/`FAQContent` feed the two legal constants and `legal-doc.model.ts` (→ legal) **and**
  faq-content/faq-item (→ faq), so PLAN.md §3's Phase 3 row sending it to `features/faq/models/` is
  wrong, the same class of error as the six Phase 3 rows already refused.
  **Why I did not just do `legal` and defer the rest:** findings (b) and (c) are decisions about
  **faq's** files. Moving legal under a guess would strand `features/faq` and force a redo.
  Five further observations logged above, including that `pages/shared/` holds _only_ these two
  components (so legal's move dissolves it entirely), that `/compliance` is mounted top-level **and**
  mobile-only with no locale-scoped route, and the 19 URL strings that must not be touched.

- 2026-09-22 **Phase 5 `page-not-found` ✅ — 4 files to `features/`, 1 import, 8/8 GREEN, reviewer
  PASS with zero findings.** The smallest feature in the phase, run first on purpose to prove the
  Phase 5 pattern before it reaches a route table or a `shared/` layer. `git mv
pages/page-not-found` → `features/page-not-found/pages/page-not-found` — all 4 files recorded as
  renames at **100% similarity**, no content hunks anywhere. The single reference,
  `app.routes.ts:5`, went from the relative `'./pages/page-not-found/page-not-found'` to
  `'@features/page-not-found/pages/page-not-found/page-not-found'` (§3 requires an alias once the
  import crosses a top-level folder).
  **The `import-auditor` is again what kept this to one line.** 0 lazy route references, 0 usages of
  the `app-page-not-found` selector, 0 stories, 0 hits across `angular.json`, `tsconfig*.json`,
  `.storybook/*`, `eslint.config.mjs`, `vercel.json`; and all 4 of the component's own imports are
  **package** imports, so nothing broke in the outbound direction either. It also pinned down the
  three `page-not-found` mentions that are **URL strings, not file paths** and must not move —
  `app.routes.ts` (eager `component:` at `page-not-found` **and** `maintenance`, plus
  `{ path: '**', redirectTo: 'page-not-found' }`), `analytics.ts:79` `NON_LOCALE_PREFIXES`, and
  `seo-route-slug.ts` `NON_LOCALE_ROOTS`.
  **Three scope calls, all upheld by the reviewer.** (a) Nested under `pages/` rather than flattened —
  §3 says routed components _always_ live in `pages/`, and PLAN.md's `pages/x/ → features/x/` rows are
  abbreviated shorthand (the `faq` row reads the same way and unquestionably keeps `faq/pages/faq`);
  "flatten single-file folders" governs services/models, which §3 makes flat files, not component
  folders. (b) **No routes file** — the component is eager at two paths and is not one of the four
  route tables §5 extracts; adding one would change loading behaviour. (c) Empty 0-byte
  `page-not-found.css` kept — §4.6 is Phase 12.
  Gates: lint 5s, unit 16s, local build 22s, prod build 23s, storybook 19s, format 13s, bundle, ssr 4s.
  **Bundle byte-identical** — initial 12 files / 501.5 KB raw / 101.5 KB gzip (+0.0%), 271 lazy
  chunks, largest lazy 3418.2 KB / 839.1 gz — every figure matching Phase 4, with the snapshot folder
  verified untouched. SSR OK on all 4 routes.
  **Two traps avoided worth recording.** The stale `.cache/last-verify.json` from Phase 4 reports the
  _identical_ 8/8 table (6/15/22/24/19/13/0/4s), so reading that file without checking its mtime would
  have "confirmed" a run that never happened — the fresh run is `at 2026-09-22T16:17:03Z`. And the
  harness guard rejects any command whose **text** contains `verify.mjs`'s path or the baseline flag —
  including a heredoc merely _quoting_ them in prose, which is how the report had to be written with
  the Write tool instead of `cat`.
  Build churn (`public/version.json`, `core/version/app-version.ts`) was regenerated by the verifier's
  builds and **restored with `git checkout HEAD --`, which the harness allowed this time** — so unlike
  Phase 4 the diff needs no manual cleanup before committing.
  ⚠️ Ran against the still-unticked "dissolve `pages/`" decision, deliberately and for this feature
  only — see Decisions for which features must wait for the tick.

- 2026-09-22 **Phase 4 steps 5+6 ✅ — `Utils`/`EngagementDialog` to `shared/services/`, 4 layouts to
  `layout/`. Full gate run 8/8 GREEN, bundle byte-identical.** `core → shared` finishes at **2 of the
  original 25** (`notification → @shared/ui/toast`, `update-checker → version-update-dialog`, the latter
  already a dynamic import) and `core → features|admin|layout` at **0**. Step 5 aliased 15 intra-core
  relatives in the two moved files and repointed 64 inbound specifiers. Step 6 needed only **3** edits —
  no lazy route string points at any layout; all four are eager `component:`/static imports, and
  `main-layout`/`blog-layout` already reached header and footer through `@layout/*`.
  **Format check was red again, same mechanism as Phase 3 but the opposite direction** — 2 files
  (`admin-users.ts`, `firm-form-dialog.ts`) whose `checkbox-list` import _shrank_ below the 100-char
  `printWidth` once `@shared/components/ui/` became `@shared/ui/`, so Prettier wanted it collapsed onto
  one line. Fixed on those 2 files only, never `format:fix` across `src/`.
  Gates: lint 6s, unit 15s, local build 22s, prod build 24s, storybook 19s, format 13s, bundle, ssr 4s.
  **The bundle gate is meaningful this time** (no record flag, verified: `git status` on the snapshot
  folder is empty): initial 12 files / 501.5 KB raw / 101.5 KB gzip, 271 lazy chunks, largest lazy
  3418.2 KB / 839.1 gz — every figure identical. 204 renames + 178 modified files and not one byte of
  bundle drift. SSR smoke OK on all 4 routes.
  **`reviewer` returned FAIL on two bookkeeping items, both now closed, neither a code defect:** the five
  refused PLAN.md rows were written into the session plan but never into this file's Decisions (added
  above — `faq-content` was the one it flagged as "undone and undocumented"; it is a deliberate refusal,
  because PLAN.md §2 finding 2's "16 importers" is wrong and the true count is 5), and steps 5–6 were
  complete in the tree but still ⬜ here. It also **corrected my boundary count**: `shared → features|pages`
  is **3 files / 6 import lines**, not 4 — I had counted before step 5 moved `utils.ts` into `shared/`.
  One stale doc path it found is fixed: `AGENTS.md:46` said `shared/components/ui`.
  Reviewer confirmed **zero logic change** across all 382 touched files — every hunk is an import
  specifier, dynamic `import()`, `@reference` path or doc comment; no `changeDetection`, template,
  selector, style or behaviour edit, and no disable/ignore/skip pragma introduced.

- 2026-09-22 **Phase 4 steps 3+4 ✅ — 14 dialogs pushed to owners, pipes and helpers swapped; gates green.**
  `shared → features|admin|pages` drops **16 → 4**, `core → shared` **25 → 14**. The 4 left are exactly the
  two deferred items (`subscription-dialog`'s 2 payment imports, `ai-lab-agent-dialog`'s 2 into `pages/ai-labs`).
  35 inbound specifiers rewritten across 27 files; 25 outbound `'../../ui/…'` relatives in the moved dialogs
  converted to `@shared/ui/…` (a relative path would have resolved to `features/<f>/ui/…` and broken).
  `admin-rbac.model.ts` moved to `admin/core/` with `edit-admin-roles-dialog`, 13 specifiers repointed —
  **`core/models/admin/` is now gone**, closing the Phase 3 note that it held exactly one file.
  Step 4: 3 pipes → `shared/pipes/` (no core consumer; all 14 importers are UI) and 5 pure helpers the other
  way → `core/utils/`, clearing all 8 `core → @shared/utils` edges. `total-cpe-credits.pipe.ts` needed its
  `'../../models/course.model'` aliased to `@core/…` on arrival.
  **Correction to this file's own Phase 3 claim, and to my Phase 4 plan.** Phase 3 recorded that moving
  `utils.ts` to `shared/services/` "closes" the last `core → features` edge. It does not — it **relabels** it
  `shared → features`, which the spec bans just as firmly. `utils.ts` imports `PaymentFacade` statically
  (line 48) and `cart-drawer-dialog` lazily (line 767, now pointing at `@features/payment/dialogs/`), and
  step 5 carries both into `shared/`. Moving the dialog still nets −1 (it cleared 2 of its own outbound
  payment edges), but the edge itself survives Phase 4 and belongs to **Phase 11**, when `Utils`' dialog
  coupling becomes dynamic. Promoting `PaymentFacade` to `core/` the way `FeatureFacade` was promoted is
  **not** the answer — it would drag the payment domain into core.

- 2026-09-22 **Phase 4 steps 1+2 ✅ — `ui/` and `dialog/` out of `shared/components/`; typecheck ×2 + lint green.**
  Run as ONE step, deliberately: 59 imports inside `dialog/*` point at `../../ui/...`, and those strings
  stay byte-for-byte valid only because both folders lose the same `components/` segment. Splitting the
  two moves would have broken all 59 in the intermediate state. 176 files, every one recorded as a rename.
  **The `import-auditor` is what made this safe, and it changed the plan.** My own grep found the 291
  alias specifiers (224 `ui` + 67 `dialog`) and concluded the rest was config — wrong. The auditor found
  **37 further relative imports that break**, none of which contain the literal `shared/components` and so
  matched no path-based grep: 9 from `dialogs/` out to non-moving siblings (`video-js`, `miles-slug`,
  `course-about`, `categories-list`, `cards/badge-hero-card`) which need a _deeper_ `../../components/…`;
  14 the other way, from `cards/`, `slider/`, `carousel/`, `enquiry-form/`, `caira-level-stack/` into
  `ui/` and `dialogs/`; and 14 into `shared/utils/` which need a _shallower_ path. Two directions of
  breakage inside the same files — `webinar-details-dialog.ts` has a surviving `../../ui/…` two lines
  above three that break. Fixed per-import, not per-file.
  Two traps worth recording: `toast.ts:6` used `'../../../../shared/utils/cn'` — an up-and-back-into-shared
  detour that worked only by depth accident, so the correct fix is `'../../utils/cn'`, not one fewer `../`;
  and `core/services/{utils,engagement-dialog,update-checker}` all import `'../dialog/dialog'`, which is
  the **`Dialog` overlay service** in `core/services/dialog/`, not this folder — excluded as a false positive.
  4 Tailwind `@reference` paths corrected 5 `../` → 4 (`course-info`, `webinar-details-dialog`,
  `ai-lab-agent-dialog` `.css`, and the inline block in `ui/progress/progress.ts:72`); all 8 `@reference`
  targets in `src/` were then resolved against the filesystem and every one lands on `src/styles/styles.css`.
  One stale doc-comment path fixed (`core/models/aria.model.ts:3`). Repo-wide grep for the old paths over
  `src`, `.storybook`, `angular.json`, `tsconfig*.json` and `eslint.config.mjs` returns **NONE**.

- 2026-09-22 **Phase 3 steps 3–4 ✅ — 17 files pushed out of core; 6 PLAN.md push-downs refused.**
  The `import-auditor` sweep over all 35 candidate files (128 referencing file:line entries) is what
  drove this: **most of PLAN.md §3's Phase 3 push-down table would have created new boundary
  violations rather than cleared them.** Moved to `admin/core/` (flat files, matching admin's existing
  convention): `admin-auth.model.ts`, `audit-log.model.ts`, `admin-auth.ts`, `audit-log.ts` — **plus
  `interceptors/admin-token-interceptor.ts`, which PLAN.md does not list.** That interceptor is the
  single root cause tying all three admin files to `core/`: it imports `AdminAuth`, `AuditLog` and
  `AuditCategory` directly, so moving them without it would have inverted the layering into
  `core → admin`. PROMPT.md §3 puts admin interceptors in `admin/core/` anyway, so it moved too;
  `app.config.ts` now wires it from `@admin/core/interceptors/…`. Also moved `seo-csv.ts` + spec →
  `admin/seo/utils/` (admin-only, clean). Then payment (`constants/payment.ts`,
  `constants/location-min.ts` + its `eslint.config.mjs` ignore, `guards/payment.guard.ts` — that guard
  already imported `@features/payment/…`, so the move **fixes** a live `core → features` violation),
  offerings (`assessment.model.ts`, `feedback-model.ts`, `micro-learning-course.model.ts`,
  `app-download-prompt.ts` + spec) and `cpe-credit.model.ts` + spec → `features/cpe-tracker/models/`
  (**not** PLAN.md's `features/tracker/`, which Phase 5 creates by merging the two trackers — moving
  into a folder that does not exist yet would have made every importer a cross-feature import).
  Typecheck ×2 + lint green after each step.
- 2026-09-22 **Phase 3 step 2 ✅ — the two shared facades merged into `core/services/`.**
  `git mv` of `features/shared/services/{feature-facade,section-filters-facade}` →
  `core/services/` (4 files, renames), 16 alias specifiers rewritten
  `@features/shared/services/...` → `@core/services/...`. Both facades were already
  **`@core/*`-only in their own imports** — zero feature dependencies — so this is a pure move that
  clears PLAN.md §2 finding 1's 15-importer violation with no logic change. `features/shared/` now
  holds only `services/tracks/`, which stays for Phase 5 (its 2 importers are `features/features.ts`
  and a `cpa-landing` component, both inside `features/`). Typecheck ×2 + lint green.
- 2026-09-22 **Phase 3 step 1 ✅ — core moved, aliases flipped, typecheck + lint green.**
  `git mv src/app/shared/core src/app/core` (126 files, all recorded as renames) and
  `git mv core/constant core/constants`. `@core/*` retargeted in `tsconfig.json` **and**
  `.storybook/tsconfig.json`. Five hardcoded-path consumers repointed (`tsconfig.spec.json` icon
  include, `eslint.config.mjs` ×2 `location*.ts` ignores, `angular.json` ×2 `fileReplacements`,
  `scripts/generate-version.mjs:42` write target) plus the three `src/*.ts` relatives
  (`legacy-redirects.ts`, `seo.ts`, `server.ts`) and one comment path in
  `testing/partner-mock/dev-interceptors.ts`. 35 `@core/constant/` specifiers across 33 files and
  7 intra-core `../constant/` relatives rewritten to `constants/`. A repo-wide grep for the old
  path over `src`, `.storybook`, `scripts`, `angular.json`, `tsconfig*.json` and `eslint.config.mjs`
  returns **NONE**. Gates: `tsc -p tsconfig.app.json` clean, `tsc -p tsconfig.spec.json` clean,
  `pnpm lint` "All files pass linting".
  **⚠️ Note for the user:** the harness Bash guard rejects every command whose text contains the
  verify script's path, so Claude cannot run the per-step `--quick` wrapper at all. Each step was
  gated by running its two underlying checks (typecheck + lint) directly instead. End-of-phase
  verification still goes through the `verifier` subagent, which is unaffected.

- 2026-09-22 **Phase 2 ✅ complete — aliases added and 1,464 imports converted; 8/8 green.**
  `tsconfig.json` gets the 7 aliases (no `baseUrl`, `./` targets, `moduleResolution` untouched);
  380 `.ts` files get alias specifiers. **Zero moves, zero logic change**, and the bundle report
  proves it — initial 501.5 KB raw / 101.5 KB gzip (−0.1% = compression noise), 271 lazy chunks,
  both unchanged. Four batches, each gated on `--quick` **plus** a `tsconfig.spec.json` typecheck the
  harness does not run; a `--dry` re-run of all four afterwards reports 0 remaining. **The find that
  justified the pilot step: Storybook does not inherit root `paths`** — `tsconfig-paths-webpack-plugin`
  rewrites only `baseUrl` across `extends` and anchors to the config it loads, so `./src/...` becomes
  `.storybook/src/...` and misses; `.storybook/tsconfig.json` now re-declares the block with
  `../src/...`. Because `--quick` typechecks only `tsconfig.app.json`, that failure would otherwise
  have surfaced only after 1,464 lines were already rewritten. Two deviations from PLAN.md §3, both
  user-approved beforehand: the codemod is in scope at all (the literal spec bullet is config-only,
  but the collapse of the Phase 3–6 diff is the whole reason this phase runs first), and `@core/*`
  points at today's `shared/core` rather than the not-yet-existing `src/app/core`. PLAN.md's
  "add `eslint-import-resolver-typescript`" was checked and **rejected for this phase** — nothing in
  the flat config resolves a specifier, so it belongs to Phase 7. 38 imports into
  `pages/`/`auth/`/`configuration/`/app-root stay relative by design. `fileReplacements` re-proven
  through `@env/*` with the Phase 1 needles.
- 2026-09-22 **Phase 1 steps 1–4 executed; closing gates in flight.** All four `--quick` checks green
  along the way. 15 `git mv`s, all recorded as **renames**. Headline: the Partner Platform mock no
  longer reaches production — `--must-not-contain "ACMEALLI-55AA11BB"` and `"partnerMock"` both pass
  where both previously matched, the server bundle greps clean by hand, and a `local` build still
  carries the fixtures so the dev flow is unbroken. 274 → 271 lazy chunks, −21 KB raw, initial
  −0.1% gzip. Two things the approved plan missed, both caught by the per-step typecheck: the moved
  mock files' **own** imports needed repointing (`../../core/models/…` → `../../shared/core/…`), and
  the two hero specs spec-repair added reach `content.mock` through a `shared/components/` prefix, so
  they fell outside the pattern that rewrote the other 26 import lines. Started with spec-repair
  still uncommitted (user instruction), so this diff sits on top of those 78 files and
  `testing/mocks/content.mock.ts` carries edits from both.
- 2026-09-22 **spec-repair executed — `ng test` 79 failed → 0, full verifier 8/8 GREEN.** Not a
  refactor phase; it is the prerequisite that unblocks Phase 1. ~75 `*.spec.ts` rewritten, new
  `src/test-setup.ts`, `angular.json` `test.options.setupFiles`, `tsconfig.spec.json` include,
  `MOCK_CONTENT_DETAILS` appended to the existing `__mocks__/content.mock.ts`. 427 passed / 1 skipped
  of 428; the 4 added tests replace assertions that could not stand (the `ng new` `<h1>` scaffold, a
  four-slide expectation against a one-item mock, an `isOpen` assertion for state aria-autocomplete
  handed to ng-primitives). **6 assertions removed, 10 added; no `.skip`, no `@ts-ignore`, no `any`,
  no silently dropped coverage.** Initial bundle +0.0% vs baseline. Eight findings logged above —
  the two that matter most for later phases: `environment.production` is **false** under `ng test`,
  and zoneless CD means plain-field test hosts assert stale DOM. Closed open questions 3, 4 and 5;
  question 5's "suspected real bug" was a self-contradictory spec, not a defect.
- 2026-09-22 **Phase 1 planned, NOT executed — precondition failed.** `ng test` is still red (79) and
  the verify script gates it by exit code, so the phase could not close green; the user chose to run
  `prompts/spec-repair.md` first. **No `src/` changes** — read-only audit plus this file. Ran
  `import-auditor` over all 7 files Phase 1 moves: 37 references total, every `__mocks__` consumer is
  a `.stories.ts` (zero production, zero spec), and the only production wiring point is
  `app.config.ts:24`. Confirmed against the built `dist/` that the partner mock **ships to production
  today**, in both the browser (`chunk-WULZM25R.js`, 15.7 KB) and server bundles. Settled two design
  points: the `fileReplacements` stub lives in production space at
  `shared/core/interceptors/dev/dev-interceptors.ts` — an `environment` flag was rejected because it
  keeps a static import of the interceptor, so the handlers chunk would still be emitted and the
  absence proof would fail; `ACMEALLI-55AA11BB` and `partnerMock` chosen as the bundle needles. Also
  confirmed: branch is `refactor/structure-1`, closing open question 1; and no `sass` dependency
  exists, so the `.scss` conversion removes nothing from `package.json`.
- 2026-09-22 **PLAN.md approved by the user.** Decision ticked. Phase 1 not started — it still needs
  the green unit-test gate and the branch switch. No `src/` changes.
- 2026-09-22 **Phase 0 ✅ complete.** Wrote `docs/refactor/PLAN.md` (13 sections) and
  `reports/phase-00.md`. **No `src/` changes** — read-only audit plus one throwaway import-graph
  script in the session scratchpad. Parsed all 708 non-spec `.ts` files: **~150 real boundary
  violations**. Headline findings: (a) the 3418 KB / **839 KB gzip** largest lazy chunk is
  `constant/location-min.ts`, used by one file, and its sibling `location.ts` (25 MB) has zero
  importers; (b) Phase 8 is near-mechanical — zero constructor injection, zero class-based
  guards/interceptors, zero `InjectionToken`/`useClass`/`useFactory`, so **no `@Injectable` needs
  keeping**; (c) admin partner-platform v1 is not removable as a unit — its `shared/` backs v2 and
  6 other admin features; (d) `feature-facade` is imported by `core`/`shared`/`layout`, so it is
  core, not feature code; (e) `pages/` is a second features root. Three spec bullets are already
  satisfied: no committed `.DS_Store`, no `baseUrl` to remove, no `@source`/Storybook globs to
  update. Closed the `ChangeDetectionStrategy.Eager` decision as **not applicable** (all 18 are
  `OnPush`). User settled 3 decisions in-session: merge the trackers, list-only dead code, move
  `Utils` to `shared/`. Filled the Part B tracker with 12 ordered rows.
- 2026-09-22 no-op: user asked for an empty test snapshot via `git`; refused by
  `.claude/hooks/guard-bash.mjs` ("Never commit"). Nothing was recorded, HEAD still `444d638`.
  No `src/` changes this session — the stop gate fired only because pre-existing dirty files
  (`.storybook/`, `app-version.ts`) are newer than this file.
- 2026-09-22 baselines recorded (user ran `verify.mjs --record-baseline`): 7/8 gates green, only unit
  tests red (79). `baseline/ssr.json` + `baseline/bundle.json` written. Storybook gate confirmed green
  inside the harness (22s), validating the `.storybook/` restore. SSR smoke passed against all four
  routes in `smoke-routes.json`. **Caveat found:** the course route's snapshot captured fallback SEO,
  not course SEO — see open question 8. No `src/` changes.
- 2026-09-22 spec-repair prep: wrote `prompts/spec-repair.md` (goal, locked decisions, 8 execution
  phases, acceptance criteria, risks). Traced all 79 failures to 7 root-cause groups; probed
  `section-nav` to prove its 7 failures are a jsdom `getBoundingClientRect()` artifact, not a component
  bug (throwaway probe spec deleted). Flagged `footer-overlay.isAllowedRoute` as a suspected real
  product bug to be logged, not fixed. **No `src/` changes** — awaiting approval to execute.
- 2026-09-22 storybook gate fixed: user approved restore; `git checkout 8271fa4^ -- .storybook`
  (main.ts, preview.ts, manager.ts, tsconfig.json, tsconfig.doc.json, typings.d.ts).
  `pnpm build-storybook` → "Storybook build completed successfully". Gate green. No `src/` changes.
  Noted `src/app/shared/core/version/app-version.ts` is regenerated by every build and dirties the tree.
- 2026-09-22 setup: harness verified complete (`.claude/settings.json`, 5 hooks, 3 agents, 3 skills,
  `scripts/refactor/{verify,ssr-smoke,bundle-report}.mjs`, `docs/refactor/{PROMPT,STATE,smoke-routes}`).
  `docs/refactor/README.md` does not exist in the repo. `chmod +x` applied to `.claude/hooks/*.mjs` and
  `scripts/refactor/*.mjs`. Added `docs/refactor/.cache/` to `.gitignore`. `src/server.ts` reads
  `process.env['PORT']` (default 4000) — OK for ssr-smoke. Filled `smoke-routes.json` with `/`,
  `/us/accounting/partners/cpacanada`, `/us/accounting/masterclass/154/adulting-in-business`,
  `/admin/login`; canonical locale prefix is `us/accounting` (seo.constants), not `us/cpa`, and the
  course id/slug comes from the live production sitemap. Typecheck clean; `verify.mjs --no-ssr` →
  2 red gates (see open questions). No `src/` changes.
