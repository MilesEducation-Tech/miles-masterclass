import {
  Injectable,
  signal,
  computed,
  inject,
  DestroyRef,
  PLATFORM_ID,
  effect,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Viewport } from '../viewport/viewport';

/**
 * Section navigation item structure
 */
export interface SectionNavItem {
  id: string;
  label: string;
  visible: boolean;
  /** Optional ng-icons icon name (e.g., 'lucideStar') */
  icon?: string;
}

/**
 * Service to manage section navigation visibility in header.
 * When the section nav reaches 80px from viewport top on md+ screens,
 * the nav should appear in the header instead of its original position.
 *
 * NOTE: Must be providedIn: 'root' because HeaderSectionNav (in Header layout)
 * and MasterclassSectionNav (in lazy route) need to share the same instance.
 */
@Injectable({
  providedIn: 'root',
})
export class SectionNavService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  private readonly viewport = inject(Viewport);

  /** Whether section nav should be shown in header */
  private readonly _showInHeader = signal(false);
  readonly showInHeader = this._showInHeader.asReadonly();

  /** The items to display in the section nav */
  private readonly _navItems = signal<SectionNavItem[]>([]);
  readonly navItems = this._navItems.asReadonly();

  /** Whether the section nav is registered (should be visible at all) */
  readonly isRegistered = computed(() => this._navItems().length > 0);

  /** Current active section ID - defaults to first item when registered */
  private readonly _activeSection = signal<string>('');
  readonly activeSection = this._activeSection.asReadonly();

  /** Reference to the nav element for position tracking */
  private navElement: HTMLElement | null = null;
  private scrollHandler: (() => void) | null = null;

  /** Flag to track if we've already set up the destroy callback */
  private destroyCallbackRegistered = false;

  /** Trigger point from viewport top */
  private readonly TRIGGER_OFFSET = 80;

  constructor() {
    // Register destroy callback once in constructor
    this.destroyRef.onDestroy(() => {
      this.cleanup();
    });

    // Re-evaluate header docking whenever the breakpoint changes. Replaces the
    // old window 'resize' listener — the shared Viewport service is now the
    // single source of truth for the breakpoint. `checkNavPosition()` no-ops
    // until a nav element is registered and on the server.
    effect(() => {
      this.viewport.screen();
      this.checkNavPosition();
    });
  }

  /**
   * Register the section nav element and items.
   * If already registered, updates the items and element reference.
   */
  registerNav(element: HTMLElement, items: SectionNavItem[]): void {
    // Update element and items
    this.navElement = element;
    this._navItems.set(items);

    // Set default active section to first item if not already set
    const currentActive = this._activeSection();
    if (!currentActive && items.length > 0) {
      this._activeSection.set(items[0].id);
    }

    if (isPlatformBrowser(this.platformId)) {
      this.setupScrollListener();
    }
  }

  /**
   * Update nav items dynamically
   */
  updateItems(items: SectionNavItem[]): void {
    this._navItems.set(items);
    // Update active section if current one is not in new items
    const currentActive = this._activeSection();
    const isValidActive = items.some((item) => item.id === currentActive);
    if (!isValidActive && items.length > 0) {
      this._activeSection.set(items[0].id);
    }
  }

  /**
   * Update active section
   */
  setActiveSection(sectionId: string): void {
    this._activeSection.set(sectionId);
  }

  /**
   * Unregister and cleanup
   */
  unregisterNav(): void {
    this.cleanup();
    this.navElement = null;
    this._navItems.set([]);
    this._showInHeader.set(false);
    this._activeSection.set('');
  }

  /**
   * Setup scroll listener with throttling for performance.
   * Cleans up existing listeners before setting up new ones.
   */
  private setupScrollListener(): void {
    this.cleanup(); // Clean up any existing listeners

    let ticking = false;

    this.scrollHandler = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          this.checkNavPosition();
          ticking = false;
        });
        ticking = true;
      }
    };

    // Passive scroll listener. Breakpoint changes are handled reactively via
    // the Viewport effect in the constructor (no separate 'resize' listener).
    window.addEventListener('scroll', this.scrollHandler, { passive: true });

    // Initial check
    this.checkNavPosition();
  }

  /**
   * Check nav position and update showInHeader accordingly
   */
  private checkNavPosition(): void {
    if (!this.navElement || !isPlatformBrowser(this.platformId)) return;

    const isMdScreen = !this.viewport.isMobile();

    if (!isMdScreen) {
      // On mobile, never show in header
      this._showInHeader.set(false);
      return;
    }

    const rect = this.navElement.getBoundingClientRect();
    const shouldShowInHeader = rect.top <= this.TRIGGER_OFFSET;

    this._showInHeader.set(shouldShowInHeader);
  }

  /**
   * Cleanup event listeners
   */
  private cleanup(): void {
    if (this.scrollHandler) {
      window.removeEventListener('scroll', this.scrollHandler);
      this.scrollHandler = null;
    }
  }
}
