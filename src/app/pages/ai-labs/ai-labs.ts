/// <reference types="gsap" />
// ^ Loads GSAP's ambient global `gsap` namespace for the buildShowcase() type
// (`gsap.core.Timeline`) without a runtime import — gsap is `sideEffects:false`,
// so a real import would be tree-shaken and warn. Type-surface only.
import {
  Component,
  DestroyRef,
  ElementRef,
  PLATFORM_ID,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowRight,
  lucideAward,
  lucideCheck,
  lucideCircleCheck,
  lucideClipboardCheck,
  lucideDatabase,
  lucideFileCheck,
  lucideGift,
  lucideGraduationCap,
  lucideLayers,
  lucideLogIn,
  lucidePlay,
  lucideQuote,
  lucideRocket,
  lucideShieldCheck,
  lucideSparkles,
  lucideTriangleAlert,
  lucideUpload,
  lucideWandSparkles,
  lucideZap,
} from '@ng-icons/lucide';
import {
  MarqueeDirective,
  CountUpDirective,
  ScrubTimelineDirective,
} from '@code_with_sachin/ngx-gsap';
import {
  InViewDirective,
  HoverSpringDirective,
  PressDirective,
} from '@code_with_sachin/ngx-motion';
import type { SwiperOptions } from 'swiper/types';
import { Button } from '@shared/components/ui/button/button';
import { Carousel } from '@shared/components/carousel/carousel';
import {
  AiLabAgentCard,
  AiLabAgentDialog,
  AiLabAgentDialogResult,
} from '@shared/components/dialog/ai-lab-agent-dialog/ai-lab-agent-dialog';
import { AiLabTermsDialog } from '@shared/components/dialog/ai-lab-terms-dialog/ai-lab-terms-dialog';
import { UtilsDialog } from '@shared/components/dialog/utils-dialog/utils-dialog';
import { DurationPipe } from '@core/pipes/duration/duration-pipe';
import { CommonResponse, SKIP_ERROR_NOTIFICATION } from '@core/models/http.model';
import { MASTERCLASS_ROUTES } from '@core/models/masterclass.model';
import { ApiClient } from '@core/services/api-client/api-client';
import { Dialog } from '@core/services/dialog/dialog';
import { NotificationService } from '@core/services/notification/notification';
import { Storage } from '@core/services/storage/storage';
import { Utils } from '@core/services/utils/utils';
import {
  AI_LAB_FAQS,
  AI_LAB_FEATURES,
  AI_LAB_TOOLS,
  AI_LAB_ROUTES,
  AI_LAB_SECTIONS,
  AI_LAB_STATS,
  AI_LAB_STEPS,
  AI_LAB_TESTIMONIALS,
  AiLabChapter,
  AiLabStat,
} from './ai-labs.model';
import { AiLabSubmission } from './ai-lab-submission';
import { HttpContext } from '@angular/common/http';
import { isPlatformBrowser, NgTemplateOutlet } from '@angular/common';
import { iconCopilot, iconSparkle } from '@core/constants/icon';
import { environment } from '@env/environment';

/**
 * Remembers that a provisioning request already went out, so a reload during the
 * ~1 minute wait doesn't invite the user to POST a second account. Session-scoped
 * on purpose: the server flag is the real source of truth, this is only what
 * bridges the gap until it flips.
 */
const ACCOUNT_REQUESTED_KEY = 'ai_lab.account_requested';

/**
 * Number of webp frames in public/ai-labs/frames (0001…NNNN.webp), exported from
 * the source clip. The 2nd-fold scroll-reveal scrubs through these. Keep in sync
 * with the files on disk if the clip is re-exported.
 */
const AI_LAB_REVEAL_FRAMES = 241;

/**
 * Pixels of horizontal drag before the mobile card fan steps. Below this a
 * pointer is a tap on the card, not a swipe on the deck.
 */
const FAN_SWIPE_THRESHOLD = 40;

