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
import { SectionNavService, SectionNavItem } from '../../core/services/section-nav/section-nav';

// Re-export for external use
export type { SectionNavItem };

type SectionNavMode = 'inline' | 'header' | 'sidenav';

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
          <nav class="inline-nav" role="navigation" aria-label="Page sections">
            @for (item of visibleItems(); track item.id) {
              <button
                type="button"
                [class]="getButtonClass(item.id)"
                (click)="scrollToSection(item.id)"
                [attr.aria-current]="sectionNavService.activeSection() === item.id ? 'true' : null"
              >
                @if (item.icon) {
                  <ng-icon [name]="item.icon" class="nav-icon" aria-hidden="true" />
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
            <nav class="header-nav" role="navigation" aria-label="Page sections">
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
                      <ng-icon [name]="item.icon" class="nav-icon" aria-hidden="true" />
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
        <nav class="sidenav" role="navigation" aria-label="Page sections">
          @for (item of visibleItems(); track item.id) {
            <button
              type="button"
              [class]="getSidenavButtonClass(item.id)"
              (click)="scrollToSection(item.id)"
              [attr.aria-current]="sectionNavService.activeSection() === item.id ? 'true' : null"
              [attr.aria-label]="item.label"
            >
              @if (item.icon) {
                <ng-icon [name]="item.icon" class="sidenav-icon" aria-hidden="true" />
              }
              <span class="sidenav-label">{{ item.label }}</span>
            </button>
          }
        </nav>
      }
    }
  `,
  styles: `
    @reference '../../../../styles/styles.css';

    /* Shared button styles */
    .inline-nav button,
    .header-nav button {
      @apply relative px-2 py-2 text-sm font-medium transition-all duration-300 ease-out;
      @apply bg-transparent border-0 cursor-pointer flex items-center gap-1.5;
    }

    /* Underline indicator */
    .inline-nav button::after,
    .header-nav button::after {
      content: '';
      @apply absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-0.5 bg-white transition-all duration-300 ease-out;
    }

    .inline-nav button.active::after,
    .header-nav button.active::after {
      @apply w-full;
    }

    .inline-nav button.active,
    .header-nav button.active {
      @apply text-white;
    }

    .inline-nav button:not(.active),
    .header-nav button:not(.active) {
      @apply text-gray-400 hover:text-gray-200;
    }

    .inline-nav button:not(.active):hover::after,
    .header-nav button:not(.active):hover::after {
      @apply w-1/2 bg-gray-400;
    }

    .nav-icon {
      @apply text-base;
    }

    /* Inline nav layout */
    .inline-nav {
      @apply flex items-center justify-center gap-8 flex-wrap py-3;
    }

    /* Header nav layout */
    .header-nav {
      @apply container mx-auto flex items-center justify-center gap-8;
    }

    /* Sidenav styles */
    .sidenav {
      @apply fixed left-0 top-0 h-full z-50;
      /* Hidden on mobile (<md/768) and shown from md+ — a fixed left rail
         overlaps page content on small screens. Only the home + masterclass
         pages use sidenav mode, so this scopes the hide to exactly those. */
      @apply hidden md:flex md:flex-col justify-center gap-2 py-4 px-2;
      @apply rounded-r-xl;
      @apply transition-all duration-600 ease-out bg-linear-to-r from-background to-transparent;
      width: 56px;
    }

    .sidenav:hover {
      width: auto;
    }

    .sidenav button {
      @apply flex items-center gap-3 px-3 py-2.5 rounded-lg;
      @apply bg-transparent border-0 cursor-pointer;
      @apply text-gray-200 transition-all duration-300 ease-out;
      @apply whitespace-nowrap overflow-hidden;
    }

    .sidenav button:hover {
      @apply bg-gray-800;
    }

    .sidenav button.active {
      @apply bg-primary/20 text-white;
    }

    .sidenav-icon {
      @apply text-xl shrink-0;
    }

    .sidenav-label {
      @apply text-sm font-medium opacity-0 max-w-0 overflow-hidden;
      @apply transition-all duration-300 ease-out;
    }

    .sidenav:hover .sidenav-label {
      @apply opacity-100 max-w-48;
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
    return this.sectionNavService.activeSection() === sectionId ? 'active' : '';
  }

  /**
   * Returns button classes for sidenav mode
   */
  getSidenavButtonClass(sectionId: string): string {
    return this.sectionNavService.activeSection() === sectionId ? 'active' : '';
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
