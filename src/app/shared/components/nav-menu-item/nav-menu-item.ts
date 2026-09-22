import { isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  Component,
  effect,
  ElementRef,
  forwardRef,
  inject,
  Injector,
  input,
  output,
  PLATFORM_ID,
  signal,
  ViewEncapsulation,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronRight } from '@ng-icons/lucide';
import {
  NgpCollapsible,
  NgpCollapsibleContent,
  NgpCollapsibleTrigger,
} from 'ng-primitives/collapsible';
import { NavItem } from '@core/models/nav.model';
import { cn } from '../../utils/cn';
import { Utils } from '@shared/services/utils';

const PANEL_MAX_WIDTH = 300;
const VIEWPORT_MARGIN = 16;

@Component({
  selector: 'app-nav-menu-item',
  imports: [
    RouterLink,
    NgIcon,
    NgpCollapsible,
    NgpCollapsibleTrigger,
    NgpCollapsibleContent,
    forwardRef(() => NavMenuItem),
  ],
  providers: [provideIcons({ lucideChevronRight })],
  templateUrl: './nav-menu-item.html',
  styleUrl: './nav-menu-item.css',
  encapsulation: ViewEncapsulation.None,
  host: {
    '(window:resize)': 'recheckPosition()',
  },
})
export class NavMenuItem {
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly injector = inject(Injector);
  protected readonly utils = inject(Utils);

  readonly item = input.required<NavItem>();
  readonly navigated = output<void>();

  readonly cn = cn;
  readonly flipped = signal(false);

  /**
   * Sub-panel open state.
   *
   * `ngpCollapsible` rather than a menu primitive: this panel renders in
   * normal flow — stacked inline inside the mobile drawer, and only promoted
   * to an absolutely-positioned flyout at `lg`. A menu primitive portals its
   * content to the body and positions it with floating-ui, which would lose
   * the inline mobile layout entirely.
   */
  readonly subPanelOpen = signal(false);

  private readonly triggerBtn = viewChild<ElementRef<HTMLButtonElement>>('triggerBtn');

  constructor() {
    effect(() => {
      if (!this.subPanelOpen()) return;
      afterNextRender(() => this.recheckPosition(), { injector: this.injector });
    });
  }

  isActiveRoute(route?: string): boolean {
    if (!route) return false;
    return this.router.url.includes(route);
  }

  hasActiveChild(item: NavItem): boolean {
    if (!item.children) return false;
    return item.children.some(
      (child) => this.isActiveRoute(child.route) || this.hasActiveChild(child),
    );
  }

  /**
   * Sub-menu buttons emit `(navigated)` — the header (which owns the action
   * dispatch table) decides what to do based on `actionKind`.
   */
  onAction(): void {
    this.navigated.emit();
  }

  onLink(): void {
    this.navigated.emit();
  }

  bubble(): void {
    this.subPanelOpen.set(false);
    this.navigated.emit();
  }

  recheckPosition(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (!this.subPanelOpen()) return;
    const btn = this.triggerBtn()?.nativeElement;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const overflowsRight = rect.right + PANEL_MAX_WIDTH + VIEWPORT_MARGIN > window.innerWidth;
    const fitsLeft = rect.left - PANEL_MAX_WIDTH - VIEWPORT_MARGIN > 0;
    this.flipped.set(overflowsRight && fitsLeft);
  }
}
