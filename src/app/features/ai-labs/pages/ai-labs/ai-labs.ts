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
import { Button } from '@shared/ui/button/button';
import { Carousel } from '@shared/components/carousel/carousel';
import { AiLabTermsDialog } from '@shared/dialogs/ai-lab-terms-dialog/ai-lab-terms-dialog';
import {
  UtilsDialog,
  UtilsDialogData,
  UtilsDialogResult,
} from '@shared/dialogs/utils-dialog/utils-dialog';
import { NgpDialogManager } from 'ng-primitives/dialog';
import { NotificationService } from '@core/services/notification/notification';
import { LanguageContext } from '@core/services/language-context/language-context';
import { Utils } from '@shared/services/utils';
import {
  AI_LAB_FAQS,
  AI_LAB_FEATURES,
  AI_LAB_TOOLS,
  AI_LAB_STATS,
  AI_LAB_STEPS,
  AI_LAB_TESTIMONIALS,
  AiLabAccountState,
  AiLabAgentCard,
  AiLabStat,
} from '@features/ai-labs/models/ai-labs.model';
import { AiLabsFacade } from '@features/ai-labs/services/ai-labs-facade';
import { isPlatformBrowser, NgTemplateOutlet } from '@angular/common';
import { iconCopilot, iconSparkle } from '@core/constants/icon';
import { environment } from '@env/environment';

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

