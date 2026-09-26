# Phase 9 — Data layer · `admin/partner-platform(-v2)`

Date: 2026-09-26 · Branch: `refactor/structure-10`. **The last Phase 9 row: with it, Phase 9 is ✅ across the
tracker.**

Scope, by your decision before execution: convert **v2 + the shared partner layer**, and leave **v1's unrouted pages**
untouched. They only consume the shared services. The Phase 6 v1-removal / v2-rename decision stays open and is
unaffected.

## 1. Summary

**15 reads moved to `httpResource`. 19 unguarded `value()` reads are fixed.** Source is +226 / −244 (slightly
smaller); specs are +493, with 19 new tests in 5 new spec files.

| File                                                         | Reads                                          | Notes                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------ | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `admin/core/services/partner-admin-me`                       | `/panel/me/`                                   | Keyed on a `userId` **computed**, a primitive, so a token rotation or a same-user rebuild never refetches. The old `params` keyed on `user_id` for exactly this reason. **Fail-closed** through the `hasValue()` guard (was a `.catch()` fallback).                                                                                    |
| `admin/core/services/partner-network-facade`                 | dashboard, member firms, panel codes, seats    | The capability gates are kept, so no doomed 403 fires. A firm admin never sends `firm_id`. **5 guards.** The `sendSeat` optimistic patch is unchanged.                                                                                                                                                                                 |
| `admin/core/services/partner-superadmin-facade`              | networks, partner codes, firms, partner admins | Behind the same `canLoad()` permission gate. **4 guards.** New **resource factories** `networkDetailResource(id)` and `listFirmsResource(filter)`, called from page field initializers, so there is still no HTTP in the components. `listFirms()` is deleted (one caller); `networkDetail()` stays for the dead v1 `network-tracker`. |
| `admin/users/services/partner-users-facade`                  | panel users list                               | Capability gate, the `users` `linkedSignal` and `withPreviousValue` kept. **1 guard.**                                                                                                                                                                                                                                                 |
| v2 `pages/firms-v2`, `pages/network-detail-v2`               | through the factories                          | **1 guard** (`network-detail-v2`'s `detail`).                                                                                                                                                                                                                                                                                          |
| v2 `services/partner-report-facade`                          | summary, per-user roll-up, filters             | **4 guards.** The filters are now keyed on a primitive `base`, so they **fetch once per base**, as their comment always said; see §3.                                                                                                                                                                                                  |
| v2 `dialogs/firm-form-dialog`, `create-partner-admin-dialog` | (Supabase `resource()`, kept)                  | **2 + 2 guards.** Each dialog renders an `adminUsersError` message that a failed list could never reach, because the unguarded read threw first.                                                                                                                                                                                       |

**Unchanged, on purpose:**

- all mutations (seats, networks, firms, codes, partner admins, block status, provisioning);
- the CSV and certificate downloads;
- `partner-report-facade.userItems()`, fetched on dialog open;
- `loadPreviewBundle()`, the printable preview. It fetches every page of both subjects, a fan-out known only at
  runtime.

## 2. Verification

`node scripts/refactor/verify.mjs`, full run, local macOS / Node 24.15: **8/8 green**.

| Gate            | Result                                                |
| --------------- | ----------------------------------------------------- |
| lint            | pass                                                  |
| unit tests      | pass: 190 files, **698 passed** + 1 skipped (was 679) |
| build (local)   | pass                                                  |
| build (prod)    | pass                                                  |
| storybook build | pass                                                  |
| format check    | pass                                                  |
| bundle report   | pass: initial 88.8 KB gz, unchanged                   |
| ssr smoke       | pass: 4 of 4 routes, `/admin/login` 200               |

- **`reviewer`: PASS, zero violations.** It checked:
  - the parity of every URL, param, `IS_ADMIN_REQUEST` context and capability/permission gate against `HEAD`;
  - that the v1 pages still compile and behave the same;
  - that the factories run in an injection context;
  - that the specs bite;
  - that ESLint is clean on all 14 files.
- **Tests that bite:**
  - "no refetch on a same-user rebuild";
  - "fail-closed on a 500";
  - "a firm admin never sends `firm_id`";
  - "no request without the capability or permission";
  - "filters fetched once". The old code would have failed this one.
- **Browser: not run.** The admin console needs your Supabase sign-in, and the dev-server config uses `npx`.

## 3. Decisions needed / skipped / suspicious

- **No new decision needed.** The scope decision was taken up front. The Phase 6 v1/v2 decision is still open.
- **One intentional request-count change:** `partner-report-facade`'s filters.
  - The old `resource()` params returned a fresh `{ base }` on **every** subject, date or scope change, so it refetched
    the static filter list each time, contradicting its own "fetch once" comment.
  - Keying on the primitive `base` fetches once per base.
  - It is fewer requests with the same data. The reviewer accepted it as a data-layer optimisation, not a logic
    change, and a spec pins it.
- **Logged earlier, still true:** on `/admin/admin-users`, `PartnerSuperAdminFacade` loads all four lists while the page
  reads only networks and firms. They are now `httpResource`s with the same gate. Trimming them would mean a per-list
  opt-in (the payment-facade pattern), which is a follow-up.
- No `@Injectable`, no CSS, and no heavy-library service.

## 4. Visual QA list (Supabase admin sign-in)

1. **Partner v2 as a network admin:**
   - overview and dashboard;
   - the tracker: drill into a firm, search, status filter, pagination;
   - send a seat and watch the row update;
   - users, with search and block/unblock;
   - reports, with subject/date filters, pagination, the drill-down and the preview.
2. **As a firm admin:** the tracker is pinned to the firm, and there is no firm picker.
3. **As a super admin:**
   - networks, then a network's detail page with its firms;
   - firms: the all / standalone / by-network scopes;
   - codes and partner admins;
   - reports stay idle until a scope is picked.
4. **Dialogs:**
   - firm form and create-partner-admin with "reuse existing login";
   - with a role that cannot list Supabase logins, the error message shows instead of the dialog breaking.
5. **An admin without partner capabilities:** the panel pages show their empty or forbidden states, and there is no
   403 noise.

## 5. Commit messages (two commits)

**1.** The shared layer: `admin/core/services/partner-{admin-me,network-facade,superadmin-facade}.ts` and
`admin/users/services/partner-users-facade.ts`, with their specs

```
refactor(admin): move the shared partner services to httpResource

- PartnerAdminMe (keyed on a userId computed, fail-closed),
  PartnerNetworkFacade, PartnerSuperAdminFacade and PartnerUsersFacade:
  resource() + firstValueFrom -> httpResource, same gates and contexts
- superadmin: networkDetailResource()/listFirmsResource() factories replace
  the Observable the v2 pages wrapped; networkDetail() kept for v1
- guard 11 value() reads that threw on a failed load
- +14 spec tests

Phase 9 (data layer), admin/partner-platform.
```

**2.** v2: `pages/firms-v2`, `pages/network-detail-v2`, `services/partner-report-facade` (+ spec), the two dialogs,
plus STATE.md and this report

```
refactor(admin): move the partner platform v2 reads to httpResource

- firms-v2 and network-detail-v2 use the facade resource factories
- PartnerReportFacade: summary, users and filters -> httpResource; the
  filters now fetch once per base, as documented
- guard the v2 dialogs' admin-login lists so their error message can render
- +5 spec tests

Phase 9 (data layer), admin/partner-platform.
```
