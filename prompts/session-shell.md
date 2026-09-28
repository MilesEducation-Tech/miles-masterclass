# Signed-in header and footer

Status: approved and implemented (2026-09-28), uncommitted.

## Jira ticket

**Summary:** `fix(layout): show the signed-in header and footer after login`

**Issue type:** Bug
**Component / scope:** layout
**Branch:** `fix/MIL-XXX-signed-in-shell`
**Links:** caused by 8271fa4 (app strip) · relates to 444d638 (auth rebuild) · Postman `Accounts v1 / user-details/` · `prompts/session-shell.md`

### Context

Reported as "after login, user data isn't stored in localStorage". Not writing to localStorage is intentional:
since the auth rebuild (444d638), the user record lives in memory in `AccountApi.user` (an `httpResource` on
`GET user-details/`, gated on `isAuthenticated()`), which is re-fetched on each load. That keeps PII out of
XSS-readable storage and stops it going stale. The visible bug is that the header and footer were never
re-wired after the strip (8271fa4). Both still hold `// ponytail: inert` signals hard-coded to signed out.

### Current behaviour

- `layout/header/header.ts:117`: `isLoggedIn = signal(false)` and `userData = signal<User | null>(null)`, so after
  login the header shows the guest nav and never renders `<app-user-avatar-menu>`. The mobile drawer
  (`header.html:221`) never shows the user either.
- `layout/footer/footer.ts:29`: `userData = signal<User | null>(null)`, so `isLoggedIn` is always false and the
  `showWhen: 'not-authenticated'` links (e.g. Home) show to signed-in users.
- Both are typed with the old `User` model (`email`, `last_name`, `is_beta_access`), none of which
  `user-details/` returns.

### Expected behaviour

- `isLoggedIn` = `AuthSession.isAuthenticated()`, the boolean that's also available in SSR from the token cookie.
  The server HTML therefore already renders the signed-in nav, so there's no guest-to-signed-in flash.
- The user record comes from `AccountApi.user`, guarded with `hasValue()`, the same way
  `shared/components/user-avatar-menu/user-avatar-menu.ts:39` already does it.
- The mobile drawer shows initials and `full_name || first_name`, like the avatar menu. The email line is
  dropped, because `user-details/` has no email.
- Nothing is written to localStorage.

### Scope

- In: `header.ts|html`, `footer.ts|html`, and their specs.
- Out: `hasActivePlan` (no contract source yet, stays `false`), and the footer's `hasTrailAccess` / `is_beta_access`
  (no field in `user-details/`; it stays `false` with a comment, as a backend question). The cookie rename is
  `prompts/profile-status-cookie.md`.

### Acceptance criteria

- [ ] After OTP login, the header shows the logged-in nav and the avatar menu with the user's name, with no reload.
- [ ] A hard refresh while signed in has the logged-in nav in the SSR HTML, and the name fills in after `user-details/` loads.
- [ ] The mobile drawer shows the initials and name. No `email` or `last_name` reads are left.
- [ ] The footer hides `not-authenticated` links when signed in.
- [ ] Logout returns the header and footer to the guest state.
- [ ] If `user-details/` errors, the page still renders: signed-in nav, no name, no thrown `value()` read.
- [ ] Nothing about the user in localStorage (`Object.keys(localStorage)` is unchanged by login).
- [ ] `pnpm lint`, `pnpm ng test --watch=false` and `pnpm build:prod` are green (state the environment).

### How to verify

`pnpm start` → `/auth/login` → sign in → header shows the avatar and name, footer drops "Home".
Hard refresh → view source contains the logged-in nav. Mobile width (375) → open the drawer → name and initials.
Log out → guest header. DevTools → Application → Local Storage: no user entry.

### Risks / assumptions / open questions

- Assumes the signed-in nav routes exist post-refactor. Any that 404 are logged, not fixed here.
- Backend: is there a source for `is_beta_access` (trial access) on the web surface?
- The SSR HTML for a signed-in request is per-user. That's already the case for the token-cookie path, and
  transfer cache still excludes the authorised `user-details/` request.

**Estimate:** S–M (~120 lines including specs)

## Plan

1. `header.ts`: inject `AuthSession` and `AccountApi`. `isLoggedIn = auth.isAuthenticated`, and
   `userData = computed(() => account.user.hasValue() ? account.user.value() : null)` typed `UserDetails`.
   Remove the `User` import and the `ponytail: inert` block.
2. `header.html:221-237`: initials and name from `full_name || first_name` (same rule as the avatar menu), no email line.
3. `footer.ts`: `isLoggedIn = auth.isAuthenticated`, remove `userData`, and `hasTrailAccess` stays `signal(false)`
   with a comment pointing at the backend question.
4. Specs: header renders the avatar menu when authenticated and the guest nav when not; footer hides
   `not-authenticated` links. Stub `AuthSession` and `AccountApi` the same way `account-api.spec.ts` does.
5. Gates, then verify in the browser at 375 / 1440.

## Implementation notes (2026-09-28)

- Scope addition: the drawer's **Sign out** only navigated to `/` and never ended the session, which was harmless
  while the shell was inert. It now calls `AuthSession.logout()` with the same failure handling as
  `user-avatar-menu` (toast, stay put) and tracks `logout`.
- `displayNameOf` / `initialsOf` moved to `core/models/account.model.ts`. The header drawer and
  `user-avatar-menu` share them, so the two can't disagree.
- Found, not fixed: once signed in, `core/services/cart/cart-store.ts` and `feature-facade.ts` call
  `user/cart/mybucket/`, `v2/dashboard/`, `v2/user/last_viewed/`, `v2/caira-badges/`, `tracks/` and
  `webinar/filter/`, which all 404 on UAT. They gate on `isAuthenticated()` themselves, so this is independent of the header.
