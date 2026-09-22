import {
  afterNextRender,
  afterRenderEffect,
  Component,
  computed,
  DestroyRef,
  DOCUMENT,
  effect,
  inject,
  input,
  PLATFORM_ID,
  signal,
  untracked,
} from '@angular/core';
import { DatePipe, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { FaqContent } from '@shared/components/faq-content/faq-content';
import { LegalSection } from '../legal-section/legal-section';
import { SectionNavItem } from '@shared/components/section-nav/section-nav';
import { LegalDoc as LegalDocModel } from '../../models/legal-doc.model';

/**
 * Shared shell for legal pages (Terms of Service, Privacy Policy). Renders
 * the hero, intro, sticky left rail (top-level sections only — nested
 * subsections still appear in the content column but not in the rail),
 * and the section list.
 *
 * Why a local IntersectionObserver rather than reusing <app-section-nav>?
 * SectionNav ships a sidenav mode but it's `fixed left-0 top-0 h-full` —
 * meant to overlay the viewport, not live inside a grid. Embedding the
 * observer here keeps the rail inline with the content column without
 * mounting SectionNav off-screen just for its side effects.
 *
 * Behavior:
 * - lg+ shows the rail in a 2-col grid; below lg, content goes full-width
 *   and the rail is hidden.
 * - Active section tracked via IntersectionObserver with the same trigger
 *   zone as SectionNav (`-10% 0px -50% 0px`).
 * - Deep-link via fragment (e.g. /terms-of-service#refunds) auto-scrolls
 *   after first render. No setTimeout, no replaceUrl rewrite.
 * - Mobile webview embed: ?embed=mobile drops chrome via DynamicLayout
 *   AND this component hides the hero and rail so the Flutter webview
 *   gets just the content.
 */
@Component({
  selector: 'app-legal-doc',
  imports: [LegalSection, FaqContent, DatePipe],
  templateUrl: './legal-doc.html',
  styleUrl: './legal-doc.css',
})
export class LegalDocComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly doc = input.required<LegalDocModel>();

  /** Flattens top-level sections into the side-rail items. */
  protected readonly navItems = computed<SectionNavItem[]>(() =>
    this.doc().sections.map((s) => ({
      id: s.navId,
      label: s.navLabel,
      visible: true,
    })),
  );

  /** Currently-active section id (set by the observer and by clicks). */
  protected readonly activeSection = signal<string>('');

  /**
   * Embedded mode strips the hero + side rail so the Flutter webview gets
   * just the content. Triggered by either:
   *  - a `/...mobile` route with `data: { layout: 'plain' }` (preferred —
   *    Flutter has a stable URL contract and DynamicLayout drops chrome
   *    in the same routing pass)
   *  - `?embed=mobile` query param (legacy override that works on any URL)
   */
  private readonly queryParams = toSignal(this.route.queryParamMap);
  private readonly routeData = toSignal(this.route.data);
  protected readonly isEmbedded = computed(() => {
    if (this.queryParams()?.get('embed') === 'mobile') return true;
    return this.routeData()?.['layout'] === 'plain';
  });

  /** Reactive deep-link target via /terms-of-service#anchor. */
  private readonly fragment = toSignal(this.route.fragment);

  private observer: IntersectionObserver | null = null;
  private rebuildTimerId: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Seed activeSection from the first item so the rail isn't empty before
    // the observer fires (and reset on doc change, in case of stale state
    // when navigating between Terms ↔ Privacy).
    effect(() => {
      const items = this.navItems();
      if (items.length > 0) {
        untracked(() => this.activeSection.set(items[0].id));
      }
    });

    afterNextRender(() => {
      this.setupObserver();
      const initial = untracked(() => this.fragment());
      if (initial) this.scrollToAnchor(initial);
    });

    // Rebuild the observer when the doc (and thus its section ids) changes.
    afterRenderEffect(() => {
      this.navItems(); // dep
      if (this.rebuildTimerId !== null) clearTimeout(this.rebuildTimerId);
      this.rebuildTimerId = setTimeout(() => this.setupObserver(), 100);
    });

    // Browser-only — fragment changes from in-page link clicks or back/forward.
    afterRenderEffect(() => {
      const target = this.fragment();
      if (target) this.scrollToAnchor(target);
    });

    this.destroyRef.onDestroy(() => {
      if (this.rebuildTimerId !== null) clearTimeout(this.rebuildTimerId);
      this.observer?.disconnect();
    });
  }

  /** Click handler for rail items. */
  protected onNavClick(id: string): void {
    this.activeSection.set(id);
    this.scrollToAnchor(id);
  }

  private scrollToAnchor(navId: string): void {
    if (!this.isBrowser) return;
    const el = this.document.getElementById(navId);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 96;
    window.scrollTo({ top, behavior: 'smooth' });
  }

  private setupObserver(): void {
    if (!this.isBrowser) return;
    this.observer?.disconnect();

    const visibleSections = new Map<string, number>();

    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            visibleSections.set(entry.target.id, entry.boundingClientRect.top);
          } else {
            visibleSections.delete(entry.target.id);
          }
        });

        if (visibleSections.size > 0) {
          let closestId: string | null = null;
          let closestDistance = Infinity;
          visibleSections.forEach((top, id) => {
            const distance = Math.abs(top);
            if (distance < closestDistance) {
              closestDistance = distance;
              closestId = id;
            }
          });
          if (closestId) this.activeSection.set(closestId);
        }
      },
      { root: null, rootMargin: '-10% 0px -50% 0px', threshold: 0 },
    );

    this.navItems().forEach((item) => {
      const el = this.document.getElementById(item.id);
      if (el) this.observer?.observe(el);
    });
  }
}
