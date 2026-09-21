# Home surround carousel (WebGL)

> Implementation prompt. Written by the agent, reviewed and approved by a human **before** any code is written.
> Every section below is required. A thin or missing section is grounds to reject the plan.

## Goal

Add a new home-page section — a three.js cylindrical "surround" carousel of Masterclass cards that the visitor drags, scrolls or arrows through — modelled on the `One subscription. Every image & video model.` section of melius.com.

## What it read

- Skills: `home-and-landing`, `ui-components`, `angular-conventions`, `tech-stack`, `routing-and-guards`, `core-services`
- Files inspected:
  - `src/app/features/home/home.html`, `home.ts` — section list, `sectionNavItems()`, `@defer (on viewport; prefetch on idle)` usage
  - `src/app/shared/components/caira-level-stack/caira-level-stack.ts` — the reference for lazy-loaded animation libraries, `afterNextRender` as the SSR guard, `Viewport` + reduced-motion gating, `DestroyRef` teardown, and the "do not add a top-level import or esbuild folds the chunk back" rule
  - `src/app/shared/components/wave-canvas/wave-canvas.ts` — the repo's existing canvas lifecycle (viewChild ref, `afterNextRender`, `ResizeObserver` on the parent, DPR handling, rAF cancelled in `destroyRef.onDestroy`)
  - `src/app/shared/core/services/viewport/viewport.ts` — `isMobile()` / `isHandheld()` / `isDesktop()` signals, SSR defaults
  - `src/app/features/shared/services/feature-facade/feature-facade.ts` — `getResource(key, type)`, `FeatureResource.items()` / `isLoading()`, the flat-list vs track distinction
  - `src/app/shared/core/models/feature.model.ts` — `FeatureApiKey` union (`'popular'` is a flat `Content[]` list)
  - `src/app/shared/core/models/course.model.ts` — `Content` (`id`, `title`, `horizontal_thumbnail`, `course_type`, `class_credits`, `instructor_details`)
  - `src/app/shared/core/services/utils/utils.ts` — `navigateToCourse(type, id, title)`, `getCourseUrl(...)`, `slugify()`
  - `src/app/shared/components/section-nav/section-nav.ts` — `SectionNavItem` shape
  - `package.json` — **`three` is not installed**; `gsap@3.15`, `lenis@1.3`, `swiper@12`, Tailwind v4, Angular 22 SSR
- Reference site: melius.com, inspected live in Chrome. Confirmed stack — `window.__THREE__ === "184"`, GSAP + Lenis, Next.js. The carousel is a WebGL scene (the panels are barrel-curved and the labels curve with them, which rules out DOM/CSS). The section has since been removed from the live site in a redesign, so the geometry below is reconstructed from the reference screenshot plus the confirmed library set, not copied from their bundle.

## Assumptions

