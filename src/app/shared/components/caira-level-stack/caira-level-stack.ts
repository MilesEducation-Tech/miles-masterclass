/// <reference types="gsap" />
// ^ Loads GSAP's ambient global `gsap` namespace for the `gsap.MatchMedia` type
// without a runtime import — gsap is `sideEffects:false`, so a real top-level
// import would be tree-shaken and warn. Type-surface only.
import { httpResource } from '@angular/common/http';
import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';

import { Button } from '../../ui/button/button';
import { apiUrl } from '@core/services/api-client/api-client';
import { Utils } from '@shared/services/utils';
import { Viewport } from '@core/services/viewport/viewport';
import { BadgeV2Response, CairaLadderItem } from '@core/models/caira-badge.model';

const CAIRA_LOGO =
  'https://d1pp0977rsxmiq.cloudfront.net/static-assests/web-app/commons/caira-logo-white.webp';

/**
 * Scroll budget (px) while the section is pinned. Each card rests fully visible
 * for `HOLD_PX` before the next one cross-fades in over `FADE_PX`, and the last
 * card gets the same rest before the pin releases — so a reader sees every card
 * still, not only mid-fade. Three cards: 3 × 300 + 2 × 400 = 1700px. Tuned by
 * eye, not derived.
 */
const HOLD_PX = 300;
const FADE_PX = 400;
/**
 * How far (px) and how much smaller each receded card steps, per level behind
 * the active one. The card's top padding is 20px and its title line ~28px, so
 * one step shows a receded card's whole title row. Two levels (card 1 behind
 * card 3) lift 96px, which at a centred pin still clears the fixed header.
 */
const RECEDE_LIFT_PX = 48;
const RECEDE_SCALE_STEP = 0.1;

/** One card, after the API row and the local presentation copy are merged. */
export interface CairaLevelCard {
  rank: number;
  /** "Level 1" — rendered uppercase by CSS to match the design. */
  levelLabel: string;
  /** The API's `sub_text`, which is the design's card title verbatim. */
  title: string;
  /** Design-only copy; the ladder endpoint has no equivalent field. */
  subtitle: string;
  /** The API's `icon_url` — the hexagonal medal. */
  medalUrl: string;
  tone: 'bronze' | 'silver' | 'gold';
  /**
   * "Tossed on the table" tilt in degrees, from the reference pen. The design's
   * cross-fade stacks the cards on one rectangle, so the template does not
   * bind it today; the stylesheet reads `--tilt` on md+ if it ever is.
   */
  tilt: number;
}

/**
 * Per-level styling and the small tools line under each title. Keyed by
 * `level_rank`. These are design decisions, not content: `v2/caira-badges/`
 * carries no equivalent of the design's subtitle (its `description` is longer
 * prose and is retrieve-only, one extra request per level), and the gradient
 * and tilt are presentation.
 */
const LEVEL_PRESENTATION: Record<
  number,
  { subtitle: string; tone: CairaLevelCard['tone']; tilt: number }
> = {
  1: {
    subtitle: 'Copilot, Copilot Studio, Power Automate, Fabric & Power BI',
    tone: 'bronze',
    tilt: 3.58,
  },
  2: {
    subtitle: 'Ai Agents and workflows across CAS → CFO teams, Audit & Tax',
    tone: 'silver',
    tilt: -1.31,
  },
  3: {
    subtitle: 'Ai Agents and workflows across CAS → CFO teams, Audit & Tax',
    tone: 'gold',
    tilt: 1.81,
  },
};

/**
 * Rendered when the ladder request fails. This is a guest marketing section —
 * it must never collapse to an empty column. Titles mirror the live payload;
 * the medal slot stays empty and collapses.
 */
const FALLBACK_LEVELS: CairaLevelCard[] = [
  {
    rank: 1,
    levelLabel: 'Level 1',
    title: 'Foundations of AI in Accounting',
    medalUrl: '',
    ...LEVEL_PRESENTATION[1],
  },
  {
    rank: 2,
    levelLabel: 'Level 2',
    title: 'Advanced AI Applications in Accounting',
    medalUrl: '',
    ...LEVEL_PRESENTATION[2],
  },
  {
    rank: 3,
    levelLabel: 'Level 3',
    title: 'AI Strategy & Leadership in Accounting',
    medalUrl: '',
    ...LEVEL_PRESENTATION[3],
  },
];

/**
 * The CAIRA ladder list. A bare literal rather than a `*_ROUTES` entry because
 * that is what it was before this conversion; promoting it to the registry would
 * mean touching the tracker's readers too, which belongs to the `features/tracker`
 * row rather than here.
 */
