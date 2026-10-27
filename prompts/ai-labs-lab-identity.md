# AI Labs — Copilot Studio opens as the wrong Microsoft account (MIL-117)

Branch `feat/MIL-117-ai-labs-refactor`. **Takes priority over `prompts/ai-labs-live-state.md`.**

## The report

- The lab sign-in is right: the page reads **"Signed in as usaid.khan.21c61d@mileslabs.ai"**.
- On a lab page, **Launch AI Lab** opens Copilot Studio as **charitha.e@mileslabs.ai**, a different Microsoft
  account that was already signed in on this browser.

## What I checked

- **Launch is a plain link.** `AiLabAuth.launchCopilot()` opens `https://copilotstudio.microsoft.com/` in a new
  tab. Our lab sign-in session is never handed to Copilot Studio; it can't be, since it's another site.
- **Copilot Studio picks its own account.** I fetched its live shell (the Power Platform `makerx` shell,
  `main.456b1b99.js`, 2026-10-27 build `0.0.20261020.1`):
  - It runs its own Microsoft sign-in (MSAL) and keeps the account it last used in its own browser storage.
  - The only query values it reads from its URL are `theme`, `host`, `hostId`, `hostPlatform`, `auth`, `state`,
    `widgetId` and the `utm_*` tags.
  - **It reads no `login_hint`, `loginHint` or `tenantId` from the link.** Its `login_hint` handling is internal:
    it hints with the account it already has.
  - Microsoft documents no link parameter for this either.
- **So a web page can't choose Copilot Studio's account.** On a browser where another Microsoft account last used
  Copilot Studio, Launch opens as that account. Two places this happens:
  - a tester's or developer's own browser (this report);
  - a shared or family computer, for real learners.
- **Our Microsoft sign-out can't help.** It is a hidden iframe, which Chrome's third-party cookie rules usually
  block. Even if it ran, Copilot Studio's own stored session would outlive it.
- **The API already gives what we need.** `account-ensure/?include=labs_account` returns this learner's
  `lab_email` and their own `environment_url` (guide §7). We read neither today.
- **v3 has the same behaviour** (same `launchCopilot`).

## Locked decisions

1. **Launch opens the learner's own `environment_url`**, from a new route-scoped
   `features/ai-labs/services/ai-lab-account.ts` that reads `account-ensure/?include=labs_account`.
   - On both AI Labs routes, like `AiLabCredits`; browser only, quiet, once per page visit.
   - Falls back to `COPILOT_STUDIO_URL` when AI Labs sent no URL.
   - With the wrong account, Copilot Studio now shows "no access to this environment" on the learner's own
     environment, instead of quietly opening that other account's workspace.
2. **Say which account to use, right at Launch.** One line under the Launch row on the lab page and the landing
   hero:
   > Copilot Studio uses the Microsoft account already signed in on this browser. Check it shows
   > **usaid.khan.21c61d@mileslabs.ai** (top right). If it shows another account, sign out there, or paste the lab
   > link into a private window. [Copy lab link]
   - The email is `lab_email`, falling back to the lab sign-in's email.
   - **Copy lab link** puts `environment_url` on the clipboard and toasts "Link copied".
   - A web page can't open a private window itself; copying the link is the most it can do.
3. **Also close the two ways our own lab sign-in can end up as the wrong person.** Same symptom, different cause;
   found while tracing this.
   - **Sign-in suggests this learner's account.** The popup's `login_hint` becomes `lab_email`, never the last email
     used on this browser.
   - **A mismatched lab session is dropped.** Checked after the popup, on restore, and at the Launch click. The
     learner sees: _"You signed in as x, but your AI Lab account is y. Sign in as y."_ Launch stays closed until
     they do.
   - **A fresh Miles sign-in (`verifyOtp`) starts with no lab session.** A lab session left from a previous learner,
     after their Miles cookies simply expired, no longer carries over.

**Not doing:** a `?login_hint=` on the Copilot Studio link. Its code doesn't read one, so it would do nothing.

## Files touched

| File                                                                   | Change                                                                                       |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `features/ai-labs/services/ai-lab-account.ts` (new)                    | `account-ensure/?include=labs_account` → `labEmail`, `environmentUrl`                        |
| `features/ai-labs/models/ai-labs.model.ts`, `constants/ai-labs-api.ts` | `labs_account` shape                                                                         |
| `features/ai-labs/ai-labs.routes.ts`                                   | `AiLabAccount` in both routes' `providers`                                                   |
| `core/services/ai-lab-auth/ai-lab-auth.ts`                             | `launchCopilot(url)`, `signIn({ labEmail })`, `belongsTo(labEmail)`, mismatch drop + message |
| `core/services/auth-session/auth-session.ts`                           | `verifyOtp` clears the lab session first                                                     |
| `features/ai-labs/pages/ai-lab-course/ai-lab-course.ts`, `.html`       | checked launch, account line + Copy lab link                                                 |
| `features/ai-labs/pages/ai-labs/ai-labs.ts`, `.html`                   | same through the hero                                                                        |
| `testing/mocks/ai-labs.mock.ts`, stories                               | stand-in `AiLabAccount`; "account line" and "signed in as someone else" stories              |
| `docs/refactor/STATE.md`                                               | Now + step log                                                                               |

About 120–160 lines; its own commit.

## Security

- `lab_email` and `environment_url` come from our backend under the learner's own Miles token.
- The clipboard gets only the learner's own environment link.
- Dropping a mismatched lab session is local; we never sign anyone out of Microsoft.

## Acceptance

1. Launch opens `environment_url` (the stubbed one in the CDP run), in a new `noopener` tab.
2. The account line names `lab_email`. Copy lab link puts `environment_url` on the clipboard and toasts.
3. A stored lab session for another email is dropped on load, with the mismatch message, and Launch doesn't open.
4. The sign-in popup is hinted with `lab_email`.
5. After `verifyOtp`, no lab session or last lab email remains in `localStorage`.

## Checks

`pnpm lint` · `pnpm check:structure` · `pnpm format:fix` · `pnpm build:prod` · `pnpm build-storybook`.

## How I'll verify

CDP on dev 4101 with `account-ensure/?include=labs_account` stubbed: assert the `window.open` URL, the account
line, the clipboard, the mismatch drop and the popup hint.

**On UAT, with your two accounts:**

- Launch lands on usaid's environment.
- While Copilot Studio is on charitha, it shows its no-access screen instead of charitha's workspace.

## Risks

- **This makes the wrong account visible and easy to fix; it can't prevent it.** Only Copilot Studio can change
  which account it uses. If the AI Labs team can ask Microsoft for a supported hint parameter, that is the real fix.
- **If charitha's account has access to usaid's environment** (an admin in the same `mileslabs.ai` tenant), Copilot
  Studio may open it rather than refuse. The account line is then the only signal.
- **A lab session with no email** can't be checked against `lab_email`. Your "Signed in as" line shows an email, so
  the check holds on this tenant.
