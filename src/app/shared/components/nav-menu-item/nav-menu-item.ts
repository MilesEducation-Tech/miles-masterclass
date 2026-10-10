import { isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  forwardRef,
  inject,
  Injector,
  input,
  linkedSignal,
  output,
  PLATFORM_ID,
  Service,
  signal,
  untracked,
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

/**
 * One per list of sibling items, so only one sub-panel per level is open at a time: the header
 * provides it for the items in its dropdowns and drawer, and every `NavMenuItem` provides one for its
 * own children. Keyed by label, not by item, because the header rebuilds its nav items when the
 * session changes.
 */
@Service({ autoProvided: false })
export class NavMenuGroup {
  readonly open = signal<string | null>(null);
}

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
  // The group this item's own children share; the item itself joins its parent's (`skipSelf`).
  providers: [provideIcons({ lucideChevronRight }), NavMenuGroup],
  templateUrl: './nav-menu-item.html',
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
  private readonly group = inject(NavMenuGroup, { skipSelf: true });

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
   *
   * Linked to the sibling group: opening it claims the group (see the constructor), and it reads
   * closed again as soon as a sibling claims it.
   */
  readonly subPanelOpen = linkedSignal(() => this.group.open() === this.item().label);

  private readonly triggerBtn = viewChild<ElementRef<HTMLButtonElement>>('triggerBtn');

  constructor() {
    effect(() => {
      const open = this.subPanelOpen();
      const label = this.item().label;
      untracked(() => {
        if (open) this.group.open.set(label);
        // Closing itself releases the group, so a re-rendered list (the drawer reopening) starts collapsed.
        else if (this.group.open() === label) this.group.open.set(null);
      });
      if (open) afterNextRender(() => this.recheckPosition(), { injector: this.injector });
    });
    // Destroyed while open (drawer closed, desktop ↔ mobile switch): release the group for the same reason.
    inject(DestroyRef).onDestroy(() => {
      if (this.group.open() === this.item().label) this.group.open.set(null);
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
    const roomRight = window.innerWidth - rect.right - PANEL_MAX_WIDTH - VIEWPORT_MARGIN;
    const roomLeft = rect.left - PANEL_MAX_WIDTH - VIEWPORT_MARGIN;
    // The panel opens toward the inline end (`start-full`): rightwards, or leftwards on an RTL page.
    // Flip to the other side only when the opening side overflows and the other side has room.
    const rtl = getComputedStyle(btn).direction === 'rtl';
    const [openSide, otherSide] = rtl ? [roomLeft, roomRight] : [roomRight, roomLeft];
    this.flipped.set(openSide < 0 && otherSide > 0);
  }
}
