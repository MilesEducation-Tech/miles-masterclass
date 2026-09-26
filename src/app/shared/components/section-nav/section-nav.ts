import {
  Component,
  computed,
  input,
  inject,
  afterNextRender,
  DestroyRef,
  ElementRef,
  effect,
  PLATFORM_ID,
} from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideBookOpen,
  lucideBookmark,
  lucideCalendarClock,
  lucideCheckCircle,
  lucideClock,
  lucideFileText,
  lucideGraduationCap,
  lucideHelpCircle,
  lucideHome,
  lucideInfo,
  lucideLayers,
  lucideLink,
  lucidePlay,
  lucideRocket,
  lucideSparkles,
  lucideStar,
  lucideUsersRound,
} from '@ng-icons/lucide';
import { SectionNavService, SectionNavItem } from '@core/services/section-nav/section-nav';

// Re-export for external use
export type { SectionNavItem };

type SectionNavMode = 'inline' | 'header' | 'sidenav';

/*
 * Button classes, one complete set per state. Complete rather than base +
 * modifier: two utilities at the same variant level (e.g. `after:w-0` and
 * `after:w-full`, or a base `hover:bg-*` and the active `bg-*`) would tie, and
 * the old stylesheet's winner came from rule order, which utilities don't have.
 */
const NAV_BUTTON =
  "relative flex cursor-pointer items-center gap-1.5 border-0 bg-transparent px-2 py-2 text-sm font-medium transition-all duration-300 ease-out after:absolute after:bottom-0 after:left-1/2 after:h-0.5 after:-translate-x-1/2 after:bg-white after:transition-all after:duration-300 after:ease-out after:content-['']";
// Underline grows to full width when active, to half (grey) on hover otherwise.
const NAV_BUTTON_ACTIVE = `${NAV_BUTTON} active text-white after:w-full`;
const NAV_BUTTON_IDLE = `${NAV_BUTTON} text-gray-400 hover:text-gray-200 after:w-0 hover:after:w-1/2 hover:after:bg-gray-400`;

const SIDENAV_BUTTON =
  'flex cursor-pointer items-center gap-3 overflow-hidden whitespace-nowrap rounded-lg border-0 px-3 py-2.5 transition-all duration-300 ease-out';
// The active fill wins over hover, as the old `.active` rule (declared later) did.
const SIDENAV_BUTTON_ACTIVE = `${SIDENAV_BUTTON} active bg-primary/20 text-white`;
const SIDENAV_BUTTON_IDLE = `${SIDENAV_BUTTON} bg-transparent text-gray-200 hover:bg-gray-800`;

@Component({
  selector: 'app-section-nav',
  imports: [NgIcon],
  providers: [
    provideIcons({
      lucideBookOpen,
      lucideBookmark,
      lucideCalendarClock,
      lucideCheckCircle,
      lucideClock,
      lucideFileText,
      lucideGraduationCap,
      lucideHelpCircle,
      lucideHome,
      lucideInfo,
      lucideLayers,
      lucideLink,
      lucidePlay,
      lucideRocket,
      lucideSparkles,
      lucideStar,
      lucideUsersRound,
    }),
  ],
  template: `
    @switch (mode()) {
      @case ('inline') {
        <!-- Inline mode: horizontal nav, hides when shown in header -->
        @if (!shareWithHeader() || !sectionNavService.showInHeader()) {
          <nav
            class="inline-nav flex flex-wrap items-center justify-center gap-8 py-3"
            role="navigation"
            aria-label="Page sections"
          >
            @for (item of visibleItems(); track item.id) {
              <button
                type="button"
                [class]="getButtonClass(item.id)"
                (click)="scrollToSection(item.id)"
                [attr.aria-current]="sectionNavService.activeSection() === item.id ? 'true' : null"
              >
                @if (item.icon) {
                  <ng-icon [name]="item.icon" class="text-base" aria-hidden="true" />
                }
                {{ item.label }}
              </button>
            }
          </nav>
        }
      }
      @case ('header') {
        <!-- Header mode: shows when nav is registered and scrolled into header -->
        @if (sectionNavService.showInHeader() && sectionNavService.isRegistered()) {
          <div class="w-full">
            <nav
              class="mx-auto flex w-full items-center justify-center gap-8 sm:max-w-(--breakpoint-sm) md:max-w-(--breakpoint-md) lg:max-w-(--breakpoint-lg) xl:max-w-(--breakpoint-xl) 2xl:max-w-(--breakpoint-2xl)"
              role="navigation"
              aria-label="Page sections"
            >
              @for (item of sectionNavService.navItems(); track item.id) {
                @if (item.visible) {
                  <button
                    type="button"
                    [class]="getButtonClass(item.id)"
                    (click)="scrollToSection(item.id)"
                    [attr.aria-current]="
                      sectionNavService.activeSection() === item.id ? 'true' : null
                    "
                  >
                    @if (item.icon) {
                      <ng-icon [name]="item.icon" class="text-base" aria-hidden="true" />
                    }
                    {{ item.label }}
                  </button>
                }
              }
            </nav>
          </div>
        }
      }
      @case ('sidenav') {
        <!-- Sidenav mode: vertical nav with icon-only, expands on hover -->
        <nav
          class="sidenav group fixed top-0 left-0 z-50 hidden h-full w-14 justify-center gap-2 rounded-r-xl bg-linear-to-r from-background to-transparent px-2 py-4 transition-all duration-600 ease-out hover:w-auto md:flex md:flex-col"
          role="navigation"
          aria-label="Page sections"
        >
          @for (item of visibleItems(); track item.id) {
            <button
              type="button"
              [class]="getSidenavButtonClass(item.id)"
              (click)="scrollToSection(item.id)"
              [attr.aria-current]="sectionNavService.activeSection() === item.id ? 'true' : null"
              [attr.aria-label]="item.label"
            >
              @if (item.icon) {
                <ng-icon
                  [name]="item.icon"
                  class="sidenav-icon shrink-0 text-xl"
                  aria-hidden="true"
                />
              }
              <span
                class="sidenav-label max-w-0 overflow-hidden text-sm font-medium opacity-0 transition-all duration-300 ease-out group-hover:max-w-48 group-hover:opacity-100"
                >{{ item.label }}</span
              >
            </button>
          }
        </nav>
      }
    }
  `,
})
export class SectionNav {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly platformId = inject(PLATFORM_ID);
  readonly sectionNavService = inject(SectionNavService);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  private observer: IntersectionObserver | null = null;
  private observerTimerId: ReturnType<typeof setTimeout> | null = null;