/** Cards in the scroll-driven fan showcase. */
const FAN_SIZE = 5;

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
    Carousel, // Micro-interactions (motion.dev) — SSR-safe, reduced-motion aware.
    InViewDirective,
    HoverSpringDirective,
    PressDirective, // Scroll showpieces (GSAP) — marquee, count-up, pinned scrub.
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
   * ponytail: `AiLabsAuth`, the Microsoft/Entra sign-in that used to front Copilot Studio, went
   * with the auth layer. AI Labs now reads the Miles login token itself (`docs/AI_LABS_API.md` §2),
   * so this stub only keeps the hero's Entra branches compiling; `isSignedIn` is always false.
   * The Miles session and the lab account are `AiLabsFacade`'s.
   */
  protected readonly auth = {
    isSignedIn: signal(false),
    signingIn: signal(false),
    error: signal<string | null>(null),
    hint: signal<string | null>(null),
    identity: signal<string | null>(null),
  };
  /** The catalogue and the learner's lab account — see the facade for both reads. */
  protected readonly facade = inject(AiLabsFacade);
  private readonly dialogs = inject(NgpDialogManager);
  private readonly router = inject(Router);
  // The showcase's log and progress bar move along the reading direction.
  private readonly rtl = inject(LanguageContext).dir === 'rtl';
  private readonly utils = inject(Utils);
  private readonly destroyRef = inject(DestroyRef);
  private readonly notification = inject(NotificationService);
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
   * The hero tiles — marketing counts, the same for everyone.
   *
   * A plain array, not a `computed`: the learner's own figures used to flip in here once they had
   * submitted something, and that surface now lives in the progress panel below the fold instead.
   * The assessment layer went with it — the `AI_LABS.assessmentEnabled` env gate, the per-card
   * score badge and the "Submitted" pill are all gone from this page.
   */
  protected readonly heroStats: AiLabStat[] = AI_LAB_STATS;

  /**
   * The catalogue the template renders — one rail per section, from `AiLabsFacade.sections`.
   *
   * While the first read is out there are no sections yet, so a single unnamed loading rail stands
   * in for the skeleton. A settled-empty catalogue renders no rail at all.
   */
  protected readonly resolvedSections = computed(() => {
    const sections = this.facade.sections();
    if (!sections.length && this.facade.catalogueLoading()) {
      return [{ heading: '', loading: true, cards: [] as AiLabAgentCard[] }];
    }
    return sections.map((section) => ({ ...section, loading: false }));
  });

  /**
   * The fan carousel is a five-card showcase, dealt round-robin across the sections so one long
   * section can't fill it alone. A guest's catalogue is a single rail of courses, so it deals
   * straight from that.
   */
  protected readonly fanCards = computed(() => {
    const sections = this.resolvedSections().filter((s) => s.cards.length);
    const fan: { card: AiLabAgentCard; section: string }[] = [];
    for (let i = 0; fan.length < FAN_SIZE && sections.some((s) => i < s.cards.length); i++) {
      for (const s of sections) {
        if (i < s.cards.length && fan.length < FAN_SIZE) {
          fan.push({ card: s.cards[i], section: s.heading });
        }
      }
    }
    return fan;
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
   * Catalogue track rails, now at every width — the desktop grid is gone.
   *
   * `rewind` rather than `loop`: loop mode needs more slides than it shows and silently disables
   * itself below that, which is why the old config had to pad short tracks with a duplicated set.
   * Rewind just jumps back to the first slide at the end and works with any count.
   */
  protected readonly trackConfig: SwiperOptions = {
    rewind: true,
    spaceBetween: 19,
    slidesPerView: 1.15,
    freeMode: { enabled: false },
    pagination: false,
    breakpoints: {
      768: { slidesPerView: 2 },
      1024: { slidesPerView: 3 },
    },
  };

  /**
   * Index of the fan's active (centred) card. Written by `buildCardFan` as the
   * scroll moves the fan; read by the active-card caption (title + description).
   */
  protected readonly activeFanIndex = signal(0);

  /** The lab account exists. Server-owned — read off `account-ensure/`, never set here. */
  protected readonly hasLabAccount = this.facade.hasLabAccount;

  /** An account request is in flight (create or reset). */
  protected readonly submitting = this.facade.submitting;

  /** A create went out and the account is on its way — the poll is running, or will on reload. */
  protected readonly accountRequested = this.facade.accountRequested;

  /** An `account-ensure/` read is in flight — the Refresh button says "Checking…". */
  protected readonly accountLoading = this.facade.accountLoading;

  /**
   * The poll ran out (five minutes) and the account still isn't there. Without this the hero reads
   * as stuck — it swaps "Setting up your lab…" for "taking longer than expected" and keeps Refresh.
   */
  protected readonly stillPending = computed(
    () => this.facade.pollTimedOut() && !this.hasLabAccount(),
  );

  /**
   * Guests keep the neutral label: account state isn't knowable until they log in, so promising
   * them "Create account" would be guessing. So does a signed-in learner whose `account-ensure/`
   * hasn't answered yet, or who isn't eligible — `activate()` says why on click.
   */
  protected readonly ctaLabel = computed(() => {
    if (this.auth.isSignedIn()) return 'Launch AI Lab';
    if (this.auth.signingIn()) return 'Waiting for sign-in…';
    // Once the request is out the account is on its way, so the CTA becomes the login the emailed
    // credentials are for — not a second create.
    const state = this.facade.accountState();
    if (state?.reason === 'OK' && !this.hasLabAccount() && !this.accountRequested()) {
      return 'Create AI Lab account';
    }
    return 'Login to Miles AI Labs';
  });

  constructor() {
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
   * Card click — the page behind the tile: the masterclass course for a guest card, the lab's own
   * page for a learner's. `route` is relative to the locale prefix.
   */
  protected viewAgent(card: AiLabAgentCard): void {
    void this.router.navigate([this.utils.localePath(), ...card.route]);
  }

  /**
   * The hero button. Every gate lives here, in order, so the button can't skip one:
   *
   *  1. Signed in to Miles — guests are asked to sign in and brought back.
   *  2. Eligible — `account-ensure/` says `NO_CAIRA_ENROLLMENT` (point at plans) or
   *     `MISSING_REQUIRED_FIELDS` (point at the profile, which brings them back).
   *  3. An account — none yet and none on its way opens the participant agreement, then creates.
   *  4. Otherwise the account exists. AI Labs is entered from a lab's own page (Launch AI there),
   *     so the hero sends the learner to the catalogue to pick one.
   *
   * The page stays public — it's in the guest nav as a marketing page — so the gate is on the
   * action, not the route.
   */
  protected activate(): void {
    if (!this.facade.isAuthenticated()) {
      this.gatePrompt(
        'Login Required',
        'Sign in to your Miles account to access Miles AI Labs.',
        'Login',
        () => this.goWithRedirect('/auth/login'),
      );
      return;
    }

    const state = this.facade.accountState();
    // The read is still out (or failed): say nothing rather than guess.
    if (!state) return;

    if (this.blockedBy(state)) return;

    if (!this.hasLabAccount() && !this.accountRequested()) {
      this.openTerms();
      return;
    }

    this.scrollTo('catalogue-grid');
  }

  /** Participant agreement; the POST only happens if the user accepted. */
  private openTerms(): void {
    this.dialogs
      .open<void, boolean>(AiLabTermsDialog)
      .afterClosed.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((accepted) => {
        if (accepted === true) this.createAccount();
      });
  }

  /**
   * `account-create/` takes no body: the backend builds the account from the learner. The
   * agreement still gates the click, but its acceptance is no longer sent anywhere — see the plan's
   * backend question Q5.
   *
   * Provisioning is asynchronous (two to three minutes), so a 202 means "requested", not "ready":
   * the facade polls and the hero moves to its waiting state.
   */
  private createAccount(): void {
    this.facade
      .createAccount()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((state) => {
        switch (state?.reason) {
          case 'PROVISIONING_STARTED':
          case 'PROVISIONING_IN_PROGRESS':
            this.notification.success(
              'Account requested',
              "We're setting up your AI Lab. Check your email in a few minutes for your Miles AI Lab email and password.",
            );
            return;
          case 'ACCOUNT_EXISTS':
            if (state.entitlement_refresh_required) this.promptSignInAgain();
            else this.notification.info('Account ready', 'Your AI Lab account already exists.');
            return;
          case 'AI_LABS_DISABLED':
            this.notification.info(
              'AI Labs unavailable',
              'AI Labs is switched off right now. Please try again later.',
            );
            return;
          default:
            if (state && this.blockedBy(state)) return;
            this.notification.error(
              'Something went wrong',
              "We couldn't request your AI Lab account. Please try again.",
            );
        }
      });
  }

  /** Re-reads `account-ensure/` — the hero's manual fallback to the poll. */
  protected refreshStatus(): void {
    this.facade.refresh();
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

  /** `account-reset-password/`: AI Labs mails a reset link. Only reached through `confirmResend`. */
  private resendEmail(): void {
    this.facade
      .resetPassword()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((state) => {
        switch (state?.reason) {
          case 'RESET_EMAIL_SENT':
            this.notification.success(
              'Email sent',
              'Check your inbox for the link to set a new AI Lab password.',
            );
            return;
          case 'RESET_EMAIL_RATE_LIMITED':
            this.notification.info(
              'Too many requests',
              "You've asked for several reset emails. Please try again later.",
            );
            return;
          case 'ACCOUNT_NOT_CREATED':
            this.notification.info(
              'No account yet',
              "Your AI Lab account hasn't been created yet, so there is no password to reset.",
            );
            return;
          default:
            if (state && this.blockedBy(state)) return;
            this.notification.error(
              'Email not sent',
              "AI Labs couldn't send the reset email. Please try again shortly.",
            );
        }
      });
  }

  /**
   * The two eligibility refusals every account route can answer, said the same way wherever they
   * come back. True when one applied, so the caller stops.
   */
  private blockedBy(state: AiLabAccountState): boolean {
    if (state.reason === 'NO_CAIRA_ENROLLMENT' || !state.eligible) {
      this.gatePrompt(
        'CAIRA Required',
        'Miles AI Labs is part of CAIRA. Enrol in CAIRA to get your lab.',
        'View Plans',
        () => void this.router.navigate([this.utils.localePath('payment/plan')]),
      );
      return true;
    }
    if (state.reason === 'MISSING_REQUIRED_FIELDS') {
      this.gatePrompt(
        'Complete Your Profile',
        'Your AI Lab account needs your name and email on your Miles profile. Complete it and we’ll bring you back here.',
        'Complete Profile',
        () => this.goWithRedirect('/auth/profile'),
      );
      return true;
    }
    return false;
  }

  /**
   * The account exists but this login token predates it, and AI Labs reads the entitlement off the
   * token. The guide's instruction is a fresh login, so: sign out, then sign in and come back.
   */
  private promptSignInAgain(): void {
    this.gatePrompt(
      'Sign in again',
      'Your AI Lab account is ready. Sign in again to finish connecting it to your Miles login.',
      'Sign in again',
      () => void this.facade.signInAgain(),
    );
  }

  /** `/auth/login` and `/auth/profile` both read `redirect` back — the one convention for both. */
  private goWithRedirect(path: string): void {
    void this.router.navigate([path], { queryParams: { redirect: this.router.url } });
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
    this.dialogs
      .open<UtilsDialogData, UtilsDialogResult>(UtilsDialog, {
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
          maxWidth: '100%',
        },
      })
      .afterClosed.pipe(takeUntilDestroyed(this.destroyRef))
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
      .from(
        '.js-log',
        { opacity: 0, x: this.rtl ? 10 : -10, ease: 'none', stagger: 0.9, duration: 0.5 },
        0.4,
      )
      // Progress bar fills across the entire run.
      .from(
        '.js-progress-fill',
        {
          scaleX: 0,
          transformOrigin: this.rtl ? 'right center' : 'left center',
          ease: 'none',
          duration: steps,
        },
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