/**
 * AI Labs landing page — dark editorial marketing page fronting the prebuilt
 * agent catalogue.
 *
 * Built entirely from project primitives (`app-button`, `ng-icon`, Tailwind
 * utilities over the site tokens) — the page declares no colour of its own, so
 * it moves with the palette instead of pinning a second one beside it. How the
 * source design's raw values were mapped:
 *
 *   - **#000000 canvas** → `--background`. The site canvas is rgb(14,14,14);
 *     forcing pure black would make this the only page that disagrees with the
 *     header and footer sitting above and below it.
 *   - **#3399ff accent** → `--accent` (rgb 42,133,255), the blue the rest of
 *     the site already uses for CTAs, 2 points off the source. The hero button
 *     is `variant="primary"` re-pointed with `bg-accent`, which is the project's
 *     own idiom; `--primary` is the deep navy and reads wrong here.
 *   - **#0c0f14 card surface** → `--muted`, the project's most-used card
 *     surface. It sits one step *above* `--background`, exactly the relationship
 *     the source pair has.
 *   - **#1f242c hairline** → `--border`. **#acb5c4 / #a1a1a1 body copy** →
 *     `--muted-foreground`.
 *   - **Hover #1a8cff** → `hover:bg-accent/90`, the DS opacity-shift convention,
 *     rather than a second blue.
 *   - **15px / 8–10px radii** → `rounded-2xl` and `rounded-xl` (`--radius-xl` is
 *     exactly 10px).
 *   - **Metal gradient text** — the one treatment with no DS equivalent, so
 *     `--ai-metal` / `.ai-metal-text` is a scoped extension. Its stops are the
 *     DS foreground ramp (`--muted-foreground` → `--foreground`), not new hexes.
 *     25° for section headings, horizontal for card titles, solid
 *     `--foreground` fallback.
 *   - **Serif display face** — the DS *does* have one (`--font-serif`,
 *     Source Serif 4), so `font-serif` is used rather than pulling in Playfair.
 *     Only the hero H1 is serif: in the design the section headings and card
 *     titles are set in the bold sans, so those stay on the DS `--font-sans`.
 *   - **Open Sans body** — mapped to the DS `--font-sans` (Inter). Both are
 *     humanist sans faces; adding a second body font for one page isn't worth
 *     the request.
 *   - **0.78px hairline border** — sub-pixel; rendered as the DS 1px.
 *   - **Breakpoints** — the design's 1199/1024/768/640 map onto Tailwind's
 *     xl/lg/md/sm almost exactly, so DS breakpoints are used throughout.
 *
 * Artwork (card thumbnails, bottom decorative band) has no assets yet: cards
 * fall back to a gradient placeholder, and the band renders its fade structure
 * over a placeholder. Set `thumbnail` on the agent data to fill them in.
 */
@Component({
  selector: 'app-ai-labs',
  imports: [
    Button,
    NgIcon,
    NgTemplateOutlet,
    DurationPipe,
    Carousel,
    // Micro-interactions (motion.dev) — SSR-safe, reduced-motion aware.
    InViewDirective,
    HoverSpringDirective,
    PressDirective,
    // Scroll showpieces (GSAP) — marquee, count-up, pinned scrub.
    MarqueeDirective,
    CountUpDirective,
    ScrubTimelineDirective,
  ],
  providers: [
    provideIcons({
      lucideLogIn,
      lucideFileCheck,
      lucideRocket,
      lucideWandSparkles,
      lucideGift,
      lucideShieldCheck,
      lucideGraduationCap,
      lucideLayers,
      lucideClipboardCheck,
      lucideSparkles,
      lucideArrowRight,
      lucidePlay,
      lucideQuote,
      lucideAward,
      lucideUpload,
      lucideCircleCheck,
      lucideTriangleAlert,
      lucideDatabase,
      lucideZap,
      lucideCheck,
    }),
  ],
  templateUrl: './ai-labs.html',
  styleUrl: './ai-labs.css',
  host: { class: 'ai-labs block overflow-x-hidden' },
})
export class AiLabs {
  /**
   * ponytail: `AiLabsAuth` (the Microsoft/Entra sign-in that fronts Copilot
   * Studio) and the platform session service were both removed with the auth
   * layer. These two stubs exist only so `ai-labs.html` keeps rendering its
   * signed-out hero — re-inject the real services to bring the flow back.
   */
  protected readonly auth = {
    isSignedIn: signal(false),
    signingIn: signal(false),
    error: signal<string | null>(null),
    hint: signal<string | null>(null),
    identity: signal<string | null>(null),
  };
  protected readonly milesAuth = {
    isLoadingProfile: signal(false),
  };
  private readonly dialog = inject(Dialog);
  private readonly router = inject(Router);
  private readonly utils = inject(Utils);
  private readonly destroyRef = inject(DestroyRef);
  // ponytail: two POSTs used by this page alone, so no facade. Extract one the
  // moment a second caller needs them.
  private readonly apiClient = inject(ApiClient);
  private readonly notification = inject(NotificationService);
  private readonly storage = inject(Storage);
  protected readonly submission = inject(AiLabSubmission);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /**
   * Phone-sized viewport (<768). The pinned GSAP stages below (`ngxScrub`) each
   * cost 140–320% of scroll at 100vh, which is the whole screen on a phone, so
   * the steps / workspace / catalogue swap to mobile-shaped variants.
   *
   * Only usable BELOW the hero: everything down there is inside
   * `@defer (on viewport)` and never server-rendered, while `Viewport` reports
   * `desktop` on the server — an `@if (isMobile())` in the SSR'd hero would
   * hydrate from the wrong branch. The hero's own mobile treatment is CSS.
   */
  protected readonly isMobile = this.utils.isMobile;

  /** Scroll-reveal canvas (webp frame sequence). Absent on the server. */
  private readonly revealCanvas = viewChild<ElementRef<HTMLCanvasElement>>('revealCanvas');

