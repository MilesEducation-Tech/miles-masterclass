# AI Labs: the Microsoft (Entra) sign-in flow, ported from miles-masterclass-v3

## Goal

The AI Labs hero runs the lab sign-in the way upstream does. As the user put it (2026-10-22):

- **No AI Lab account yet:** "Create AI Lab account" → Participant Agreement → account created → Microsoft
  account login → Copilot Studio.
- **Account exists:** "Login to Miles AI Labs" → Microsoft account login (popup) → the button becomes
  **"Launch AI Lab"**. Below it: "Signed in as `<lab email>`" (e.g. `charitha.e1@mileslabs.ai`) and a small
  **Log out** button. "Launch AI Lab" opens Copilot Studio.
- **Never a direct jump.** Today an existing account opens Copilot Studio straight away (yesterday's quick fix),
  with no lab sign-in and no signed-in state. That is wrong and is replaced.

## What was read

- Upstream `feat/ai-labs-refactor` @ `ce0194a4`:
  - `shared/core/services/ai-lab-auth/ai-lab-auth.ts` (497 lines) and `ai-lab-session.ts`.
  - `pages/ai-lab-callback/ai-lab-callback.ts`, plus the `auth/ai-labs-callback` route in `app.routes.ts`.
  - `pages/ai-lab/ai-lab.ts`: the constructor, `activate()`, `signOut`, `switchAccount`.
  - `ai-lab.html`: the hero CTA cluster.
  - `ai-lab-account.ts`, `ai-lab-guard.ts`, `ai-lab-access.ts`.
  - `auth.ts`: the logout hooks `clearAiLabSession` and `signOutEverywhere`.
  - The `AI_LAB` env block.
- Ours: `pages/ai-labs/ai-labs.ts` (with the inert `auth` stub, whose shape is already upstream's), `AiLabsFacade`,
  `AiLabCourseFacade.launchLab`, `core/services/auth-session`, `core/services/supabase`, and the environments.
- **Site URLs match upstream** for prod (`www.milesmasterclass.com`) and UAT (`uat.milesmasterclass.com`). The
  Entra/Supabase callback allowlist that already works for upstream should therefore work for us. Local is
  `localhost:4101` here versus upstream's `4100`.

## How upstream's sign-in works (and why each piece exists)

- **A third Supabase client** pointing at the **labs** project (`nhohkxpcoeyerzsybipo`), with its own
  `storageKey`.
  - Separate from the admin and `SupabasePublic` clients. supabase-js sends its stored session as the bearer
    on every call, so sharing a client would mix identities (AGENTS.md §7).
  - `@supabase/supabase-js` is loaded by dynamic `import()` (~150 kB), so nothing joins the initial bundle.
- **Popup, not redirect.**
  - Microsoft's login page can't be framed, and a full redirect loses the landing page's state.
  - `signInWithOAuth({provider: 'azure', skipBrowserRedirect})` returns the URL, which goes into a popup opened
    **synchronously in the click** (popup blockers).
  - Query params: `domain_hint` = the labs tenant, so the learner can't land on the consumer login. `login_hint`
    = the last email, which skips the picker; `prompt: select_account` when there is none, or on "switch".
- **Callback page `/auth/ai-labs-callback`.**
  - Building the client there performs Supabase's code-for-session exchange.
  - It then posts `CALLBACK_DONE[:reason]` on a `BroadcastChannel` and closes itself.
  - BroadcastChannel because COOP cuts the opener↔popup link on the hop to Microsoft.
- **The opener waits on two signals:** the channel, or a localStorage poll every 500 ms. It times out after
  5 min. Focus returning to the page shows a "click to try again" hint after a 1.2 s grace period, but doesn't
  cancel the wait.
- **Validations and states:**
  - Not configured → "Sign-in is not configured yet."
  - Popup blocked → "Please allow pop-ups…"
  - Popup closed early → a hint, not an error.
  - Provider error → "Sign-in failed: `<reason>`"
  - Session expired, on restore or a background refresh → "Your AI Labs session expired. Please sign in again."
- **Session restore on page load.** One `onAuthStateChange` listener; `autoRefreshToken` renews the token.
- **Log out** clears the local session synchronously, then revokes on Supabase.
- **Miles logout also drops the labs session.** A sync key clear, plus a hidden-iframe Entra front-channel
  logout capped at 2 s.
- **Email-domain gate.** `AI_LAB_HIDDEN_EMAIL_DOMAINS = ['pinionglobal.com']` hides the header link, and
  `aiLabGuard` redirects every AI Labs route to Masterclasses. It is a UX gate; the APIs don't enforce it.

## Target flow on our backend (the hero's `activate()`, in order)

1. **Not signed in to Miles** → "Login Required" → `/auth/login?redirect=` (as now).
2. **`account-ensure/` not answered** → "Checking…"; **failed** → error + retry (as now).
3. **`NO_CAIRA_ENROLLMENT`** → CAIRA prompt; **`MISSING_REQUIRED_FIELDS`** → profile prompt (as now).
   - Upstream gates on an active plan instead; our backend's eligibility check is the equivalent.
4. **Signed in to the lab** (`AiLabAuth.isSignedIn()`) → **Launch AI Lab** opens Copilot Studio.
5. **No account, none requested** → Participant Agreement → `account-create/`.
   - 202 → the "Setting up your lab…" poll.
   - **When the poll sees `account_created: true`, the CTA becomes "Login to Miles AI Labs"** (see Q1 for
     whether it should open the sign-in by itself).
   - `ACCOUNT_EXISTS` + `entitlement_refresh_required` → the Miles re-login (as now).
6. **Account being created** → "Your AI Lab is being set up…" (as now).
7. **Account exists, not signed in to the lab** → **`AiLabAuth.signIn()`**: the Microsoft popup. On success the
   hero shows **Launch AI Lab**, **"Signed in as `<email>`"** and **Log out**.
8. **Resend Credential** stays for "account exists, not signed in to the lab", as upstream (already in our
   template).

The lab page's **"Sign in & launch AI"** follows the same rule as upstream: not signed in to the lab →
`signIn()`; signed in → Copilot Studio. Its label follows the state.

## Architecture (ours)

- **`core/services/ai-lab-auth/ai-lab-auth.ts`, `@Service()` (root).**
  - In core because Miles logout (`AuthSession`) must clear it, and core may not import a feature.
  - Upstream's logic is ported as-is, with these changes: `@Service`; `Storage` and `isPlatformBrowser` instead
    of bare `localStorage`/`window` where we touch them (the supabase client keeps its own storage);
    `inject()`; no `@Injectable`.
  - `launchCopilot()` uses `COPILOT_STUDIO_URL`, which moves to core with it.
- **`core/services/ai-lab-auth/ai-lab-session.ts`:** the Angular-free `clearAiLabSession()` that
  `AuthSession.clear()` calls.
- **`AuthSession.logout()`** calls `signOutEverywhere()` through the injector, lazily (upstream's
  `injector.get`), so the service stays out of the eager path until used.
- **`features/auth/pages/ai-lab-callback/` + the `auth/ai-labs-callback` route**, declared before `auth`
  (upstream's prefix-matching note).
- **Environments:** restore the `AI_LABS` block removed in `01f563e`: `supabaseUrl`, `supabaseAnonKey`,
  `tenantId`, `domainHint`, `redirectPath`, `storageKey` and the channel names. `catalogueCourses`,
  `assessmentEnabled` and `copilotUrl` stay out (`copilotUrl` is a constant now).
- **Landing:**
  - `AiLabs.auth` stops being a stub; it becomes `inject(AiLabAuth)`.
  - `restoreSession()` runs in the constructor.
  - `activate()` follows the order above. `switchAccount()` / `signOut()` are wired.
  - Yesterday's direct `openCopilotStudio()` goes.
  - The template's existing signed-in markup (Signed in as / Log out / error / hint) starts working unchanged.
- **Lab page:** `launchLab()` → sign in or launch; `signInLabel` follows the state.

## The split

1. **PR A: the sign-in** (everything above), about 650 lines.
2. **PR B: the email-domain gate** — `AI_LAB_HIDDEN_EMAIL_DOMAINS` in core, a `requires: 'aiLab'` nav
   requirement in the header, and `aiLabGuard` on the AI Labs routes. About 120 lines. Q2.

## Security

- Every value restored to the environment is a **public** identifier: tenant/client ids are public by design,
  and the anon key is RLS-scoped.
- The Entra client secret lives in the labs Supabase dashboard and never in this repo.
- No service-role key. The labs client is separate from both existing clients, with its own storage key.
- The popup is opened with no opener rights once it leaves for Microsoft (COOP). Copilot Studio opens with
  `noopener,noreferrer`.

## Acceptance

- **Signed in to Miles, account exists, no lab session:** "Login to Miles AI Labs" opens a centred Microsoft
  popup on the labs tenant. After login the popup closes and the hero reads **Launch AI Lab**, "Signed in as
  `<lab email>`", **Log out**.
- **Launch AI Lab** opens Copilot Studio in a new tab, as that account.
- **Log out** → back to "Login to Miles AI Labs" + Resend Credential. A reload keeps the signed-in state until
  then.
- **Popup blocked / closed / provider error / expired session** each show upstream's message.
- **Miles logout** clears the lab session.
- **The lab page's button** signs in or launches by the same rule.
- Lint, structure, `build:prod` (initial bundle unchanged — supabase-js stays lazy) and Storybook all pass.

## How to verify

1. Run `pnpm start` (4101) and sign in with a UAT learner whose AI Lab account exists.
2. Open `/us/accounting/ai-labs` → Login to Miles AI Labs → the Microsoft popup → `…@mileslabs.ai` → the hero
   shows the signed-in state → Launch AI Lab.
3. **Local caveat:** the labs Supabase project must allowlist `http://localhost:4101/auth/ai-labs-callback`
   (upstream's local was 4100). UAT and prod should already be allowlisted.

## Risks

- **Allowlist.** If the labs Supabase project's Azure redirect allowlist doesn't include our exact callback
  URLs, sign-in returns to the site URL instead. That's a dashboard change, outside this repo.
- **Entra logout is best-effort.** The iframe is a no-op under third-party-cookie partitioning, as upstream
  notes.

## Decisions (user, 2026-10-22)

- **Q1 → upstream's two-step.** The popup closes after the Microsoft login, and the hero becomes Launch AI Lab /
  Signed in as / Log out. One more click opens Copilot Studio.
- **Q2 → yes, as PR B**, after the sign-in.

## Questions (answered above)

- **Q1. After account creation, or after the Microsoft login, should Copilot Studio open by itself?**
  - Upstream opens neither by itself: the hero changes its label and the learner clicks again.
  - Opening Copilot Studio automatically after the login can't be a new tab (the browser blocks a tab opened
    after an await). It could only be the sign-in popup itself navigating to Copilot Studio instead of closing.
- **Q2.** Port the email-domain gate (`pinionglobal.com`) as PR B?
