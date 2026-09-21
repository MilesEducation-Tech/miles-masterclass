import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  resource,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowLeft, lucideArrowRight } from '@ng-icons/lucide';
import { firstValueFrom, fromEvent, takeUntil } from 'rxjs';

import { ApiClient } from '../../core/services/api-client/api-client';
import { Content } from '../../core/models/course.model';
import { ContentResponse, TRACK_ROUTES } from '../../core/models/track.model';
import { Logger } from '../../core/services/logger/logger';
import { Utils } from '../../core/services/utils/utils';
import { Viewport } from '../../core/services/viewport/viewport';

// `import type` is erased at compile time, so naming the engine here does NOT
// create a static edge to it — `three` stays in the dynamic chunk. See the
// header comment in surround-carousel.engine.ts.
import type { SurroundEngine } from './surround-carousel.engine';

/** One panel on the ring, flattened from `Content` so the engine never sees the API model. */
export interface CarouselCard {
  id: number;
  title: string;
  /** Absolute CDN URL, or `''` when the course has no artwork. */
  image: string;
  /** Bottom-left overlay, e.g. `1 CPE credit`. */
  caption: string;
  /**
   * Router commands for the course page. Present so the fallback row renders
   * real `<a href>`s — that is what makes it crawlable and middle-clickable,
   * and it is the whole reason the row is the SSR output rather than a stub.
   */
  link: string[];
}

/** The AI Lab track. Its courses are what this rail shows. */
const AI_LAB_TRACK_ID = 7;

/**
 * The API's `course_type` (snake_case) and the URL's segment (kebab-case) are
 * different strings for the same thing, and `Utils` maps between them in half a
 * dozen places. Both are named here so neither is guessed at the use site.
 */
const AI_LAB_API_TYPE = 'ai_lab';
const AI_LAB_ROUTE_SEGMENT = 'ai-labs';

/**
 * Below this there is no ring to build. Deliberately low because the track is
 * small: at the time of writing `v2/tracks/7/courses/` returns 2 rows on UAT,
 * and the engine repeats the set to fill the ring rather than us paginating for
 * rows that do not exist.
 *
 * Be aware of what that means visually: a surround ring shows roughly six
 * panels at once, so two distinct courses tile as A B A B A B. The section is
 * honest but obviously repetitive until the track carries ~5 courses.
 */
const MIN_CARDS = 2;

/** Beyond this we would be uploading textures nobody scrolls to. */
const MAX_CARDS = 8;

/** Gap between cards in the fallback row, in px. Mirrors the template's `gap-4`. */
const FALLBACK_GAP = 16;

const EMPTY_RESPONSE: ContentResponse = { status_code: 200, data: [] };

/**
 * The AI Lab rail: course cards on the wall of a cylinder that turns forever.
 *
 * It is an endless loop, not a slide carousel — there is no selected card, no
 * snapping and no "current" index. Dragging changes how fast the ring turns;
 * friction and a constant drift do the rest, so it never comes to rest on
 * anything. The bar underneath reads position around the loop, which is why it
 * wraps instead of filling up.
 *
 * Two presentations, and every visitor gets exactly one of them:
 *   1. WebGL ring — desktop/tablet, motion allowed, WebGL present.
 *   2. Static snap row — everything else, and the SSR output.
 *
 * Both render the same list markup. `[data-webgl=on]` changes only how it is
 * presented, so the course links stay in the accessibility tree and in the
 * crawled HTML no matter which presentation a visitor gets.
 */
@Component({
  selector: 'app-surround-carousel',
  imports: [NgIcon, RouterLink],
  templateUrl: './surround-carousel.html',
  styleUrl: './surround-carousel.css',
  providers: [provideIcons({ lucideArrowLeft, lucideArrowRight })],
  // The arrow-key listener lives on the host, not on a wrapper div. It is a
  // container-level listener that fires on keys bubbling up from the focusable
  // things inside (the arrow buttons, the card links), so putting it on a plain
  // div made `interactive-supports-focus` — correctly — complain that the
  // element could never be focused. The alternative, `tabindex="0"` on the div,
  // would have silenced the rule by adding a tab stop that goes nowhere.
  host: { class: 'block', '(keydown)': 'onKeydown($event)' },
})
export class SurroundCarousel {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly api = inject(ApiClient);
  private readonly viewport = inject(Viewport);
  private readonly logger = inject(Logger);
  private readonly utils = inject(Utils);

