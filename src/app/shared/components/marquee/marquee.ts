import { isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  Component,
  computed,
  contentChild,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  output,
  PLATFORM_ID,
  signal,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

@Component({
  selector: 'app-marquee',
  imports: [NgTemplateOutlet],
  templateUrl: './marquee.html',
  styleUrl: './marquee.css',
})
export class Marquee {
  private platformId = inject(PLATFORM_ID);
  private injector = inject(Injector);
  private isBrowser = isPlatformBrowser(this.platformId);

  // Inputs using the new input() function
  autoFill = input<boolean>(false);
  play = input<boolean>(true);
  pauseOnHover = input<boolean>(false);
  pauseOnClick = input<boolean>(false);
  direction = input<'left' | 'right' | 'up' | 'down'>('left');
  speed = input<number>(50);
  delay = input<number>(0);
  loop = input<number>(0);
  gradient = input<boolean>(false);
  gradientColor = input<string>('white');
  gradientWidth = input<number | string>(200);

  // Outputs using the new output() function
  finish = output<void>();
  cycleComplete = output<void>();
  mounted = output<void>();

  // Content Child
  itemTemplate = contentChild<TemplateRef<any>>(TemplateRef);

  // ViewChild using the new viewChild() function
  containerRef = viewChild<ElementRef<HTMLDivElement>>('container');
  marqueeRef = viewChild<ElementRef<HTMLDivElement>>('marquee');

  // Signals for reactive state
  containerWidth = signal<number>(0);
  marqueeWidth = signal<number>(0);
  multiplier = signal<number>(1);
  isMounted = signal<boolean>(false);

  private resizeObserver?: ResizeObserver;

  // Computed signals
  duration = computed(() => {
    const marqueeW = this.marqueeWidth();
    const containerW = this.containerWidth();
    const mult = this.multiplier();
    const spd = this.speed();
    const autoFill = this.autoFill();

    if (autoFill) {
      return (marqueeW * mult) / spd;
    } else {
      return marqueeW < containerW ? containerW / spd : marqueeW / spd;
    }
  });

  childrenArray = computed(() => {
    const mult = this.multiplier();
    return Array(Math.max(0, mult))
      .fill(0)
      .map((_, i) => i);
  });

  multipliedArray = computed(() => {
    const mult = this.multiplier();
    return Array(Math.max(0, mult - 1))
      .fill(0)
      .map((_, i) => i);
  });

  containerStyles = computed(() => ({
    '--pause-on-hover': !this.play() || this.pauseOnHover() ? 'paused' : 'running',
    '--pause-on-click':
      !this.play() || (this.pauseOnHover() && !this.pauseOnClick()) || this.pauseOnClick()
        ? 'paused'
        : 'running',
    '--width': this.direction() === 'up' || this.direction() === 'down' ? '100vh' : '100%',
    '--transform':
      this.direction() === 'up'
        ? 'rotate(-90deg)'
        : this.direction() === 'down'
          ? 'rotate(90deg)'
          : 'none',
  }));

  gradientStyles = computed(() => ({
    '--gradient-color': this.gradientColor(),
    '--gradient-width':
      typeof this.gradientWidth() === 'number'
        ? `${this.gradientWidth()}px`
        : String(this.gradientWidth()),
  }));

  marqueeStyles = computed(() => ({
    '--play': this.play() ? 'running' : 'paused',
    '--direction': this.direction() === 'left' ? 'normal' : 'reverse',
    '--duration': `${this.duration()}s`,
    '--delay': `${this.delay()}s`,
    '--iteration-count': this.loop() ? `${this.loop()}` : 'infinite',
    '--min-width': this.autoFill() ? 'auto' : '100%',
  }));

  childStyles = computed(() => ({
    '--transform':
      this.direction() === 'up'
        ? 'rotate(90deg)'
        : this.direction() === 'down'
          ? 'rotate(-90deg)'
          : 'none',
  }));

  constructor() {
    // Only run browser-specific code in the browser
    if (this.isBrowser) {
      // Use afterNextRender for DOM operations (only runs in browser)
      afterNextRender(
        () => {
          this.isMounted.set(true);
          this.calculateWidth();
          this.setupResizeObserver();
          this.mounted.emit();
        },
        { injector: this.injector },
      );

      // Effect to recalculate when autoFill or direction changes
      effect(
        () => {
          this.autoFill();
          this.direction();
          if (this.isMounted()) {
            this.calculateWidth();
          }
        },
        { injector: this.injector },
      );
    } else {
      // SSR: Set mounted to true immediately for server rendering
      this.isMounted.set(true);
      // Set default multiplier for SSR
      this.multiplier.set(1);
    }

    inject(DestroyRef).onDestroy(() => {
      // Only cleanup browser-specific resources
      if (this.isBrowser && this.resizeObserver) {
        this.resizeObserver.disconnect();
      }
    });
  }

  private calculateWidth(): void {
    // Skip if not in browser
    if (!this.isBrowser) return;

    const container = this.containerRef()?.nativeElement;
    const marquee = this.marqueeRef()?.nativeElement;

    if (container && marquee) {
      const containerRect = container.getBoundingClientRect();
      const marqueeRect = marquee.getBoundingClientRect();

      let containerWidth = containerRect.width;
      let marqueeWidth = marqueeRect.width;

      if (this.direction() === 'up' || this.direction() === 'down') {
        containerWidth = containerRect.height;
        marqueeWidth = marqueeRect.height;
      }

      if (this.autoFill() && containerWidth && marqueeWidth) {
        this.multiplier.set(
          marqueeWidth < containerWidth ? Math.ceil(containerWidth / marqueeWidth) : 1,
        );
      } else {
        this.multiplier.set(1);
      }

      this.containerWidth.set(containerWidth);
      this.marqueeWidth.set(marqueeWidth);
    }
  }

  private setupResizeObserver(): void {
    // Skip if not in browser or ResizeObserver not available
    if (!this.isBrowser || typeof ResizeObserver === 'undefined') return;

    const container = this.containerRef()?.nativeElement;
    const marquee = this.marqueeRef()?.nativeElement;

    if (container && marquee) {
      this.resizeObserver = new ResizeObserver(() => this.calculateWidth());
      this.resizeObserver.observe(container);
      this.resizeObserver.observe(marquee);
    }
  }

  onAnimationIteration(): void {
    this.cycleComplete.emit();
  }

  onAnimationEnd(): void {
    this.finish.emit();
  }
}