  /** Navigation items (required for inline/sidenav modes) */
  readonly items = input<SectionNavItem[]>([]);

  /** Display mode: inline, header, or sidenav */
  readonly mode = input<SectionNavMode>('inline');

  /** Whether to sync with header service */
  readonly shareWithHeader = input(true);

  /** Scroll offset when clicking nav items */
  readonly headerOffset = input(100);

  /** Filtered visible items */
  readonly visibleItems = computed(() => this.items().filter((item) => item.visible));

  constructor() {
    // Register with service when items change (only for inline mode with shareWithHeader)
    effect(() => {
      const items = this.items();
      const shouldShare = this.shareWithHeader();
      const currentMode = this.mode();

      if (currentMode === 'inline' && shouldShare) {
        this.sectionNavService.updateItems(items);
      }
    });

    afterNextRender(() => {
      const currentMode = this.mode();
      const shouldShare = this.shareWithHeader();

      if (currentMode === 'inline' && shouldShare) {
        this.sectionNavService.registerNav(this.elementRef.nativeElement, this.items());
      }
    });

    // Setup intersection observer for inline/sidenav modes
    effect(() => {
      const items = this.visibleItems();
      const currentMode = this.mode();

      if (items.length > 0 && this.isBrowser && currentMode !== 'header') {
        if (this.observerTimerId) clearTimeout(this.observerTimerId);
        this.observerTimerId = setTimeout(() => {
          this.setupIntersectionObserver();
        }, 100);
      }
    });

    this.destroyRef.onDestroy(() => {
      if (this.observerTimerId) clearTimeout(this.observerTimerId);
      this.observer?.disconnect();
      const currentMode = this.mode();
      const shouldShare = this.shareWithHeader();

      if (currentMode === 'inline' && shouldShare) {
        this.sectionNavService.unregisterNav();
      }
    });
  }

  /**
   * Scrolls to the target section with smooth behavior
   */
  scrollToSection(sectionId: string): void {
    const element = this.document.getElementById(sectionId);
    if (element) {
      const offset = this.headerOffset();
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.scrollY - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });

      this.sectionNavService.setActiveSection(sectionId);
    }
  }

  /**
   * Returns button classes for inline/header modes
   */
  getButtonClass(sectionId: string): string {
    return this.sectionNavService.activeSection() === sectionId
      ? NAV_BUTTON_ACTIVE
      : NAV_BUTTON_IDLE;
  }

  /**
   * Returns button classes for sidenav mode
   */
  getSidenavButtonClass(sectionId: string): string {
    return this.sectionNavService.activeSection() === sectionId
      ? SIDENAV_BUTTON_ACTIVE
      : SIDENAV_BUTTON_IDLE;
  }

  /**
   * Sets up intersection observer for automatic active section detection
   */
  private setupIntersectionObserver(): void {
    this.observer?.disconnect();

    // Track which sections are currently visible
    const visibleSections = new Map<string, number>();

    const options: IntersectionObserverInit = {
      root: null,
      rootMargin: '-10% 0px -50% 0px',
      threshold: 0,
    };

    this.observer = new IntersectionObserver((entries) => {
      // Update our map of visible sections
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          // Store the top position of the element
          visibleSections.set(entry.target.id, entry.boundingClientRect.top);
        } else {
          visibleSections.delete(entry.target.id);
        }
      });

      // Find the section closest to the top of the viewport (but within the trigger zone)
      if (visibleSections.size > 0) {
        let closestSection: string | null = null;
        let closestDistance = Infinity;

        visibleSections.forEach((top, id) => {
          const distance = Math.abs(top);
          if (distance < closestDistance) {
            closestDistance = distance;
            closestSection = id;
          }
        });

        if (closestSection) {
          this.sectionNavService.setActiveSection(closestSection);
        }
      }
    }, options);

    // Use items from input for inline/sidenav, from service for header
    const itemsToObserve =
      this.mode() === 'header' ? this.sectionNavService.navItems() : this.visibleItems();

    itemsToObserve.forEach((item) => {
      const element = this.document.getElementById(item.id);
      if (element) {
        this.observer?.observe(element);
      }
    });
  }
}