  private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('stage');
  private readonly listRef = viewChild<ElementRef<HTMLElement>>('list');

  /**
   * One read, straight through `ApiClient` — same shape as `caira-level-stack`,
   * which is the precedent for a shared marketing component that needs a single
   * endpoint and has no facade of its own.
   *
   * The track endpoint answers anonymously (verified: 200 with no token), so
   * this renders for guests and needs no auth gate. Params are unconditional so
   * it renders into the SSR HTML and hydrates from the transfer cache rather
   * than refetching.
   */
  private readonly courses = resource({
    params: () => ({}),
    loader: ({ abortSignal }) =>
      firstValueFrom(
        this.api
          .get<ContentResponse>(
            TRACK_ROUTES.trackContent.path.replace(':id', String(AI_LAB_TRACK_ID)),
            { params: { course_type: AI_LAB_API_TYPE } },
          )
          .pipe(takeUntil(fromEvent(abortSignal, 'abort'))),
        { defaultValue: EMPTY_RESPONSE },
      ),
  });

  private readonly localePrefix = computed(
    () => `/${this.utils.country()}/${this.utils.profession()}`,
  );

  /**
   * `hasValue()` first: reading `.value()` on an errored resource throws, and a
   * failed marketing fetch must collapse to an absent section, never take the
   * home page down.
   */
  protected readonly cards = computed<CarouselCard[]>(() => {
    const rows = this.courses.hasValue() ? (this.courses.value()?.data ?? []) : [];
    const prefix = this.localePrefix();

    return (rows as Content[])
      .filter((row) => !!(row.horizontal_thumbnail || row.thumbnail))
      .slice(0, MAX_CARDS)
      .map((row) => ({
        id: row.id,
        title: row.title,
        image: row.horizontal_thumbnail || row.thumbnail,
        caption: creditLabel(row.class_credits),
        link: [prefix, AI_LAB_ROUTE_SEGMENT, String(row.id), this.utils.slugify(row.title)],
      }));
  });

  protected readonly canRender = computed(() => this.cards().length >= MIN_CARDS);

  /**
   * Position around the loop, 0…1 — not a card index. It wraps forever, so the
   * bar reads as a place in an endless run rather than progress toward an end.
   * The engine throttles its updates; this is not written every frame.
   */
  protected readonly progress = signal(0);

  /** Set once the three capability gates pass. See the constructor. */
  private readonly webglAllowed = signal(false);

