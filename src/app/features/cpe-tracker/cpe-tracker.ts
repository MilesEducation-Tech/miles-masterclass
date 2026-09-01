import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TrackerTableRow } from './shared/mappers/report-to-table';
import {
  BADGE_PAGE_SIZE,
  BadgeHeroCardData,
  availableContentTypes,
  badgeToTableRow,
  filterBadges,
  toBadgeHeroCards,
} from './shared/mappers/badge-to-table';
import { BadgeSwiper } from './shared/components/badge-swiper/badge-swiper';
import { TrackerToolbar } from './shared/components/tracker-toolbar/tracker-toolbar';
import { TrackerTable } from './shared/components/tracker-table/tracker-table';
import { Cpe } from '../../shared/core/services/cpe/cpe';
import { Utils } from '../../shared/core/services/utils/utils';
import {
  BadgeContentType,
  CairaCategory,
  CairaLevel,
} from '../../shared/core/models/caira/cpe.model';

/**
 * CPE tracker, bound to CAIRA's #5 / #23 / #19 through `Cpe`.
 *
 * **Reshaped to the data.** The Django-era tracker filtered by calendar year
 * and field of study and offered six row actions. CAIRA has none of that:
 * credits aggregate by *level*, #23 carries no field-of-study breakdown, and
 * — the one that decides the layout — **no badge in #23 carries a course id**,
 * so resume / exam / retake / feedback / view-details have nothing to navigate
 * to. The shipped CAIRA LMS's progress page agrees: it is a filterable badge
 * grid with certificate links and no navigation at all.
 *
 * So the filters are CAIRA/NON-CAIRA + level + content type, and the only row
 * action is opening a certificate or Credly badge. Gaps: G-25/G-37 (year),
 * G-26/G-27 (bulk download, NASBA template).
 *
 * State lives here rather than in a service because nothing else reads it — the
 * filter and page are this page's business (AGENTS.md §3).
 */
@Component({
  selector: 'app-cpe-tracker',
  imports: [BadgeSwiper, TrackerToolbar, TrackerTable],
  templateUrl: './cpe-tracker.html',
  styleUrl: './cpe-tracker.css',
})
export class CpeTracker {
  protected readonly cpe = inject(Cpe);
  private readonly router = inject(Router);
  private readonly utils = inject(Utils);

  /**
   * The hero swiper needs both reads: #23 has the art and progress, #5 has the
   * `credly_assertion_id` that #19 claims against. Joined on level name.
   */
  protected readonly heroBadges = computed(() =>
    toBadgeHeroCards(this.cpe.levelBadges(), this.cpe.levelProgress()),
  );

  protected readonly category = signal<CairaCategory>('CAIRA');
  protected readonly level = signal<CairaLevel>('L1');

  /** Content types with at least one badge under the current category/level. */
  protected readonly contentTypeOptions = computed(() =>
    availableContentTypes(this.cpe.badgeItems(), this.category(), this.level()),
  );

  /**
   * `linkedSignal` rather than a plain signal: changing category or level can
   * make the selected content type disappear from the options, and the filter
   * must fall back to something that exists instead of silently showing an
   * empty grid. It stays user-writable in between.
   */
  protected readonly contentType = linkedSignal<BadgeContentType[], BadgeContentType>({
    source: this.contentTypeOptions,
    computation: (options, previous) =>
      previous && options.includes(previous.value) ? previous.value : (options[0] ?? 'Masterclass'),
  });

  private readonly filtered = computed(() =>
    filterBadges(this.cpe.badgeItems(), {
      category: this.category(),
      level: this.level(),
      contentType: this.contentType(),
    }),
  );

  protected readonly rows = computed<TrackerTableRow[]>(() => this.filtered().map(badgeToTableRow));

  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.rows().length / BADGE_PAGE_SIZE)),
  );

  /** Reset to page 1 whenever the filter narrows the list under our feet. */
  protected readonly currentPage = linkedSignal<number, number>({
    source: () => this.rows().length,
    computation: () => 1,
  });

  protected readonly pagedRows = computed(() => {
    const start = (this.currentPage() - 1) * BADGE_PAGE_SIZE;
    return this.rows().slice(start, start + BADGE_PAGE_SIZE);
  });

  protected readonly pageWindow = computed(() => {
    const total = this.rows().length;
    const start = (this.currentPage() - 1) * BADGE_PAGE_SIZE;
    return {
      from: total === 0 ? 0 : start + 1,
      to: Math.min(start + BADGE_PAGE_SIZE, total),
      total,
    };
  });

  /** The toolbar's headline figure — the learner's grand total across both programmes. */
  protected readonly credits = computed(() => ({ earned: this.cpe.totals().grandTotal }));

  protected onCategory(next: CairaCategory): void {
    this.category.set(next);
  }

  protected onLevel(next: CairaLevel): void {
    this.level.set(next);
  }

  protected onContentType(next: BadgeContentType): void {
    this.contentType.set(next);
  }

  protected prevPage(): void {
    this.currentPage.update((page) => Math.max(1, page - 1));
  }

  protected nextPage(): void {
    this.currentPage.update((page) => Math.min(this.totalPages(), page + 1));
  }

  /**
   * #19 · claim a level badge from the hero swiper.
   *
   * `Cpe` reloads both reads and fires the activity event; the page only has to
   * open the URL the server minted.
   */
  protected onClaimBadge(badge: BadgeHeroCardData): void {
    if (!badge.credlyAssertionId) return;
    this.cpe
      .claimLevelBadge({
        credlyAssertionId: badge.credlyAssertionId,
        badgeName: badge.name,
        creditAmount: this.cpe.totals().grandTotal,
      })
      .subscribe((url) => {
        if (url) this.openExternal(url);
      });
  }

  protected onShareBadge(badge: BadgeHeroCardData): void {
    if (badge.credlyAcceptUrl) this.utils.openShareDialog({ url: badge.credlyAcceptUrl });
  }

  protected openCompliance(): void {
    this.router.navigate(['/', this.utils.country(), this.utils.profession(), 'compliance']);
  }

  /**
   * The only action a badge row can offer. CAIRA serves certificates as
   * embedded URLs — there is no download endpoint, so this opens rather than
   * fetches, and jsPDF is not involved.
   */
  protected onRowAction(row: TrackerTableRow): void {
    if (row.actionKind !== 'download') return;
    const url = row.raw.certificateUrl ?? row.raw.badgeUrl;
    if (url) this.openExternal(url);
  }

  private openExternal(url: string): void {
    // `noopener` matters: these are third-party Credly and S3 origins.
    window.open(url, '_blank', 'noopener');
  }
}
