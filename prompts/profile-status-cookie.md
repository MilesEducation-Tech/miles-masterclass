# Rename the USER_DATA cookie to PROFILE_STATUS

Status: approved and implemented (2026-09-28), uncommitted.

## Jira ticket

**Summary:** `refactor(auth): rename the USER_DATA cookie to PROFILE_STATUS`

**Issue type:** Tech debt
**Component / scope:** auth
**Branch:** `refactor/MIL-XXX-profile-status-cookie`
**Links:** relates to 444d638 (auth rebuild) · `docs/AUTH_API.md` · `prompts/profile-status-cookie.md`

### Context

`AuthSession.store()` writes `session.profile_status` (`new_user` | `onboard_completed` | `profile_completed`)
to a cookie named `USER_DATA`. The name was kept "for continuity with the pre-strip cookie"
(`environment*.ts`), but it reads as if the user record is stored there, and it caused the
"profile status is stored under user data" report.

### Current behaviour

- `core/services/auth-session/auth-session.ts:262` writes `USER_DATA=<profile_status>`, reads it back in
  `readProfileStatus()` and deletes it in `clear()`.
- The key is `AUTH.userData: 'USER_DATA'` in `environment.ts`, `environment.local.ts` and `environment.development.ts`.

### Expected behaviour

- The cookie is `PROFILE_STATUS`, from the config key `AUTH.profileStatus`.
- A leftover `USER_DATA` cookie from an older build is deleted, so it can't linger. A session carrying only the old
  name loses the cached status once and re-seeds it from `user-details/` (`AccountApi` → `setMilestones`).
  No guard reads the cached milestone today, so nothing is gated wrongly in between.
- The value, attributes (`path=/`, `SameSite=Lax`, `Secure` in prod) and lifetime are unchanged.

### Scope

- In: the 3 environment files, `auth-session.ts`, `auth-session.spec.ts`, and the `docs/AUTH_API.md` mention (if any).
- Out: moving tokens to the httpOnly SSO cookie (documented upgrade path, blocked on UAT 503).

### Acceptance criteria

- [ ] After login, cookies show `ACCESS_TOKEN`, `REFRESH_TOKEN` and `PROFILE_STATUS`, and no `USER_DATA`.
- [ ] With a pre-existing `USER_DATA` cookie, loading the app removes it.
- [ ] Logout deletes `PROFILE_STATUS`.
- [ ] A hard refresh while signed in seeds `profileStatus()` from `PROFILE_STATUS` (the SSR path included).
- [ ] No `userData` config key is left (`grep -rn "AUTH.userData" src` returns nothing).
- [ ] `pnpm lint`, `pnpm ng test --watch=false` and `pnpm build:prod` are green (state the environment).

### How to verify

`pnpm start` → sign in → DevTools → Application → Cookies: `PROFILE_STATUS=new_user` (or similar) and no `USER_DATA`.
Set `USER_DATA=x` by hand, reload, and it's gone. Log out, and `PROFILE_STATUS` is gone.

### Risks / assumptions / open questions

- Does any other Miles app on the same domain read `USER_DATA`? If so, keep writing both names for one release.
  **Confirm before merging.**

**Estimate:** S (~40 lines)

## Plan

1. `environment*.ts` (3 files): `userData: 'USER_DATA'` → `profileStatus: 'PROFILE_STATUS'`, keeping the comment
   minus the continuity note.
2. `auth-session.ts`: use `AUTH.profileStatus` in `store()`, `clear()` and `readProfileStatus()`. `clear()` and `store()`
   also `deleteCookie('USER_DATA')`. `// ponytail:` drop that line once old sessions have expired.
3. Spec: `store()` writes `PROFILE_STATUS` and removes `USER_DATA`, and `clear()` removes both.
4. Gates, then check the cookies in the browser.

## Implementation notes (2026-09-28)

- The legacy `USER_DATA` is deleted in the `AuthSession` constructor (first load), in `store()` and in `clear()`.
  All three are browser-only. It is never read.
