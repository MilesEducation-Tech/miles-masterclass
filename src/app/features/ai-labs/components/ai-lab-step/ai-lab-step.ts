import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { JourneyStep, StepState } from '@features/ai-labs/utils/course-journey';
import { cn } from '@shared/utils/cn';

/**
 * `idle` — server render, or not measured yet: fully visible, no motion.
 * `armed` — below the fold on load: held back until scrolled to.
 * `shown` — revealed; also starts the score-ring fill (see the course page's CSS).
 */
type RevealPhase = 'idle' | 'armed' | 'shown';

/** The step number takes its state's colour; the rule beside it fades out from it. */
const INDEX: Record<StepState, string> = {
  done: 'text-accent',
  current: 'text-accent',
  attention: 'text-amber-400',
  locked: 'text-muted-foreground',
  open: 'text-muted-foreground',
};

const RULE: Record<StepState, string> = {
  done: 'bg-linear-to-r from-accent/40 to-transparent',
  current: 'bg-linear-to-r from-accent/60 to-transparent',
  attention: 'bg-linear-to-r from-amber-400/50 to-transparent',
  locked: 'bg-linear-to-r from-muted-foreground/30 to-transparent',
  open: 'bg-linear-to-r from-muted-foreground/30 to-transparent',
};

const CHIP: Record<StepState, string> = {
  done: 'border-accent/30 bg-accent/10 text-accent',
  current: 'border-accent/40 bg-accent/15 text-foreground',
  attention: 'border-amber-400/40 bg-amber-400/10 text-amber-400',
  locked: 'border-border bg-black/25 text-muted-foreground',
  open: 'border-border bg-black/25 text-muted-foreground',
};

const DOT: Record<StepState, string> = {
  done: 'bg-accent',
  current: 'bg-accent motion-safe:animate-pulse',
  attention: 'bg-amber-400',
  locked: 'bg-muted-foreground',
  open: 'bg-muted-foreground',
};

/**
 * One numbered step of the AI Lab course page: an index line (number, a rule tinted by the step's
 * state, the status chip), the heading, then the body. Where the learner is overall lives in the
 * page's sidebar navigator; this only says how this one step stands.
 *
 * Steps below the fold rise in as they're scrolled to. Only a step that starts off-screen is ever
 * hidden, and only in the browser — the server HTML and an above-the-fold step render as-is.
 * Ported from miles-masterclass-v3.
 */
@Component({
  selector: 'app-ai-lab-step',
  templateUrl: './ai-lab-step.html',
  host: {
    class: 'block',
    '[attr.data-reveal]': 'reveal()',
  },
})
export class AiLabStep {
  readonly index = input.required<string>();
  readonly heading = input.required<string>();
  readonly caption = input<string>();
  readonly step = input.required<JourneyStep>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly reveal = signal<RevealPhase>('idle');

  /** Header and body: held low and transparent while armed, eased up when shown. */
  protected readonly revealClass = computed(() =>
    cn(
      'transition-[opacity,translate] duration-700 ease-out motion-reduce:transition-none',
      this.reveal() === 'armed' && 'translate-y-6 opacity-0',
    ),
  );

  constructor() {
    // Browser-only by construction: `afterNextRender` never runs on the server.
    afterNextRender(() => {
      const motionOk = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!motionOk || typeof IntersectionObserver === 'undefined') {
        this.reveal.set('shown');
        return;
      }
      // The first callback reports where the step starts: in view → shown straight away, never
      // hidden; below the fold → armed until it arrives.
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            this.reveal.set('shown');
            observer.disconnect();
          } else if (this.reveal() === 'idle') {
            this.reveal.set('armed');
          }
        },
        { rootMargin: '0px 0px -12% 0px' },
      );
      observer.observe(this.host.nativeElement);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  protected readonly indexClass = computed(() => INDEX[this.step().state]);

  protected readonly ruleClass = computed(() => RULE[this.step().state]);

  protected readonly chipClass = computed(() =>
    cn(
      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11.5px] font-semibold whitespace-nowrap',
      CHIP[this.step().state],
    ),
  );

  protected readonly dotClass = computed(() => cn('size-1.5 rounded-full', DOT[this.step().state]));
}