  /** Container of the scroll-driven fan carousel of agent cards. */
  private readonly cardFan = viewChild<ElementRef<HTMLElement>>('cardFan');

  /** Draws a given frame index to the reveal canvas — shared by the poster
   *  (afterNextRender) and the scroll scrub (buildReveal). Null until set up. */
  private revealDraw: ((index: number) => void) | null = null;
  private revealInited = false;

  /** Hero frame-sequence preload progress (0–100) and the reveal gate. */
  protected readonly assetProgress = signal(0);
  protected readonly assetsReady = signal(false);
  /** Shared decoded hero frames — the preloader fills them, buildReveal draws them. */
  private readonly revealFrames: (HTMLImageElement | undefined)[] = new Array(AI_LAB_REVEAL_FRAMES);
  /** Set by buildReveal so the preloader can repaint the canvas as frames land. */
  private revealRedraw: (() => void) | null = null;
  private framesRequested = false;

  protected readonly sections = AI_LAB_SECTIONS;
  protected readonly copilotIcon = iconCopilot;
  protected readonly sparkleIcon = iconSparkle;

  protected readonly eyebrow = ['No code', 'No client data', 'No setup', '12 months included'];

  // Landing-page editorial content (see ai-labs.model.ts). Static display copy,
  // no API contract — the template is a thin renderer over these.
  protected readonly steps = AI_LAB_STEPS;
  protected readonly features = AI_LAB_FEATURES;
  protected readonly faqs = AI_LAB_FAQS;
  /**
   * The testimonial rail's slides. Four quotes is one short of what Swiper wants
   * before it turns `loop` off (`slides < slidesPerView + loopedSlides`), so the
   * set is rendered twice — the same padding the track rails need.
   *
   * ponytail: goes away as soon as there are five or more real quotes.
   */
  protected readonly testimonialSlides = [...AI_LAB_TESTIMONIALS, ...AI_LAB_TESTIMONIALS];
  protected readonly tools = AI_LAB_TOOLS;

  /**
   * Env gate for the whole evaluation/assessment layer — the submit panel, the
   * per-card score badge, and the hero "your progress" strip. Off until the
   * grading backend is ready (see environment.ts `AI_LABS.assessmentEnabled`).
   */
  protected readonly assessmentEnabled = environment.AI_LABS.assessmentEnabled;

  /** True once the learner has submitted at least one workflow (gated). */
  protected readonly hasSubmissions = computed(
    () => this.assessmentEnabled && this.submission.overall().submitted > 0,
  );

  /**
   * The hero's three count-up tiles. Before the first submission they carry the
   * marketing counts (`AI_LAB_STATS`); once the learner has submitted anything
   * they flip to that learner's own progress — submitted, overall score, passed
   * — which is the "overall score in the hero" surface. Same shape either way,
   * so the template's `ngxCountUp` strip just re-animates on the switch.
   */
  protected readonly heroStats = computed<AiLabStat[]>(() => {
    const o = this.submission.overall();
    if (!this.assessmentEnabled || !o.submitted) return AI_LAB_STATS;
    return [
      { value: o.submitted, label: 'Agents submitted' },
      { value: o.avgScore, suffix: '%', label: 'Overall score' },
      { value: o.passed, label: 'Passed' },
    ];
  });

  /**
   * Chapter id → its submitted report, for the per-card score badge. A computed
   * (not a method) so the template reads a signal by index instead of calling a
   * method on every change-detection pass.
   */
  protected readonly reports = computed(() =>
    this.assessmentEnabled ? this.submission.submissions() : {},
  );

  /**
   * Chapters per course id. `undefined` means still loading; `[]` means the
   * fetch finished with nothing, whether it failed or the course is genuinely
   * empty. The distinction that matters is loading vs settled — a settled empty
   * result is what triggers the static fallback below.
   */
  private readonly chapters = signal<Record<number, AiLabChapter[] | undefined>>({});