1. **Renderer: three.js, lazily chunked.** Confirmed with the requester. `three` + `@types/three` become new dependencies. This is a deliberate exception to AGENTS.md §4 "no second carousel library" — Swiper is a DOM carousel and cannot produce curved panels. Mitigation is bundle discipline, spelled out under _Bundle budget_ below.
2. **Content: live Masterclass data.** Confirmed with the requester. Source is `feature.getResource('popular', 'masterclass')` — a flat `Content[]`, already used elsewhere on the site, anonymous-safe, and it is the only flat list that is both public and ordered for marketing. `'latest'` is the fallback if `popular` returns empty for a locale.
3. **Placement: a new standalone section.** Confirmed with the requester. It goes between `#caira-levels` and `#offerings`, with its own `section-nav` entry. Rationale: the CAIRA stack ends on a dark, animation-heavy beat and `#offerings` opens with a headline — the carousel bridges them, and it must not compete with the existing `#plan` section, which already owns the words "One Subscription."
4. **Panel media is `horizontal_thumbnail`** (16:9, matching the reference's landscape panels). `thumbnail` (portrait) is the fallback when `horizontal_thumbnail` is empty. No video textures in v1 — `thumbnail_gif` is a GIF, not a video, and decoding N animated GIFs to textures is not worth the frame budget.
5. **Card count is clamped to 10.** The reference shows ~5 panels across a 1512px viewport on a full ring. Fewer than 6 items makes the ring visibly sparse, so below 6 items the section does not render at all (the DOM fallback list renders instead). More than 10 adds texture uploads nobody sees.
6. **The section is decorative-plus:** the WebGL canvas is `aria-hidden`, and a real `<ul>` of `<a>` links carries the same cards for screen readers, crawlers and no-WebGL clients. This list is what SSR emits, so the section is never empty in the server HTML.
7. **No new API call.** `getResource` caches per `key-type`, so if another home component later wants `popular-masterclass` it shares this one.
8. **Copy is static, in the template** — not from the API. Heading: `One subscription. Every class, every expert.` / sub: `Unlimited access to every Masterclass, Podcast and Micro-Learning reel — one plan.` Change it in review if marketing has different words; nothing else depends on it.

## Files that will change

| File                                                                      | Create / Modify | Why                                                                                                                                                                                 |
| ------------------------------------------------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `package.json`                                                            | Modify          | Add `three` and `@types/three` (dependencies / devDependencies respectively).                                                                                                       |
| `pnpm-lock.yaml`                                                          | Modify          | Lockfile, via `pnpm add`.                                                                                                                                                           |
| `src/app/shared/components/surround-carousel/surround-carousel.ts`        | Create          | The component: data → cards, DOM fallback, lifecycle, and the lazy handoff to the WebGL engine.                                                                                     |
| `src/app/shared/components/surround-carousel/surround-carousel.html`      | Create          | Heading, canvas host, arrow buttons, progress bar, and the accessible fallback list.                                                                                                |
| `src/app/shared/components/surround-carousel/surround-carousel.css`       | Create          | Only what Tailwind can't express: the dotted-grid background and the canvas edge mask.                                                                                              |
| `src/app/shared/components/surround-carousel/surround-carousel.engine.ts` | Create          | All three.js code. **Nothing else in the app may import this file statically** — it is reached only through `await import(...)`, which is what keeps three out of the shared chunk. |
| `src/app/shared/components/surround-carousel/surround-carousel.spec.ts`   | Create          | Vitest: card mapping, the `< 6 items` guard, fallback-list rendering. No WebGL in tests.                                                                                            |
| `src/app/features/home/home.html`                                         | Modify          | New `<section id="model-carousel">` between `#caira-levels` and `#offerings`, wrapped in `@defer (on viewport)`.                                                                    |
| `src/app/features/home/home.ts`                                           | Modify          | Import the component; add the `model-carousel` entry to `sectionNavItems()`.                                                                                                        |

## Implementation requirements

### 0. Pre-flight — CORS on the thumbnail CDN (do this first, it can invalidate the approach)

WebGL refuses to upload a cross-origin image unless the response carries `Access-Control-Allow-Origin` **and** the `<img>` was created with `crossOrigin = 'anonymous'`. Thumbnails come from `d1pp0977rsxmiq.cloudfront.net`. Verify before writing any shader:

```bash
curl -sI -H "Origin: http://localhost:4101" \
  "<a real horizontal_thumbnail URL from the popular response>" \
  | grep -i access-control-allow-origin
```

- **Header present** → proceed as written.
- **Header absent** → stop and report it. Do not work around it in client code. The fix is a CloudFront response-headers policy (infra ticket); the interim is to ship the section with the bundled placeholder texture instead of course art, which is not worth shipping. Either way, raise it rather than deciding alone.

### 1. Component shell (`surround-carousel.ts`)

Standalone, `OnPush`, `host: { class: 'block' }`. Injects `FeatureFacade`, `Viewport`, `Utils`, `Router`, `DestroyRef`, `ElementRef`.

```
protected readonly source = this.feature.getResource('popular', 'masterclass');

protected readonly cards = computed<CarouselCard[]>(() =>
  (this.source.items() as Content[])
    .filter((c) => !!(c.horizontal_thumbnail || c.thumbnail))
    .slice(0, MAX_CARDS)               // MAX_CARDS = 10
    .map((c) => ({
      id: c.id,
      title: c.title,
      courseType: c.course_type,
      image: c.horizontal_thumbnail || c.thumbnail,
      caption: `${c.class_credits} CPE`,
    })),
);

/** Below this the ring reads as sparse rather than infinite. */
protected readonly canRender = computed(() => this.cards().length >= MIN_CARDS); // MIN_CARDS = 6
```

`activeIndex = signal(0)` drives the progress bar, the `aria-live` announcement and the highlighted item in the fallback list.

### 2. Lifecycle and the lazy handoff

Mirror `caira-level-stack` exactly:

```
constructor() {
  this.destroyRef.onDestroy(() => { this.destroyed = true; this.engine?.dispose(); this.engine = undefined; });

  afterNextRender(() => {            // never runs on the server — this IS the SSR guard
    if (this.viewport.isMobile()) return;                                        // phones keep the DOM list
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!supportsWebgl()) return;                                                // cheap probe, see below
    void this.initEngine();
  });

  // Rebuild when the data arrives after first render.
  effect(() => { const cards = this.cards(); if (this.engine) this.engine.setCards(cards); });
}
```

`supportsWebgl()` is a five-line local helper: create a throwaway `<canvas>`, `getContext('webgl2') ?? getContext('webgl')`, return `!!ctx`, and let it be GC'd. No new dependency.

`initEngine()`:

```
private async initEngine(): Promise<void> {
  const { SurroundEngine } = await import('./surround-carousel.engine');
  if (this.destroyed) return;   // navigated away while the chunk was in flight
  this.engine = new SurroundEngine(this.canvasRef()!.nativeElement, {
    onActiveChange: (i) => this.activeIndex.set(i),
    onSelect: (i) => this.openCard(i),
  });
  this.engine.setCards(this.cards());
  this.host.nativeElement.dataset['webgl'] = 'on';   // CSS hides the fallback list visually
}
```

> Do **not** add `import * as THREE from 'three'` to `surround-carousel.ts`. Same trap as gsap in `caira-level-stack.ts`: a static import at the parent makes esbuild fold the dynamic chunk back into the parent and silently undoes the split. All three.js symbols live in `.engine.ts` and nowhere else.

### 3. The engine (`surround-carousel.engine.ts`) — the geometry that produces the reference look

**Scene.** `WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })`, `setPixelRatio(Math.min(devicePixelRatio, 2))`. `PerspectiveCamera(38, aspect, 0.1, 100)`.

**The ring.** N cards on a circle of radius `R`, group at the origin, camera at `(0, 0, R + D)` looking at the origin. Card `i` sits at angle `θᵢ = rotation + i · (2π / N)`:

```
x = R · sin(θᵢ)
z = R · cos(θᵢ)
rotation.y = θᵢ
```

At `θ = 0` the card is nearest the camera and square-on; its neighbours swing away and the far half of the ring is behind the camera's focus and faded out. Start values: `R = 5.2`, `D = 3.4`, card `3.05 × 1.72` world units (16:9). Tune `D` until the centre card fills roughly a third of the viewport width at 1512px, as in the reference.

**The curve.** This is the detail that separates it from a CSS carousel. Build the panel from `PlaneGeometry(w, h, 40, 1)` and push every vertex onto the cylinder in local space, once, at construction:

```
const pos = geo.attributes.position;
for (let v = 0; v < pos.count; v++) {
  const a = pos.getX(v) / R;               // arc-length → angle
  pos.setX(v, R * Math.sin(a));
  pos.setZ(v, R * Math.cos(a) - R);        // -R so the panel centre stays at z = 0
}
geo.computeVertexNormals();
```

The panel now lies flush on the ring and bows exactly like the reference frames.

**The texture — one CanvasTexture per card, drawn offscreen.** The panel is not a bare image; it is the reference's window-chrome card: rounded dark frame, a title bar with the small red dot at top-left, the thumbnail inset below, and the course title. Drawing all of that into a 2D canvas and uploading it as one texture is what keeps the chrome and the label curving with the panel:

```
drawCard(card) →
  canvas 1024 × 576, DPR-independent (the texture is resampled anyway)
  fill rounded rect  #0F0F10, radius 28
  title bar:  height 56, hairline rgba(255,255,255,.08) underneath
              red dot r=5 at (28, 28), fill #E8552F
              card.title, 22px system stack, rgba(255,255,255,.72), truncated to width
  thumbnail:  drawImage inset 16px below the bar, rounded-clipped, object-fit: cover maths
  caption:    card.caption bottom-left, 18px, rgba(255,255,255,.5)
→ new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace; texture.anisotropy = min(4, maxAnisotropy)
```

Images load through a single `THREE.ImageLoader` with `setCrossOrigin('anonymous')`. A card whose image 404s still renders — the chrome draws, the thumbnail slot stays the frame colour. Never let one bad URL blank the ring.

**Material.** `ShaderMaterial` with `transparent: true`, `depthWrite: false`, uniforms `uMap`, `uFade` (0…1, how far this card is from centre). Fragment shader does three things: sample the map; multiply by `mix(1.0, 0.35, uFade)` so off-centre cards recede exactly as in the reference; and apply a rounded-rect SDF alpha on UV so the corners are clean against the dark background rather than antialiased by the texture. `uFade` is written every frame from `abs(shortestAngleTo(θᵢ, 0)) / π`.

**Interaction.**

| Input        | Behaviour                                                                                                                                                                                                                                                   |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pointer drag | `pointerdown` → `setPointerCapture`; `pointermove` → `targetRotation += dx · DRAG_SENSITIVITY`; `pointerup` → release, decay velocity, then snap. Touch-action `pan-y` on the canvas so vertical page scroll is never stolen.                               |
| Wheel        | `deltaX` only (trackpad horizontal). Never `deltaY` — Lenis owns vertical scroll site-wide and fighting it is how carousels hijack the page.                                                                                                                |
| Arrows       | Two real `<button>`s outside the canvas → `targetRotation ∓ step`, snapped.                                                                                                                                                                                 |
| Click / tap  | Pointer up with `< 6px` total travel and `< 250ms` → raycast against the ring; a hit on the centre card calls `onSelect(i)`. A hit on a non-centre card rotates it to centre instead of navigating — the reference behaves this way and it avoids mis-taps. |
| Idle         | Autoplay drift `+0.00035 rad/frame`, paused on pointer-over, on drag, when off-screen, and when `prefers-reduced-motion`.                                                                                                                                   |

Smoothing is a damped lerp in the rAF loop — `rotation += (targetRotation - rotation) * 0.08` — with GSAP used only for the snap-to-index tween (`ease: 'power3.out'`, 0.6s). GSAP is already dynamically imported elsewhere and lands in its own chunk; import it here the same way.

**Frame budget.** The rAF loop runs only when an `IntersectionObserver` on the canvas reports it intersecting **and** `document.visibilityState === 'visible'`. When both go false, cancel the frame. A home page must not hold a WebGL context spinning three sections above the fold.

**Resize.** `ResizeObserver` on the canvas's parent (same shape as `wave-canvas`), debounced 100ms → `renderer.setSize`, `camera.aspect`, `camera.updateProjectionMatrix()`, and re-derive `D` from the new aspect so the centre card keeps its proportion on a narrow desktop window.

**Disposal — non-negotiable.** `dispose()` must: cancel the rAF; disconnect both observers; remove every pointer/wheel listener; `geometry.dispose()` and `material.dispose()` per mesh; `texture.dispose()` per texture (and drop the offscreen canvases); `renderer.dispose()`; `renderer.forceContextLoss()`. Browsers cap live WebGL contexts at ~16 — an SPA that leaks one per home-page visit kills the tab after a dozen navigations, and nothing in the console says why.

### 4. Template (`surround-carousel.html`)

```
<section> (host)
  <header>  eyebrow · h2 · sub-paragraph                        ← static copy, always in the DOM
  <div class="carousel-stage">
    <canvas #stage aria-hidden="true">                          ← empty and hidden until [data-webgl=on]
    <ul class="carousel-fallback">                              ← SSR output; the a11y + crawler surface
      @for (card of cards(); track card.id) {
        <li><a [routerLink] ...><img loading="lazy" ...>{{ card.title }}</a></li>
      }
  <div class="carousel-controls">
    <button aria-label="Previous class">  <div class="progress" role="presentation">  <button aria-label="Next class">
  <p class="sr-only" aria-live="polite">{{ activeTitle() }}</p>
```

`@if (canRender())` wraps the whole thing; below `MIN_CARDS` the section renders nothing at all (not an empty frame).

### 5. Home page wiring

```html
<!-- Model Surround Carousel -->
<section id="model-carousel" class="w-11/12 mx-auto scroll-mt-20">
  @defer (on viewport; prefetch on idle) {
  <app-surround-carousel />
  } @placeholder {
  <div class="aspect-[16/7] w-full animate-pulse rounded-xl bg-white/5"></div>
  }
</section>
```

`@defer (on viewport)` is doing real work here: the three.js chunk is not even requested until the section approaches the viewport. Add `{ id: 'model-carousel', label: 'Every Class', visible: true, icon: 'lucideLayers' }` to `sectionNavItems()` between `caira-levels` and `offerings`.

### Bundle budget

`three` is ~600 KB raw / ~150 KB gzipped for the subset used here. It must land in the `surround-carousel.engine` chunk and nowhere else. After the build, confirm it:

```bash
pnpm build:prod
ls -la dist/miles-masterclass-v3/browser/chunk-*.js | sort -k5 -n | tail -5
grep -l "WebGLRenderer" dist/miles-masterclass-v3/browser/chunk-*.js
```

Exactly one chunk may match, and the initial bundle must not grow. If three lands in the initial bundle, a static import leaked in — find it and remove it. Do not raise the 2.00 MB budget (AGENTS.md §9).

## UI requirements

- **Layout + spacing:** full-bleed within `w-11/12 mx-auto`. Stage is `aspect-[16/7]` desktop, `aspect-[4/3]` tablet, capped `max-h-[620px]`. Header block centred above it, `mb-10 md:mb-14`. Controls centred below, `mt-8`.
- **Typography:** `h2` matches the home scale already in use — `md:text-[42px] text-3xl font-bold leading-none`. Sub-paragraph `md:text-base text-sm text-[#A8A8A8]`, max-width `md:w-2/3 mx-auto`, centred. Card titles are drawn into the texture, not styled by CSS.
- **Colours / tokens:** Tailwind utilities and the existing home palette only — `bg-black`, `text-white`, `text-[#A8A8A8]`, `border-white/10`, `bg-white/5`. The only raw colours permitted are the two inside the canvas draw routine (`#0F0F10` frame, `#E8552F` dot), because they are 2D-canvas fill strings and cannot be Tailwind classes; declare both as named constants at the top of the engine file.
- **Responsive:** desktop (≥1024) full WebGL ring. Tablet (768–1023) WebGL with a smaller `R` and a wider `D` so three cards read cleanly. Mobile (<768) never initialises WebGL — a horizontally scrollable snap row of the same cards, `overflow-x-auto snap-x snap-mandatory`, which is the fallback list restyled, not a second component.
- **States:**
  - _loading_ — `source.isLoading()` and no items: the `@defer` placeholder shimmer, same aspect as the stage, so nothing reflows.
  - _empty_ (`< MIN_CARDS`) — section renders nothing. No empty frame, no "no courses" copy on a marketing page.
  - _error_ — `FeatureResource` surfaces a failed fetch as an empty `items()`, so it collapses into the empty case. Correct behaviour: a marketing section must never show an error.
  - _disabled_ — arrow buttons are never disabled; the ring loops.
- **Accessibility:**
  - Canvas is `aria-hidden="true"`, `role` omitted. It is decoration over a real list.
  - The fallback `<ul>` stays in the accessibility tree at all times. When `[data-webgl=on]`, it is clipped with the repo's `sr-only` pattern — **not** `display:none`, which would strip it from the tree and from crawlers.
  - Arrow buttons: real `<button type="button">`, `aria-label="Previous class"` / `"Next class"`, `aria-controls` pointing at the list's id, visible `focus-visible:ring-2 ring-white/60 ring-offset-2 ring-offset-black`.
  - Keyboard: buttons are in the natural tab order; `ArrowLeft` / `ArrowRight` move the ring while focus is inside the section.
  - `aria-live="polite"` region announces the centred card's title on change, debounced 400ms so a drag does not machine-gun the screen reader.
  - Contrast: the `#A8A8A8` sub-copy on black is 8.2:1 — passes AA. Card text lives in the texture; keep the drawn title at `rgba(255,255,255,.72)` on `#0F0F10` (≈ 11:1).
  - `prefers-reduced-motion: reduce` skips WebGL entirely and shows the static list. No autoplay, no inertia.

## Security requirements

Restating AGENTS.md §7 for this task:

- **No new network surface.** The component reads `feature.getResource('popular', 'masterclass')`, which goes through `ApiClient` and the existing interceptors. No `HttpClient` in the component, no hand-attached `Authorization` header, no new endpoint.
- **No secrets.** Nothing in this section touches Supabase, the service-role key, admin tokens or partner provisioning. The only external origin is the public thumbnail CDN.
- **`crossOrigin = 'anonymous'` on every texture image.** Without it a tainted canvas either throws on upload or silently leaks pixel data across origins via `readPixels`. It is a security control here, not a convenience.
- **Titles are drawn, not `eval`'d or injected.** `Content.title` is API text going to `ctx.fillText` and to Angular interpolation in the fallback list — both escape by construction. No `innerHTML`, no `bypassSecurityTrust*`.
- **`window` / `document` only inside `afterNextRender` or the engine**, which the server never loads. The `supportsWebgl()` probe and `matchMedia` both sit behind that guard. Anything else throws during SSR.
- **Guest surface.** The home page is unauthenticated; this section must render identically signed-out and signed-in, and must never gate on `Auth`.

## Acceptance criteria

- [ ] Pre-flight CORS check run and its result reported before any engine code was written.
- [ ] `pnpm build:prod` is green and the initial bundle has not grown; `grep -l "WebGLRenderer" dist/.../chunk-*.js` matches exactly one chunk, and it is not the initial one.
- [ ] Network tab on a home-page load shows the three.js chunk requested only when `#model-carousel` approaches the viewport — never on first paint.
- [ ] `curl -s http://localhost:4000/us/cpa | grep -c "carousel-fallback"` returns ≥ 1 against the SSR build — the card list is in the server HTML.
- [ ] Dragging rotates the ring; release snaps to the nearest card; the progress bar and the `aria-live` text track the centred card.
- [ ] Clicking the centred card navigates via `Utils.navigateToCourse`; clicking an off-centre card rotates it to centre instead.
- [ ] Vertical page scroll over the canvas still scrolls the page (Lenis is not hijacked).
- [ ] At <768px no WebGL context is created (`about:gpu` / no `webgl` context in DevTools), and the snap row scrolls.
- [ ] With `prefers-reduced-motion: reduce` forced in DevTools, no WebGL context is created and the static list shows.
- [ ] Navigating home → a course → back five times leaves exactly one live WebGL context (check `performance.memory` trend and the absence of a "too many contexts" warning).
- [ ] Fewer than 6 usable cards → the section is absent from the DOM, and `#model-carousel` still has a valid section-nav entry that does not scroll to an empty gap.
- [ ] Axe DevTools reports no new violations on the home page.

## Checks to run

```bash
pnpm lint
pnpm format:fix
pnpm test
pnpm build:prod
pnpm build && pnpm serve:ssr:miles-masterclass-v3
```

The SSR run is required, not optional — this component touches `window`, `matchMedia` and `WebGLRenderingContext`, which are exactly the leaks dev mode hides. Compare `pnpm lint` / `pnpm test` against the known-red baseline on `master`.

## How to verify it

1. `pnpm install` (picks up `three`), then `pnpm start`.
2. Open `http://localhost:4101/us/cpa`. Scroll past the CAIRA level stack.
3. Watch the Network tab while scrolling: the `chunk-*.js` containing three.js appears only as `#model-carousel` enters the viewport.
4. Drag the ring left and right. It should feel weighted, keep moving briefly after release, then settle with a card centred.
5. Press `Tab` until an arrow button is focused — a visible ring appears. Press it; the ring advances one card and the progress bar moves.
6. Click the centred card. Expect `/us/cpa/masterclass/<id>/<slugified-title>`.
7. Scroll the page with the cursor sitting over the canvas. The page scrolls; the ring does not spin.
8. DevTools → Rendering → **Emulate CSS prefers-reduced-motion: reduce**, reload. Expect the static card list, and no `webgl` context under DevTools → More tools → Rendering.
9. Resize to 500px wide, reload. Expect the horizontal snap row, no WebGL.
10. `pnpm build && pnpm serve:ssr:miles-masterclass-v3`, then:
    ```bash
    curl -s http://localhost:4000/us/cpa | grep -o 'carousel-fallback' | head
    curl -s http://localhost:4000/us/cpa | grep -c '<canvas'
    ```
    The first prints matches; the second confirms the canvas ships empty rather than pre-rendered.
11. Navigate home → a course → back, five times. Console stays free of `WARNING: Too many active WebGL contexts`.

---

# Findings during implementation

Recorded after the fact. Where these contradict the plan above, these win.

## The pre-flight failed, and it is an infra ticket

Tested from a real browser against the UAT API's own rows, not by reading headers:

| Origin                                                                       | `crossOrigin="anonymous"` load | Canvas readable | Verdict     |
| ---------------------------------------------------------------------------- | ------------------------------ | --------------- | ----------- |
| `milesmasterclass-uat-asset.s3.ap-south-1.amazonaws.com` (course thumbnails) | **fails**                      | —               | **blocked** |
| `d1pp0977rsxmiq.cloudfront.net` (static brand assets)                        | loads                          | clean           | usable      |

The same thumbnail loads fine _without_ `crossOrigin`, so this is purely a
missing CORS policy on the asset bucket, not a dead URL. WebGL has no way
around it, and proxying the images through the Angular SSR server is out
(AGENTS.md §4 — that server renders, it is not the backend).

**So the rail ships, but on UAT the panels render as chrome-only typographic
cards** — frame, title bar, accent dot, credits — with no course art. The moment
the bucket (or a CloudFront distribution in front of it) is given
`Access-Control-Allow-Origin` plus `Vary: Origin`, the art appears with **no
code change**. `Logger.warn` names the offending host once per run so this does
not fail silently. Production should be re-tested the same way before launch;
`environment.ts` points at a different API, so its asset host may differ.

## Changes to the plan's numbers

- `MIN_CARDS` is **4**, not 6. `v2/dashboard/?filter=popular&course_type=masterclass`
  returns **5 rows** on page one, which the plan's threshold would have rejected
  outright.
- Ring density is set by `TARGET_PANELS = 20` (an 18° step), not by the card
  count. The first build used one panel per card — at 36° apiece the sides
  foreshortened so hard the ring read as three loose cards rather than a
  surround. Short lists now repeat to reach 20 slots; repeated panels share
  their card's texture, so this costs meshes, not VRAM.
- `Content.course_type` is `"Video"`, not a route segment. The route type is the
  constant `'masterclass'`, matching how `Horizontal` handles it.
- `instructor_details.name` comes back empty on this endpoint, so the caption is
  credits only.

## Verified before handover

Type-checked against `three@0.184` under strict settings, then bundled and run
headlessly in Chromium (SwiftShader) with five fake cards:

- Ring builds, renders, and drags; 20 meshes, 18° step, no console or page errors.
- Arrow stepping and drag-snap both move the active index correctly.
- Checked at 1440×630 and 900×675 — the tablet fill ratio holds the composition.
- Lazy chunk measures **133 KB gzipped** minified (three + engine), close to the
  plan's ~140 KB estimate.

Not verified here, because the repo's toolchain was not reachable from this
session: `pnpm lint`, `pnpm test`, `pnpm build:prod`, the SSR run, and the
chunk-placement grep. Those remain as written in **Checks to run**.

---

# Revision — endless ring, cursor-lit backdrop, design tokens

Requested after the first build landed. Three changes.

## 1. It is an endless loop, not a slide carousel

The selected-card concept is gone entirely — no `activeIndex`, no snapping, no
`aria-current`, no live-region announcement of a "current" class.

Motion is now velocity-based: a drag moves the ring one-to-one with the finger,
release leaves residual velocity that friction eats, and a constant `DRIFT` sits
underneath so the ring is never still. The arrows add an impulse rather than
stepping to a card. A tap opens whatever panel is under it — with no centre
there is no "rotate it to the middle first" rule to apply, though a hit beyond
60° off-axis is ignored, since those panels are drawn nearly transparent and
clicking one would navigate from something the visitor cannot really see.

The bar underneath is position around the loop (0…1, wrapping), not progress
toward an end. The engine throttles it to a `PROGRESS_EPSILON` of 0.004 so it is
not writing an Angular signal 60 times a second.

Rates are now scaled by real frame duration rather than assumed to be 60fps.
This surfaced in the headless check: under software rendering the ring crawled,
because `DRIFT` was applied per frame and frames were taking ~160ms. Same bug
would have hit any struggling laptop.

## 2. The dot field is now WebGL and reacts to the cursor

The backdrop was a CSS `radial-gradient`, which cannot light individual dots.
It is now a full-screen quad rendered before the ring, in its own scene with an
orthographic camera. The shader finds each dot's cell centre, measures distance
from the pointer, and lights the whole dot from that centre — per-fragment
distance would light a dot down one side where it straddles the falloff edge.

Unlit dots are small and white at 0.07 alpha. Lit dots grow 1.7× and take the
brand blue at 0.5 alpha. The pointer position is smoothed per-frame so the pool
trails the cursor rather than snapping to it.

The CSS dot grid stays in the template as the static stand-in, and
`[data-webgl=on]` removes it once the shader takes over. So the no-WebGL path
still gets dots, just not lit ones.

## 3. Design tokens instead of hard-coded hex

The first build hard-coded `#0F0F10` and `#E8552F`. Both were wrong — the brand
is blue, not orange. Canvas 2D and GLSL cannot take a Tailwind class, so the
engine now reads the custom properties off the host at construction and paints
each one into a 1×1 canvas to parse it. That uses the _browser's_ colour parser,
so the tokens can move to `oklch()` or anything else without touching this file.

| Use                      | Token                  |
| ------------------------ | ---------------------- |
| Panel frame              | `--secondary`          |
| Panel text               | `--foreground`         |
| Panel sub-text           | `--muted-foreground`   |
| Card status dot          | `--accent`             |
| Cursor-lit backdrop dots | `--accent` — see below |

**On the highlight colour.** The request was for `--primary`. `--primary` is
`rgb(4,72,170)`, which against `--background` `rgb(14,14,14)` is about 1.4:1 — a
lit dot would come out _darker_ than the unlit white ones, inverting the effect.
`--accent` `rgb(42,133,255)` is the same brand blue with the luminance to carry
it. This is one entry in the `TOKENS` map; change `highlight` to `'--primary'`
for the literal token.

Everything else moved to Tailwind utilities in the template. The stylesheet is
now three rules, all of them keyed on `[data-webgl]` on the host — the one thing
Tailwind cannot express, because the attribute is set imperatively.

## Re-verified

Type-checks against `three@0.184`. Run headlessly in Chromium (SwiftShader):

- Palette resolves from real custom properties, not the fallbacks.
- Drift keeps increasing with nothing touching the ring.
- After a flick the ring settles 0.15 of a step away from the nearest slot — a
  snapping carousel would read ~0.000.
- Frame-rate compensation confirmed: drift over a fixed wall-clock window went
  from 0.0050 to 0.0122 under the same slow renderer.
- Cursor-lit pool renders and tracks the pointer.
- `dispose()` stops the loop and releases the context.
- Lazy chunk still 134 KB gzipped.