const CAIRA_LADDER_URL = 'v2/caira-badges/';

const EMPTY_LADDER: BadgeV2Response<CairaLadderItem[]> = { data: [] };

/**
 * The CAIRA three-level pitch: copy on the left, cards on the right. On md+ the
 * whole grid pins once it is centred in the viewport and the cards cross-fade
 * in place as the user scrolls — the outgoing card dims and recedes, the next
 * one fades in on the same rectangle. Below md it is a snap carousel.
 */
@Component({
  selector: 'app-caira-level-stack',
  imports: [Button],
  templateUrl: './caira-level-stack.html',
  styleUrl: './caira-level-stack.css',
  host: { class: 'block' },
})
export class CairaLevelStack {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly utils = inject(Utils);
  private readonly viewport = inject(Viewport);
  protected readonly router = inject(Router);

  protected readonly cairaLogo = CAIRA_LOGO;

  /**
   * The same ladder the CAIRA tracker's badge page reads. Despite the comment on
   * `caira-level-hero`, the LIST endpoint answers anonymously (200, every level
   * `locked` with zero progress), so a guest home page can use it — and because
   * it needs no token there is no reason to skip it on the server. Params are
   * unconditional so this renders into the SSR HTML and hydrates from the
   * transfer cache rather than refetching — `httpResource` goes through
   * `HttpClient`, so the global `withHttpTransferCacheOptions` in `app.config.ts`
   * still covers it and no per-resource option is needed.
   */
  private readonly ladder = httpResource<BadgeV2Response<CairaLadderItem[]>>(
    () => apiUrl(CAIRA_LADDER_URL),
    { defaultValue: EMPTY_LADDER },
  );

  /**
   * `hasValue()` first: reading `.value()` on an errored resource throws and
   * would take the whole page down over a marketing section.
   */
  protected readonly levels = computed<CairaLevelCard[]>(() => {
    const rows = this.ladder.hasValue() ? (this.ladder.value()?.data ?? []) : [];
    if (!rows.length) return FALLBACK_LEVELS;

    return rows
      .filter((row) => LEVEL_PRESENTATION[row.badge.level_rank])
      .sort((a, b) => a.badge.level_rank - b.badge.level_rank)
      .map((row) => ({
        rank: row.badge.level_rank,
        levelLabel: row.badge.level_name ?? `Level ${row.badge.level_rank}`,
        title: row.badge.sub_text ?? row.badge.name,
        medalUrl: row.badge.icon_url ?? '',
        ...LEVEL_PRESENTATION[row.badge.level_rank],
      }));
  });

  private readonly localePrefix = computed(
    () => `/${this.utils.country()}/${this.utils.profession()}`,
  );
  protected readonly exploreLink = computed(() => [this.localePrefix(), 'caira']);
  protected readonly badgesLink = computed(() => [
    this.localePrefix(),
    'how-to-claim-credly-badge',
  ]);

  /** Index of the slide nearest centre in the mobile carousel, for the dots. */
  protected readonly activeSlide = signal(0);

  /**
   * Maps scroll progress onto slide index rather than measuring each slide:
   * with centre-snapping the first and last slides can't reach the centre, but
   * they always sit at 0% and 100% of the scroll range.
   */
  protected onTrackScroll(track: HTMLElement): void {
    const range = track.scrollWidth - track.clientWidth;
    if (range <= 0) return; // md+: the stack doesn't scroll sideways
    this.activeSlide.set(Math.round((track.scrollLeft / range) * (this.levels().length - 1)));
  }

