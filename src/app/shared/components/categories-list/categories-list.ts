import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  EmbeddedViewRef,
  inject,
  Injector,
  input,
  PLATFORM_ID,
  Renderer2,
  signal,
  TemplateRef,
  viewChild,
  viewChildren,
  ViewContainerRef,
} from '@angular/core';
import { FieldOfStudy } from '../../core/models/course.model';

@Component({
  selector: 'app-categories-list',
  standalone: true,
  templateUrl: './categories-list.html',
  host: {
    class: 'block min-w-0 max-w-full',
  },
})
export class CategoriesList {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly injector = inject(Injector);
  private readonly renderer = inject(Renderer2);
  private readonly vcr = inject(ViewContainerRef);
  private readonly document = inject(DOCUMENT);

  readonly items = input<FieldOfStudy[]>([]);
  readonly separator = input<string>(', ');
  readonly moreLabel = input<string>('more');
  readonly align = input<'start' | 'center' | 'end'>('start');
  readonly showCredits = input<boolean>(false);

  readonly containerRef = viewChild<ElementRef<HTMLDivElement>>('container');
  readonly moreRef = viewChild<ElementRef<HTMLElement>>('moreRef');
  private readonly measureItems = viewChildren<ElementRef<HTMLElement>>('measureItem');
  private readonly tooltipTemplate = viewChild<TemplateRef<unknown>>('tooltipTemplate');

  private readonly visibleCount = signal<number>(-1);
  readonly tooltipVisible = signal<boolean>(false);
  readonly tooltipTop = signal<number>(0);
  readonly tooltipLeft = signal<number>(0);

  readonly visibleItems = computed(() => {
    const list = this.items();
    const count = this.visibleCount();
    const n = count < 0 ? list.length : Math.min(count, list.length);
    return list.slice(0, n);
  });

  readonly hiddenCount = computed(() => {
    const count = this.visibleCount();
    if (count < 0) return 0;
    return Math.max(0, this.items().length - count);
  });

  readonly hiddenItems = computed(() => {
    const list = this.items();
    const count = this.visibleCount();
    if (count < 0) return [];
    return list.slice(count);
  });

  private resizeObserver?: ResizeObserver;
  private canvasCtx?: CanvasRenderingContext2D;
  private tooltipView: EmbeddedViewRef<unknown> | null = null;

  private readonly onScrollHide = () => this.hideTooltip();

  constructor() {
    if (this.isBrowser) {
      afterNextRender(
        () => {
          this.setupCanvas();
          this.setupResizeObserver();
          this.recompute();
        },
        { injector: this.injector },
      );

      effect(
        () => {
          this.items();
          this.separator();
          this.showCredits();
          this.measureItems();
          if (this.canvasCtx) this.recompute();
        },
        { injector: this.injector },
      );

      effect(() => {
        const visible = this.tooltipVisible();
        const template = this.tooltipTemplate();
        if (visible && template) {
          this.mountTooltip(template);
          window.addEventListener('scroll', this.onScrollHide, true);
          window.addEventListener('resize', this.onScrollHide);
        } else {
          this.unmountTooltip();
          window.removeEventListener('scroll', this.onScrollHide, true);
          window.removeEventListener('resize', this.onScrollHide);
        }
      });
    }

    inject(DestroyRef).onDestroy(() => {
      this.resizeObserver?.disconnect();
      if (this.isBrowser) {
        window.removeEventListener('scroll', this.onScrollHide, true);
        window.removeEventListener('resize', this.onScrollHide);
        this.unmountTooltip();
      }
    });
  }

  showTooltip(): void {
    const el = this.moreRef()?.nativeElement;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    this.tooltipTop.set(rect.top);
    this.tooltipLeft.set(rect.left + rect.width / 2);
    this.tooltipVisible.set(true);
  }

  hideTooltip(): void {
    this.tooltipVisible.set(false);
  }

  private mountTooltip(template: TemplateRef<unknown>): void {
    if (this.tooltipView) return;
    this.tooltipView = this.vcr.createEmbeddedView(template);
    this.tooltipView.detectChanges();
    for (const node of this.tooltipView.rootNodes) {
      this.renderer.appendChild(this.document.body, node);
    }
  }

  private unmountTooltip(): void {
    if (!this.tooltipView) return;
    for (const node of this.tooltipView.rootNodes) {
      if (node.parentNode) this.renderer.removeChild(this.document.body, node);
    }
    this.tooltipView.destroy();
    this.tooltipView = null;
  }

  private setupCanvas(): void {
    const container = this.containerRef()?.nativeElement;
    if (!container) return;
    const style = window.getComputedStyle(container);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} / ${style.lineHeight} ${style.fontFamily}`;
    this.canvasCtx = ctx;
  }

  private setupResizeObserver(): void {
    const container = this.containerRef()?.nativeElement;
    if (!container || typeof ResizeObserver === 'undefined') return;
    this.resizeObserver = new ResizeObserver(() => this.recompute());
    this.resizeObserver.observe(container);
  }

  private recompute(): void {
    const container = this.containerRef()?.nativeElement;
    const ctx = this.canvasCtx;
    const items = this.items();
    const itemEls = this.measureItems();

    if (!container || !ctx) return;
    if (items.length === 0) {
      this.visibleCount.set(0);
      return;
    }
    if (itemEls.length !== items.length) return;

    const containerWidth = container.clientWidth;
    if (containerWidth <= 0) return;

    const label = this.moreLabel();
    const sepWidth = ctx.measureText(this.separator()).width;
    let fitted = 0;
    let accWidth = 0;

    for (let i = 0; i < items.length; i++) {
      const itemWidth = itemEls[i].nativeElement.getBoundingClientRect().width;
      const candidateWidth = i === 0 ? itemWidth : accWidth + sepWidth + itemWidth;
      const remaining = items.length - (i + 1);
      const suffixWidth = remaining > 0 ? ctx.measureText(` +${remaining} ${label}`).width : 0;

      if (candidateWidth + suffixWidth <= containerWidth) {
        accWidth = candidateWidth;
        fitted = i + 1;
      } else {
        break;
      }
    }

    if (fitted === 0) fitted = 1;
    this.visibleCount.set(fitted);
  }
}
