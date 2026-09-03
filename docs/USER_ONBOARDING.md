# User Onboarding (admin)

Admin section for manually onboarding learner users into Django: list them,
create/edit them, and record an offline (invoice) payment that activates their
subscription.

## Routes

Defined in `src/app/admin/admin.routes.ts`, all gated by `PERM.USERS_CREATE`:

| Path                              | Component               |
| --------------------------------- | ----------------------- |
| `/admin/user-onboarding`          | `UserOnboarding` (list) |
| `/admin/user-onboarding/new`      | `UserForm` (create)     |
| `/admin/user-onboarding/:id/edit` | `UserForm` (edit)       |

`UserOnboardingFacade` is provided on the parent route, so the list and the form
share one instance and the reference dropdowns are fetched once.

## Data access

Every call is Django, never Supabase. Requests carry `X-Internal-Api-Key` and
**no** bearer token — `IS_ADMIN_REQUEST` keeps the public 401/refresh
interceptor out, `SKIP_AUTH_TOKEN` strips the Authorization header. Paths are
relative and resolve against `BASE_API_URL`. Reads are `resource()` with
browser-only params (SSR skips them) and `AbortSignal` wiring.

| Purpose                      | Endpoint                                                     |
| ---------------------------- | ------------------------------------------------------------ |
| Users list (paged + search)  | `GET internal/users/`                                        |
| Create                       | `POST internal/onboard-user/`                                |
| Update                       | `PATCH internal/update-user/`                                |
| Offline payment              | `POST payment/internal/offline-invoice-payment/` (multipart) |
| Partner codes                | `GET promotion/partner-codes/`                               |
| Professions                  | `GET professions/`                                           |
| Professional courses         | `GET user/professional-course/`                              |
| State boards                 | `GET user/state-boards/`                                     |
| Job sectors (+ nested roles) | `GET user/job-sectors/`                                      |
| Companies (typeahead)        | `GET user/companies/`                                        |
| Location (typeahead)         | `GET v2/locations/autocomplete/` via `placeSuggestions()`    |

## List

`src/app/admin/user-onboarding/user-onboarding.ts`

- Search debounced 300 ms; a new search resets to page 1.
- Pagination follows the API's `next_page` / `previous_page` URLs
  (`parseNextPage`), with a `±1` fallback when they can't be parsed.
- `withPreviousValue` + `linkedSignal` keep the current rows visible while the
  next page loads.
- Row actions: **Edit**, **Record payment**.

## Form

`src/app/admin/user-onboarding/shared/components/user-form/user-form.ts`

One component for create and edit, built on `@angular/forms/signals`.

- Edit prefills from the list row passed via router state — there is no
  get-by-id endpoint. A cold deep link falls back to `findLoadedUser()`
  (loaded page only), otherwise it shows a "details weren't loaded" banner.
- **Email is the only required field** (presence + format). Everything else is
  optional.
- The payload sends only the fields the admin actually filled; blanks (`''`,
  `null`, empty arrays) are omitted. Checkboxes always send, since `false` is a
  real answer rather than a blank.
- Partner code defaults to the Creator plan once the codes load (create only).
- Changing sector clears a job role that the new sector doesn't offer.
- Company and location are server-filtered typeaheads, both debounced 300 ms.

### Caveat on edit

Because blank fields are omitted, clearing a previously-set value leaves it
unchanged server-side. Send explicit nulls once the backend supports clearing.

## Record payment

`RecordPaymentDialog` takes an invoice file and uploads it as `FormData` (no
manual `Content-Type`, so the browser sets the multipart boundary). On success
the list reloads.

## Open backend dependencies

- The exact enum vocabulary for `qualification_status` / `license_status` —
  the current options are onboard-side guesses.
- Which partner code actually maps to the "Creator" plan (currently a regex
  match on code/description).
- `country_selected` and `experience_id` are part of the contract but have no
  GET source, so they are omitted.