  private engine?: SurroundEngine;
  private initStarted = false;
  private destroyed = false;

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      // Disposal is not optional here: browsers cap live WebGL contexts at
      // ~16, and an SPA that leaks one per home-page visit kills the tab after
      // a dozen navigations with nothing useful in the console.
      this.engine?.dispose();
      this.engine = undefined;
    });

    // `afterNextRender` never runs on the server, so it IS the SSR guard for
    // the `window` / `matchMedia` / WebGL touches below. It only records that
    // WebGL is *allowed* — it deliberately does not start the engine.
    afterNextRender(() => {
      // All three gates sit before the dynamic import so phones and
      // reduced-motion users never download three.js at all. They get the
      // static row, which is the correct end state for both — a ring that never
      // stops turning is exactly what `prefers-reduced-motion` asks us not to
      // render.
      if (this.viewport.isMobile()) return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      if (!supportsWebgl()) return;
      this.webglAllowed.set(true);
    });

    // Startup is driven by signals, not by `afterNextRender`, and that ordering
    // is load-bearing. `afterNextRender` fires once, immediately after first
    // paint — at which point the courses request has not resolved, `canRender()`
    // is false, and the `@if` around the stage means the canvas does not exist
    // yet. Starting the engine there caught a permanently empty ring and gave
    // up, so the WebGL path never ran at all.
    //
    // Reading `canvasRef()` and `cards()` here makes both dependencies, so this
    // re-runs when the request lands AND when the canvas is finally created,
    // whichever is last. After that it is the path that feeds refetches in.
    effect(() => {
      const canvas = this.canvasRef()?.nativeElement;
      const cards = this.cards();

      if (!this.webglAllowed() || !canvas || cards.length < MIN_CARDS) return;
      if (this.engine) {
        this.engine.setCards(cards);
        return;
      }
      if (this.initStarted) return; // import in flight
      this.initStarted = true;
      void this.initEngine(canvas);
    });
  }

  protected previous(): void {
    if (this.engine) this.engine.nudge(-1);
    else this.scrollRow(-1);
  }

  protected next(): void {
    if (this.engine) this.engine.nudge(1);
    else this.scrollRow(1);
  }

  /**
   * Arrow keys drive the rail while focus is anywhere inside the section, which
   * is what makes the control pair genuinely operable rather than decorative.
   */
  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowLeft') {
      this.previous();
      event.preventDefault();
    } else if (event.key === 'ArrowRight') {
      this.next();
      event.preventDefault();
    }
  }

  /**
   * Without WebGL the arrows scroll the real row, so they move something the
   * visitor can see rather than an invisible index.
   */
  private scrollRow(direction: number): void {
    const row = this.listRef()?.nativeElement;
    if (!row) return;
    const card = row.querySelector('li');
    const stride = card ? card.getBoundingClientRect().width + FALLBACK_GAP : row.clientWidth * 0.8;
    row.scrollBy({ left: direction * stride, behavior: 'smooth' });
  }

  private openCard(index: number): void {
    const card = this.cards()[index];
    if (!card) return;
    // `navigateToCourse` uses the segment verbatim — it does not map
    // `ai_lab` → `ai-labs` the way `buildCourseUrl` does, so pass the URL form.
    this.utils.navigateToCourse(AI_LAB_ROUTE_SEGMENT, card.id, card.title);
  }

  private async initEngine(canvas: HTMLCanvasElement): Promise<void> {
    const { SurroundEngine } = await import('./surround-carousel.engine');
    if (this.destroyed) return; // navigated away while the chunk was in flight

    this.engine = new SurroundEngine(canvas, {
      onProgress: (fraction) => this.progress.set(fraction),
      onSelect: (index) => this.openCard(index),
      onTextureBlocked: (host) =>
        this.logger.warn(
          `[surround-carousel] ${host} serves no Access-Control-Allow-Origin, ` +
            `so its images cannot be uploaded as WebGL textures. Cards render ` +
            `without artwork until a CORS policy is added to that origin.`,
        ),
    });

    // Read fresh rather than closing over the effect's snapshot: a refetch may
    // have landed while the chunk was downloading, and nothing re-runs the
    // effect once `this.engine` is set by this line.
    this.engine.setCards(this.cards());

    // Flips the static row to its screen-reader-only presentation and reveals
    // the canvas. Done here, not in the template, so the row is the visible
    // thing until the ring is actually ready to draw — no empty black box.
    this.host.nativeElement.dataset['webgl'] = 'on';
  }
}

/** "1 CPE credit" / "0.5 CPE credits" — the track's courses are fractional. */
function creditLabel(credits: number | null | undefined): string {
  if (!credits) return 'AI Lab';
  return `${credits} CPE credit${credits === 1 ? '' : 's'}`;
}

/**
 * Cheap capability probe. A context is created and immediately dropped rather
 * than kept, because holding one here would spend a slot from the browser's
 * small per-page budget before the real renderer asks for its own.
 */
function supportsWebgl(): boolean {
  try {
    const probe = document.createElement('canvas');
    return !!(probe.getContext('webgl2') ?? probe.getContext('webgl'));
  } catch {
    return false;
  }
}