  /**
   * The catalogue the template renders. Both origins produce the same card
   * shape, so the grid and the detail dialog never branch on where a tile came
   * from.
   *
   * The course wins whenever it returns anything. A failed fetch and an empty
   * course are treated identically — both mean "no live catalogue" — and fall
   * back to the section's static agents, so the page is never a bare heading
   * over an empty grid. That fallback is also what renders on UAT, where the
   * production course ids don't resolve.
   */
  protected readonly resolvedSections = computed(() =>
    this.sections.map((section) => {
      const loaded = section.courseId === undefined ? undefined : this.chapters()[section.courseId];
      const chapters = loaded ?? [];
      // At most three cards per section, whichever source they come from.
      const cards = (
        chapters.length
          ? chapters.map((c, i): AiLabAgentCard => ({
              name: c.chapter_name,
              description: c.description,
              // Static webp artwork, positionally (agents mirror the chapters in
              // order), not the API's chapter_thumbnail. No fallback: a tile with
              // no static image (e.g. PBC) is meant to show the gradient placeholder.
              thumbnail: section.agents?.[i]?.thumbnail,
              thumbnailAlt: section.agents?.[i]?.thumbnailAlt ?? c.chapter_name,
              durationSeconds: c.video_duration,
              questionCount: c.quiz_details?.total_questions,
              // Lets the detail dialog pull the course-level "about" payload.
              courseId: section.courseId,
              // The exercise key: the submit panel and its score store against this.
              chapterId: c.id,
            }))
          : (section.agents ?? []).map((a): AiLabAgentCard => ({
              name: a.name,
              // The design sets the shared "Agent" suffix in a lighter weight
              // than the distinctive name. Chapter titles don't take it.
              nameSuffix: ' Agent',
              description: a.description,
              thumbnail: a.thumbnail,
              thumbnailAlt: a.thumbnailAlt ?? `${a.name} Agent`,
            }))
      ).slice(0, 3);

      return {
        heading: section.heading,
        loading: section.courseId !== undefined && loaded === undefined,
        cards,
        /**
         * What the phone's track rail renders (the desktop grid uses `cards`).
         * Swiper turns `loop` off when a rail has no more slides than it shows,
         * which three cards at 1.15 per view is — so render the set twice.
         *
         * ponytail: this only exists because of the three-card cap above. Lift
         * the cap and `slides` collapses back to `cards`. Same padding trick the
         * powered-by marquee uses for its short list.
         */
        slides: cards.length < 4 ? [...cards, ...cards] : cards,
      };
    }),
  );

  /**
   * The fan carousel is a five-card showcase with a fixed spread across the
   * three tracks: two from the first, two from the second, one from the third.
   * Falls short only if a track has fewer cards than asked.
   */
  protected readonly fanCards = computed(() => {
    const sections = this.resolvedSections();
    const take = (i: number, n: number) => {
      const s = sections[i];
      return s ? s.cards.slice(0, n).map((card) => ({ card, section: s.heading })) : [];
    };
    return [...take(0, 2), ...take(1, 2), ...take(2, 1)];
  });

  /** Testimonials rail: one centred quote, neighbours shrunk and faded. */
  protected readonly peekWideConfig: SwiperOptions = {
    loop: true,
    centeredSlides: true,
    slidesPerView: 1.15,
    spaceBetween: 16,
    freeMode: { enabled: false },
    pagination: { clickable: true, dynamicBullets: true },
    // Loop needs slidesPerView * 2 <= slide count, and there are four quotes —
    // 2.4 per view trips Swiper's "not enough slides" warning and drops loop.
    breakpoints: {
      768: { slidesPerView: 1.6 },
      1024: { slidesPerView: 1.8 },
    },
  };

  /**
   * Catalogue track rails. Phone only — from `md` up the tracks go back to the
   * 2/3-column grid — so there are no breakpoints to declare here.
   */
  protected readonly trackConfig: SwiperOptions = {
    loop: true,
    spaceBetween: 19,
    slidesPerView: 1.15,
    freeMode: { enabled: false },
    pagination: false,
  };

  /**
   * Index of the fan's active (centred) card. Written by `buildCardFan` as the
   * scroll moves the fan; read by the active-card caption (title + description).
   */
  protected readonly activeFanIndex = signal(0);

  /**
   * Whether the Microsoft account behind the lab exists yet. Server-owned — the
   * page never sets it, it only re-reads the profile and waits for it to flip.
   */
  protected readonly hasLabAccount = signal(false);

  /** An account request is in flight (create or resend). */
  protected readonly submitting = signal(false);

  /** A request went out and the set-password email is on its way. */
  protected readonly accountRequested = signal(false);

  private readonly refreshAttempted = signal(false);

  /**
   * A refresh finished and the account still isn't there. Without this the
   * button reads as dead — nothing on screen changes when the answer is "not
   * yet". Derived rather than timed: `isLoadingProfile` is set synchronously by
   * `fetchMyProfile`, so this can't flash true between click and response.
   */
  protected readonly stillPending = computed(
    () => this.refreshAttempted() && !this.hasLabAccount(),
  );

  /**
   * Guests keep the neutral label: account state isn't knowable until they log
   * in, so promising them "Create account" would be guessing.
   */
  protected readonly ctaLabel = computed(() => {
    if (this.auth.isSignedIn()) return 'Launch AI Lab';
    if (this.auth.signingIn()) return 'Waiting for sign-in…';
    return 'Login to Miles AI Labs';
  });

