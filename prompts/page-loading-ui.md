# Per-page loading UI: spinner, first-load skeletons, a stuck flag

The follow-up to MIL-41 (the global loading bar). The per-page loading indicators that never show,
or show wrong.

## Jira ticket

**Summary:** `fix(shared): make the per-page loading indicators render`

**Issue type:** Bug
**Component / scope:** shared
**Branch:** `fix/MIL-XXX-page-loading-ui`
**Links:** follows MIL-41 · `prompts/page-loading-ui.md`

### Context

The global bar is fixed (MIL-41). The pages' own loading UI still fails in four places.

### Current behaviour

1. **`app-spinner` shows no visible spin.** It is used about 40 times, in the learner app and in admin.
   - `shared/ui/spinner/spinner.ts:42-44` builds `text-${trackColor} fill-${color}` at runtime, so
     Tailwind never emits those classes. Only the classes some other file happens to use survive.
   - The default track, `neutral-tertiary`, is not a token, so the track falls back to the full text
     colour. The arc is `fill-primary`, a deep navy (`rgb(4,72,170)`) that disappears on the dark page.
   - The arc path's `fill="currentFill"` is not valid SVG.
   - The result is a static-looking ring. `PageLoading` (`color="white"`) is worse: track and arc
     are both white. That covers the cart, plans, orders, final assessment and instructor pages.
   - `join-cta.html:30-36` documents the same bug and works around it locally.
2. **The `/masterclass` hero skeleton is dead code.**
   - `masterclass.html:5` tests `@if (popular.items())`, but `FeatureResource.items` is always an
     array, so `[]` is truthy.
   - `<app-slider-skeleton>` never renders. An empty slider with its arrows renders instead, and stays
     when the read fails (UAT answers 404 for `v2/dashboard/?filter=popular` today).
3. **Podcast and micro-learning show nothing while their tracks load.** `@for (item of track.items())`
   has no `@empty`, so the page is the hero and then blank until the rails land.
   - The carousel's own `isLoading` only adds slides while the next page of a rail loads.
   - The personalised rails (Continue Watching, My List, Mastered) are hidden while empty on purpose.
4. **The partner-code dialog can lock up.**
   - `PartnerCode.apply()` (`core/services/partner-code/partner-code.ts`, a root service) sets
     `loading` when it is called, not when the request is subscribed. It only clears the flag in
     `tap` / `catchError`.
   - If the learner closes the dialog while the request is in flight, `takeUntilDestroyed`
     unsubscribes, neither runs, and `loading` stays `true`.
   - Every later open shows a disabled field and "Applying…" until a reload.

### Expected behaviour

1. Every spinner visibly spins:
   - by default the arc takes the surrounding text colour (`currentColor`) and the track is that
     colour at 25%, so it reads on any surface (dark page, white button, admin)
   - the `color` / `trackColor` values in use today (`white`, `neutral-600`, `primary`) render as named
2. `/masterclass` shows the slider skeleton on the server and while `popular` loads, the slider once
   it has slides, and nothing if the read fails or is empty.
3. Podcast and micro-learning show a rail-shaped skeleton on the server and while the tracks load, and
   nothing if there are none.
4. Closing the partner-code dialog mid-request leaves it usable next time.

### Scope

- In:
  - `shared/ui/spinner` and its story
  - a `FeatureResource.isPending` signal (`core/services/feature-facade/feature-facade.ts`)
  - `masterclass.html`, `podcast.html`, `micro-learning.html`
  - `partner-code.ts`
- Out, checked and not bugs:
  - `masterclass-facade.selectCpeMode` and `payment-facade.proceedToPayment` clear their flag on
    both paths and own their subscription
  - `global-search-dialog` and `partnership-content` catch errors into `of([])`, and only a
    destroyed component can cancel them
- Out: the nested `role="status"` in `PageLoading` → `Spinner` (an a11y nit).

### Acceptance criteria

- [ ] `app-spinner` spins visibly at every call site. A computed style shows a real `fill` on both
      paths, and the track at 25%.
- [ ] `/masterclass`:
  - the SSR HTML carries `app-slider-skeleton`
  - the browser shows the slider once it has slides
  - a failed `popular` read leaves no empty slider
- [ ] `/podcast` and `/micro-learning`: the SSR HTML carries the track skeleton, which the rails
      replace.
- [ ] The partner-code `loading` returns to `false` when the subscription is cancelled.
- [ ] `pnpm lint`, `pnpm build:prod` green (state the environment).

### How to verify

`build:prod` SSR (port 4000) and headless Chromium:

- `curl` the SSR HTML of `/masterclass`, `/podcast` and `/micro-learning` for the skeletons
- load each page and confirm what replaces the skeleton
- read the spinner's computed `fill` / `opacity` on the cart page and on a submit button

### Risks / assumptions / open questions

- Visual parity (AGENTS.md §4.6), intentional differences:
  - the default spinner arc changes from navy to the text colour, and its track from full to 25%.
    In admin, that turns the arc from `#2a85ff` to the foreground colour.
  - `/masterclass` collapses its hero when `popular` fails, instead of showing an empty slider.
- `isPending` is true on the server, which never fetches these, so the skeleton is in the SSR HTML.
  A read that fails in the browser drops the skeleton, and the space it held collapses.

**Estimate:** M (100–400)

## Approach

1. `spinner.ts`:
   - literal class maps: `COLORS = { current: 'fill-current', primary: 'fill-primary', white: 'fill-white' }`
     and `TRACKS = { current: 'fill-current opacity-25', 'neutral-600': 'fill-neutral-600' }`
   - defaults `current` / `current`, with typed inputs
   - the classes go on the two paths; the invalid `fill` attributes are dropped
   - stories: `neutral-tertiary` → `current`
2. `FeatureResource.isPending = computed(() => !this.isBrowser || this.isLoading())`. It is true on
   the server, where these resources never fetch, and while a request is in flight.
3. `masterclass.html`: `@if (popular.items().length) slider @else if (popular.isPending()) skeleton`.
4. `podcast.html` / `micro-learning.html`: an `@empty` on the track loop:
   `@if (track.isPending())` → a heading bar plus a row of cards, in the first rail's shape (podcast
   square, micro-learning 9:16).
5. `partner-code.ts`: `defer(() => { loading.set(true); … }).pipe(…, finalize(() => loading.set(false)))`.