  protected goToSlide(track: HTMLElement, index: number): void {
    // `block: 'nearest'` keeps the page itself from jumping vertically.
    track.children[index]?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    });
  }

  private mm?: gsap.MatchMedia;
  private destroyed = false;

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      // Reverts only this component's triggers and the inline styles they wrote.
      // Never ScrollTrigger.killAll() — that would clobber other components.
      this.mm?.revert();
      this.mm = undefined;
    });

    // `afterNextRender` never runs on the server, so it IS the SSR guard.
    afterNextRender(() => {
      // Both guards sit before the dynamic import so phones and reduced-motion
      // users never download the library at all. The cards then render in their
      // static CSS state, which is the correct end state for both.
      // ponytail: a mobile→desktop resize won't lazy-init gsap. Move this gate
      // into an effect on viewport.isHandheld() if that ever matters.
      if (this.viewport.isMobile()) return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      void this.initStack();
    });
  }

  /**
   * GSAP is imported dynamically on purpose: `import()` is an esbuild code-split
   * point, so gsap lands in its own on-demand chunk instead of being hoisted into
   * the shared chunk that every route pulling this component would load. Do NOT
   * add a top-level `import ... from 'gsap'` to this file — esbuild would then
   * fold the dynamic chunk back into the parent and silently undo the split.
   *
   * `provideGsap()` from ngx-gsap is not an option here: it returns
   * `EnvironmentProviders` (route injectors only), its own imports of gsap /
   * ScrollTrigger / SplitText / Lenis are static, and we use none of its
   * directives. See ai-labs.routes.ts for the case where it does earn its keep.
   */
  private async initStack(): Promise<void> {
    const [{ gsap }, { ScrollTrigger }] = await Promise.all([
      import('gsap'),
      import('gsap/ScrollTrigger'),
    ]);
    if (this.destroyed) return; // navigated away while the chunk was in flight
    gsap.registerPlugin(ScrollTrigger);

    const root = this.host.nativeElement;

    this.mm = gsap.matchMedia();
    // Below this width the cards simply flow down the page. matchMedia reverts
    // the pins and inline styles on the way out and rebuilds them on the way in,
    // so it doubles as the resize handler.
    this.mm.add('(min-width: 768px)', () => {
      // Scoping the lookup to `root` keeps two instances on one page from
      // cross-wiring.
      const cards = gsap.utils.toArray<HTMLElement>('.card', root);
      if (cards.length < 2) return;

      // One pin for the whole grid, one scrubbed timeline for every transition.
      // `start: 'center center'` is "sticky once the section is mid-screen";
      // the default pin spacing holds the page for the timeline's length.
      // Timeline time is in scroll pixels (durations are relative under
      // `scrub`), so `end` is simply the sum of the rests and the fades.
      const total = HOLD_PX * cards.length + FADE_PX * (cards.length - 1);
      const tl = gsap.timeline({
        defaults: { ease: 'none', duration: FADE_PX, transformOrigin: 'top center' },
        scrollTrigger: {
          trigger: root,
          start: 'center center',
          end: `+=${total}`,
          pin: true,
          scrub: true,
        },
      });

      // Transition i starts after card i's rest: every earlier card steps one
      // level further up and back (shrinking about its top edge, fully opaque,
      // so the strip that peeks above the next card stays readable) while card
      // i+1 rises in on the same spot. Scaling about `top center` tucks each
      // receded card's sides and bottom behind the one in front of it; only
      // its title row shows — a fanned deck with every earlier card visible.
      const hint = root.querySelector('.scroll-hint');
      cards.slice(1).forEach((card, i) => {
        const at = HOLD_PX * (i + 1) + FADE_PX * i;
        cards.slice(0, i + 1).forEach((prev, j) => {
          const level = i - j + 1;
          tl.to(prev, { scale: 1 - RECEDE_SCALE_STEP * level, y: -RECEDE_LIFT_PX * level }, at);
        });
        tl.fromTo(card, { opacity: 0, y: 32 }, { opacity: 1, y: 0 }, at);
        // The "more below" dashes go with the last card's arrival: there is
        // nothing below it.
        if (hint && i === cards.length - 2) tl.to(hint, { autoAlpha: 0 }, at);
      });
      // The last card's rest: nothing tweens, the pin just holds. GSAP would
      // otherwise end the timeline (and the pin) the moment the last fade lands.
      tl.to({}, { duration: HOLD_PX });
    });

    // ScrollTrigger resolves start/end to pixels once, at creation. The home page
    // defers two carousel blocks in on viewport, which changes document height
    // afterwards and silently mis-measures every trigger above — and that is not
    // covered by ScrollTrigger's default autoRefreshEvents.
    ScrollTrigger.refresh();
    this.watchLayout(ScrollTrigger);
  }

  /**
   * Re-measure when the document height changes under us. The `refreshing` flag
   * is the loop guard: `refresh()` itself resizes the document, which would wake
   * the observer and refresh again, forever. Ignore height changes while a
   * refresh is in flight.
   */
  private watchLayout(ScrollTrigger: typeof import('gsap/ScrollTrigger').ScrollTrigger): void {
    let timer: ReturnType<typeof setTimeout>;
    let refreshing = false;

    ScrollTrigger.addEventListener('refreshInit', () => (refreshing = true));
    ScrollTrigger.addEventListener('refresh', () => (refreshing = false));

    const ro = new ResizeObserver(() => {
      if (refreshing) return;
      clearTimeout(timer);
      timer = setTimeout(() => ScrollTrigger.refresh(), 150);
    });
    ro.observe(document.body);

    this.destroyRef.onDestroy(() => {
      clearTimeout(timer);
      ro.disconnect();
    });
  }
}