  constructor() {
    this.accountRequested.set(this.storage.getSession<string>(ACCOUNT_REQUESTED_KEY) === 'true');
    this.loadChapters();
    // Browser-only, after the canvas is in the DOM. afterNextRender never runs on
    // the server, so the hero SSRs as a static (dark) stage. Sets up the reveal
    // canvas (poster + frame loading) independently of the scroll scrub, so a
    // reduced-motion visitor — where ngxScrub may not fire — still sees frame 0.
    afterNextRender(() => {
      this.loadHeroFrames(); // drive the preloader even if the canvas isn't ready yet
      this.initRevealCanvas();
    });

    // Mobile has no scrub to lay the deck out, so paint it once the fan is in the
    // DOM (it renders inside the page's @defer block, hence the viewChild signal
    // rather than afterNextRender) and again whenever the catalogue data lands.
    effect(() => {
      const fan = this.cardFan();
      const cards = this.fanCards().length;
      if (!fan || !cards || !this.isMobile()) return;
      untracked(() => this.paintFan(this.activeFanIndex()));
    });
  }

  /**
   * Catalogue fetch. Deliberately NOT gated on `isBrowser` like the library
   * facades' `resource()` calls: this is a public, indexed marketing page, so
   * the cards have to be in the server-rendered HTML. Running on the server is
   * enough to get that — `HttpClient` registers its own pending task, so SSR
   * waits for the response, and `withHttpTransferCacheOptions` in app.config.ts
   * serialises it into the page so the browser reuses it instead of refetching.
   * That config is the whole cache story here; there is nothing to hand-roll.
   *
   * One request per section rather than a `forkJoin`, so a slow course can't
   * hold up the ones that already answered. Errors resolve to an empty section
   * — `SKIP_ERROR_NOTIFICATION` keeps a catalogue hiccup from throwing a toast
   * at someone who is just reading the page.
   */
  private loadChapters(): void {
    for (const section of this.sections) {
      const courseId = section.courseId;
      if (courseId === undefined) continue;

      this.apiClient
        .get<CommonResponse<AiLabChapter[]>>(MASTERCLASS_ROUTES.getCourseChapter.path, {
          params: { id: courseId, course_type: 'masterclass' },
          context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true),
        })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (res) => this.setChapters(courseId, res?.data ?? []),
          error: () => this.setChapters(courseId, []),
        });
    }
  }

  private setChapters(courseId: number, list: AiLabChapter[]): void {
    this.chapters.update((map) => ({ ...map, [courseId]: list }));
  }

  /**
   * Card detail. The dialog is read-only; its Launch button routes back through
   * `activate()` so the login / plan / agreement gate stays in one place.
   */
  protected openAgent(card: AiLabAgentCard): void {
    this.dialog
      .open<AiLabAgentDialog, AiLabAgentDialogResult>(AiLabAgentDialog, {
        maxWidth: '100%',
        ariaLabel: card.name,
        enterAnimationDuration: '300ms',
        exitAnimationDuration: '300ms',
        data: card,
      })
      .afterClosed$.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (result === 'launch') this.activate();
      });
  }

  /**
   * One handler behind the hero button and every card's Launch button: signed
   * out starts the popup sign-in, signed in opens Copilot Studio. Keeping it
   * single means a card click can't diverge from the hero's state — and it's
   * the single place the two access gates below have to live.
   *
   * The lab is licensed per Miles subscriber, so neither the Entra sign-in nor
   * the Copilot hand-off may happen until the visitor is (1) signed in to Miles
   * and (2) on an active plan. The page itself stays public — it's in the guest
   * nav as a marketing page — so the gate is on the action, not the route.
   *
   * Every card launches the same Copilot Studio environment — `AiLabAgent` has
   * no per-agent destination, so there is nothing to pass through yet. Add a
   * URL (or agent id) to the model and thread it into `launchCopilot` when the
   * agents get individual deep links.
   */
  protected activate(): void {
    // ponytail: inert. This gated on a Miles session, then an active plan,
    // then a provisioned Microsoft account, before handing off to
    // `AiLabsAuth.signIn()` / `launchCopilot()`. All three checks and the
    // hand-off went with the auth layer.
  }

  /** Participant agreement; the POST only happens if the user accepted. */
  private openTerms(): void {
    this.dialog
      .open<AiLabTermsDialog, boolean>(AiLabTermsDialog, {
        maxWidth: '100%',
        ariaLabel: 'Miles AI Labs participant agreement',
        enterAnimationDuration: '300ms',
        exitAnimationDuration: '300ms',
      })
      .afterClosed$.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((accepted) => {
        if (accepted === true) this.createAccount();
      });
  }

  /**
   * The user comes off the auth token, so the body carries only the consent
   * record — hard-coded `true` because this is only ever reached from an
   * accepted agreement. Provisioning is asynchronous (~1 minute), so a 200 means
   * "requested", not "ready": the page moves to the check-your-email state and
   * waits for the profile flag.
   *
   * Errors are already toasted by the HTTP interceptor, so the error path here
   * only has to release the button.
   */
  private createAccount(): void {
    this.submitting.set(true);
    this.apiClient
      .post(AI_LAB_ROUTES.createAccount.path, { ai_lab_terms_accepted: true })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.accountRequested.set(true);
          this.storage.setSession(ACCOUNT_REQUESTED_KEY, 'true');
          this.notification.success(
            'Account requested',
            "We're creating your AI Lab account. Check your email in a minute for the link to set your password.",
          );
        },
        error: () => this.submitting.set(false),
      });
  }

  /**
   * Re-reads the profile so the server-owned `is_ai_lab_user` flag can flip the
   * hero over to sign-in. Deliberately manual: provisioning takes about a
   * minute, and one button press is cheaper than polling every visitor.
   */
  protected refreshStatus(): void {
    // ponytail: re-read the profile so the server-owned `is_ai_lab_user` flag
    // could flip the hero over to sign-in. No profile endpoint wired up now.
    this.refreshAttempted.set(true);
  }

  /**
   * Confirm before resending: this isn't a harmless "didn't get the email"
   * retry, it invalidates the password the user may already be signed in with.
   * The hero copy warns, but a warning next to a button is easy to click past.
   */
  protected confirmResend(): void {
    this.gatePrompt(
      'Resend account email?',
      'This will generate a brand-new password and permanently deactivate any password previously used by this user.',
      'Resend email',
      () => this.resendEmail(),
      'Cancel',
    );
  }

  /**
   * Same shape as `createAccount`, different endpoint: the backend resets the
   * AI Lab password and re-sends the set-password email. Only reached through
   * `confirmResend`.
   */
  private resendEmail(): void {
    this.submitting.set(true);
    this.apiClient
      .post(AI_LAB_ROUTES.resendAccountEmail.path, {})
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.notification.success(
            'Email sent',
            'Check your inbox for the link to set a new AI Lab password.',
          );
        },
        error: () => this.submitting.set(false),
      });
  }

  /**
   * Confirm-before-acting for the access gates and the resend, on the shared
   * `UtilsDialog` rather than a page-specific component.
   *
   * Matches on `action === 'confirm'` rather than a bare truthy check: the
   * dialog's `close` action resolves to `{ result: false }`, which is truthy —
   * and `cancel` resolves to `{ result: true }`, so the check has to be on the
   * action either way.
   *
   * `cancelLabel` is opt-in: the two access gates offer a single way forward,
   * while a destructive confirm needs an explicit way out.
   */
  private gatePrompt(
    title: string,
    message: string,
    cta: string,
    onConfirm: () => void,
    cancelLabel?: string,
  ): void {
    this.dialog
      .open<UtilsDialog, { action?: string; result: boolean }>(UtilsDialog, {
        maxWidth: '100%',
        enterAnimationDuration: '300ms',
        exitAnimationDuration: '300ms',
        disableClose: false,
        data: {
          title,
          containerClass: '',
          content: [{ type: 'text', value: message }],
          buttons: [
            ...(cancelLabel
              ? ([{ label: cancelLabel, variant: 'outline', action: 'cancel' }] as const)
              : []),
            { label: cta, variant: 'default', action: 'confirm' },
          ],
        },
      })
      .afterClosed$.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((res) => {
        if (res?.action === 'confirm') onConfirm();
      });
  }

  // ponytail: both drove the Entra session — inert without `AiLabsAuth`.
  protected switchAccount(): void {
    // ponytail: inert
  }

  protected signOut(): void {
    // ponytail: inert
  }

  /**
   * Secondary hero CTA — jump to the product showcase. Native anchor scrolling
   * gets tangled with the router's hash handling, so this scrolls the element
   * directly. Browser-only; `scroll-mt-*` on the target handles the header gap.
   */
  protected scrollTo(id: string): void {
    if (!this.isBrowser) return;
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /**
   * Populates the pinned showcase timeline emitted by `ngxScrub`. The directive
   * scopes a `gsap.context()` to the section, so these selectors only match the
   * mock's own layers, and it reverts on destroy. Uses `.from()` so the natural
   * (final) CSS state is `progress(1)` — which is exactly where reduced-motion
   * users are dropped, fully visible with nothing mid-animation.
   */
  protected buildShowcase(tl: gsap.core.Timeline): void {
    // Everything is built with `.from()`, so the NATURAL (progress-1) state is the
    // finished run: nodes lit, every step checked, log filled, progress full,
    // status "Completed", success card + glow in. That is also what SSR and
    // reduced-motion render — a complete, correct workflow, never a half-run.
    //
    // Scrubbing backwards from there reads as: idle (Ready) → the spine fills and
    // each node checks off top-to-bottom as its log line lands → Completed.
    const steps = 6;
    tl
      // Ambient panel glow eases in first.
      .from('.js-mock-glow', { opacity: 0, ease: 'none', duration: 0.4 }, 0)
      // Execution "cursor": the accent spine grows top→bottom across the whole run.
      .from(
        '.js-spine-fill',
        { scaleY: 0, transformOrigin: 'top center', ease: 'none', duration: steps },
        0,
      )
      // Nodes wake from dim to full as the cursor reaches them.
      .from('.js-node', { opacity: 0.3, ease: 'none', stagger: 1, duration: 1 }, 0.2)
      // Each step checks off with a little pop, in sequence.
      .from(
        '.js-check',
        { opacity: 0, scale: 0.2, ease: 'back.out(2)', stagger: 1, duration: 0.6 },
        0.6,
      )
      // Run log types in line by line, tracking the steps.
      .from('.js-log', { opacity: 0, x: -10, ease: 'none', stagger: 0.9, duration: 0.5 }, 0.4)
      // Progress bar fills across the entire run.
      .from(
        '.js-progress-fill',
        { scaleX: 0, transformOrigin: 'left center', ease: 'none', duration: steps },
        0,
      )
      // Status: Ready → Running → Completed (stacked pills cross-fade).
      .to('.js-status-idle', { opacity: 0, ease: 'none', duration: 0.4 }, 0.3)
      .from('.js-status-run', { opacity: 0, ease: 'none', duration: 0.4 }, 0.3)
      .to('.js-status-run', { opacity: 0, ease: 'none', duration: 0.4 }, steps - 0.6)
      .from('.js-status-done', { opacity: 0, y: 6, ease: 'none', duration: 0.5 }, steps - 0.5)
      // Success: the report card and its glow land at the end.
      .from(
        '.js-success',
        { opacity: 0, y: 14, scale: 0.96, ease: 'back.out(1.4)', duration: 0.6 },
        steps - 0.6,
      )
      .from('.js-success-glow', { opacity: 0, ease: 'none', duration: 0.8 }, steps - 0.8);
  }

  /** S3 URL for hero frame `i` (0-based). Frames are 0001.webp … NNNN.webp. */
  private frameSrc(i: number): string {
    return `${environment.S3_BUCKET_URL}static-assests/web-app/miles-ai-labs/hero-frames/${String(
      i + 1,
    ).padStart(4, '0')}.webp`;
  }

  /**
   * Eagerly load the whole hero frame sequence, driving the 0→100% preloader.
   * The decoded images are shared with `buildReveal` (one download, not two).
   * Errors count toward progress too, so a missing frame can't stall the gate,
   * and a hard timeout reveals the page even if the network hangs.
   */
  private loadHeroFrames(): void {
    if (this.framesRequested) return;
    this.framesRequested = true;

    const total = AI_LAB_REVEAL_FRAMES;
    let done = 0;
    const bump = (): void => {
      done++;
      this.assetProgress.set(Math.round((done / total) * 100));
      this.revealRedraw?.();
      if (done >= total) this.assetsReady.set(true);
    };

    for (let i = 0; i < total; i++) {
      const img = new Image();
      img.decoding = 'async';
      img.onload = bump;
      img.onerror = bump;
      img.src = this.frameSrc(i);
      this.revealFrames[i] = img;
    }

    // Safety net: never trap the visitor behind a stalled asset.
    const timer = setTimeout(() => this.assetsReady.set(true), 15000);
    this.destroyRef.onDestroy(() => clearTimeout(timer));
  }

  /**
   * Sets up the reveal canvas: cover-fit draw of the shared frames, a resize
   * handler, and a poster (frame 0). Runs from `afterNextRender` so it's up
   * regardless of the scroll scrub — a reduced-motion visitor (where `ngxScrub`
   * may never fire) still gets a static frame. Idempotent.
   */
  private initRevealCanvas(): void {
    if (this.revealInited) return;
    const canvas = this.revealCanvas()?.nativeElement;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    this.revealInited = true;

    const total = AI_LAB_REVEAL_FRAMES;
    const frames = this.revealFrames;
    let current = 0;

    // Nearest already-decoded frame to `target`, searching outward — so a
    // half-loaded sequence still draws something close rather than nothing.
    const pick = (target: number): HTMLImageElement | undefined => {
      for (let d = 0; d < total; d++) {
        const lo = target - d;
        const hi = target + d;
        if (lo >= 0 && frames[lo]?.complete && frames[lo]!.naturalWidth) return frames[lo];
        if (hi < total && frames[hi]?.complete && frames[hi]!.naturalWidth) return frames[hi];
      }
      return undefined;
    };

    const draw = (index: number): void => {
      current = Math.max(0, Math.min(total - 1, index));
      const img = pick(current);
      if (!img) return;
      const cw = canvas.width;
      const ch = canvas.height;
      const scale = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
      const dw = img.naturalWidth * scale;
      const dh = img.naturalHeight * scale;
      ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
    };

    const resize = (): void => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr));
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr));
      draw(current);
    };

    this.revealDraw = draw;
    // Repaint as frames decode — the poster appears the moment frame 0 lands.
    this.revealRedraw = () => draw(current);

    resize();
    window.addEventListener('resize', resize);
    // The canvas is absolute inside a pinned stage, so its box can be 0 / wrong at
    // init and no window `resize` ever fires. Observe the element itself so it
    // re-sizes and redraws the moment it gets real dimensions.
    const ro = new ResizeObserver(() => resize());
    ro.observe(canvas);
    this.loadHeroFrames();

    this.destroyRef.onDestroy(() => {
      this.revealDraw = null;
      this.revealRedraw = null;
      ro.disconnect();
      window.removeEventListener('resize', resize);
    });
  }

  protected buildReveal(tl: gsap.core.Timeline): void {
    // Canvas + poster are owned by initRevealCanvas (already run from
    // afterNextRender); this only maps scroll position → frame index. `.from`
    // isn't used (unlike the showcase): the natural state is frame 0.
    this.initRevealCanvas();
    const state = { f: 0 };
    tl.to(state, {
      f: AI_LAB_REVEAL_FRAMES - 1,
      ease: 'none',
      duration: 1,
      onUpdate: () => this.revealDraw?.(Math.round(state.f)),
    });
  }

  /**
   * Scroll-driven fan carousel (supah's codepen xxJMbbg, GSAP-scroll variant).
   * Maps the pinned `ngxScrub` progress to an active index and writes each card's
   * `--active` (its normalised offset from active → the CSS translate/rotate) and
   * `--zi` (stack + opacity). The CSS `transition` animates the fan between
   * discrete active positions, so this only writes vars — no per-frame layout.
   *
   * The live NodeList is re-read each update, so cards that arrive after the
   * chapter fetch (async) join the fan without a rebuild.
   */
  /**
   * Writes the fan's per-card CSS vars for a given active index — the one place
   * the deck's geometry is decided, shared by the desktop scrub and the mobile
   * swipe so both produce the identical arc.
   *
   * `wrap` is the difference between the two: the scroll deck runs 0 → n-1 in a
   * straight line (a card is either ahead of you or behind you), while the swipe
   * deck takes the short way round, so stepping past the last card carries on
   * into the first instead of rewinding the whole spread.
   */
  private paintFan(active: number): void {
    const el = this.cardFan()?.nativeElement;
    if (!el) return;
    const items = el.querySelectorAll<HTMLElement>('.ai-fan-item');
    const n = items.length;
    if (!n) return;

    const wrap = this.isMobile();
    const half = Math.floor(n / 2);
    items.forEach((item, i) => {
      // Signed distance from the active card. Wrapped: -half…+half, so the far
      // card crosses from one end of the arc to the other while it's the most
      // faded and furthest back — which is what makes the loop read as a loop.
      const offset = wrap ? ((((i - active) % n) + n + half) % n) - half : i - active;
      const depth = Math.abs(offset);
      // The phone shows three cards — centre plus one either side — so anything
      // further out parks at the edge card's position, hidden behind it, and
      // slides in from there on the next step instead of teleporting across the
      // arc. Desktop spreads the whole deck, so it uses the raw offset.
      const placed = wrap ? Math.max(-1, Math.min(1, offset)) : offset;
      // Active card on top; neighbours step down — same ramp as the source.
      item.style.setProperty('--zi', String(n - depth));
      item.style.setProperty('--active', String(placed / n));
      item.style.setProperty('--depth', String(depth));
      // A parked card is invisible but still occupies its slot, so it would eat
      // taps aimed at the empty space beside the fan.
      item.style.pointerEvents = wrap && depth > 1 ? 'none' : '';
    });
  }

  /**
   * Populates the pinned fan timeline emitted by `ngxScrub` (desktop). The
   * scroll position picks the active card; `paintFan` does the geometry.
   */
  protected buildCardFan(tl: gsap.core.Timeline): void {
    if (!this.cardFan()) return;

    const update = (progress: number): void => {
      const n = this.fanCards().length;
      if (!n) return;
      // Drives the active-card caption; signal equality no-ops the repeats.
      const active = Math.round((progress / 100) * (n - 1));
      this.activeFanIndex.set(active);
      this.paintFan(active);
    };

    update(0);
    const state = { p: 0 };
    tl.to(state, { p: 100, ease: 'none', duration: 1, onUpdate: () => update(state.p) });
  }

  /** Moves the fan by `delta` cards, wrapping at either end. */
  protected stepFan(delta: number): void {
    const n = this.fanCards().length;
    if (!n) return;
    const active = (((this.activeFanIndex() + delta) % n) + n) % n;
    this.activeFanIndex.set(active);
    this.paintFan(active);
  }

  private fanPointerX: number | null = null;

  protected onFanPointerDown(event: PointerEvent): void {
    this.fanPointerX = event.clientX;
  }

  /**
   * A horizontal drag past the threshold steps the deck; anything shorter is
   * left alone so it stays a tap on the card underneath (which opens the agent
   * dialog). Right-to-left — the natural "next" direction — advances.
   */
  protected onFanPointerUp(event: PointerEvent): void {
    const startX = this.fanPointerX;
    this.fanPointerX = null;
    if (startX === null) return;
    const dx = event.clientX - startX;
    if (Math.abs(dx) < FAN_SWIPE_THRESHOLD) return;
    this.stepFan(dx < 0 ? 1 : -1);
  }
}
