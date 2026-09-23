import { isPlatformBrowser } from '@angular/common';
import {
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  PLATFORM_ID,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { catchError, of } from 'rxjs';
import { BadgeCard, BadgeCardActionEvent } from '@shared/components/cards/badge-card/badge-card';
import { SelectMenu } from '@shared/ui/select-menu/select-menu';
import { TabStrip } from '@shared/ui/tab-strip/tab-strip';
import {
  badgeClaimCourse,
  BadgeCardData,
  BadgeCourseItem,
  BadgeStatusFilter,
  toBadgeCardData,
  UserBadgeRef,
} from '@core/models/badge.model';
import { NotificationService } from '@core/services/notification/notification';
import { Utils } from '@shared/services/utils';
import { Dialog } from '@core/services/dialog/dialog';
import {
  CertificateDialogData,
  CertificateDownloadDialog,
} from '@shared/dialogs/certificate-download-dialog/certificate-download-dialog';
import { BadgeLibraryHero } from '../../components/badge-library-hero/badge-library-hero';
import { BadgeFacade } from '../../services/badge-facade';

/**
 * Maps the badge API's `course_type` token to the URL segment under
 * `/{country}/{profession}/...` used by `Utils.navigateToCourse` and
 * `Utils.navigateToCourseFeedback`.
 *
 * Cross-checked against:
 *   - `src/app/features/offerings/offerings.ts` (`masterclass`, `podcast`,
 *     `webinar`, `micro-learning`)
 *   - `src/app/features/partners/partner.routes.ts` (`caira` — routed via
 *     the `caira` short-circuit in `navigateToCourse` below, not this map).
 */
const COURSE_TYPE_ROUTE: Record<string, string> = {
  masterclass: 'masterclass',
  podcast: 'podcast',
  nano_learning: 'micro-learning',
  webinar: 'webinar',
  caira: 'caira',
};

@Component({
  selector: 'app-badge',
  imports: [BadgeLibraryHero, TabStrip, SelectMenu, BadgeCard],
  templateUrl: './badge.html',
  styleUrl: './badge.css',
})
export class Badge {
  readonly facade = inject(BadgeFacade);
  private readonly utils = inject(Utils);
  private readonly dialog = inject(Dialog);
  private readonly router = inject(Router);
  private readonly notify = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly statusOptions = this.facade.badgeStatusOptions;

  /** Normalized view-models the card consumes. Switching tabs flips `courseType`. */
  readonly cards = computed<BadgeCardData[]>(() => {
    const courseType = this.facade.badgeCategory() ?? '';
    return this.facade.badgeItems().map((item) => toBadgeCardData(item, courseType));
  });

  readonly sentinel = viewChild<ElementRef<HTMLDivElement>>('sentinel');
  readonly listSection = viewChild<ElementRef<HTMLDivElement>>('listSection');

  constructor() {
    effect((onCleanup) => {
      const el = this.sentinel()?.nativeElement;
      if (!el || !this.isBrowser) return;

      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            this.facade.loadNextBadgePage();
          }
        },
        { rootMargin: '300px' },
      );
      observer.observe(el);
      onCleanup(() => observer.disconnect());
    });
    effect(() => {
      this.facade.badgeCategory();
      this.facade.badgeStatus();
    });
  }

  onStatusChange(value: string) {
    if (this.statusOptions.some((o) => o.value === value)) {
      this.facade.setBadgeStatus(value as BadgeStatusFilter);
    }
  }

  onCardAction(event: BadgeCardActionEvent) {
    const { action, card } = event;
    switch (action) {
      case 'earn_badge':
        this.navigateToCourse(card);
        return;
      case 'submit_feedback':
        this.navigateToFeedback(card);
        return;
      case 'claim_badge':
        this.claimBadge(card);
        return;
      case 'download_certificate':
        this.downloadCertificate(card);
        return;
      case 'locked':
      case 'coming_soon':
        return;
    }
    // Exhaustiveness guard so a new BadgeAction surfaces here at compile time.
    const _exhaustive: never = action;
    void _exhaustive;
  }

  // ----- Action handlers -----------------------------------------------------

  private navigateToCourse(card: BadgeCardData) {
    // Caira tag: Earn Badge funnels into the Masterclass listing — that's
    // where the CAIRA level-1 path lives. No course-id required since this
    // routes to the listing, not a specific course detail page.
    if (card.courseType === 'caira') {
      this.router.navigate([`/${this.utils.country()}/${this.utils.profession()}/masterclass`]);
      return;
    }
    if (!card.courseId) {
      this.notify.error('Unavailable', 'Course details not available for this badge.');
      return;
    }
    const routeType = COURSE_TYPE_ROUTE[card.courseType] ?? card.courseType;
    this.utils.navigateToCourse(routeType, card.courseId, card.title);
  }

  private navigateToFeedback(card: BadgeCardData) {
    if (!card.courseId) {
      this.notify.error('Unavailable', 'Course details not available for feedback.');
      return;
    }
    const routeType = COURSE_TYPE_ROUTE[card.courseType] ?? card.courseType;
    this.utils.navigateToCourseFeedback(routeType, card.courseId, card.title);
  }

  private claimBadge(card: BadgeCardData) {
    // Non-caira tabs short-circuit when the first `user_badges` entry already
    // carries a Credly `accept_url` — open it directly so we don't re-call
    // the claim API for an already-claimed badge. Caira level items have no
    // `user_badges` field, so they fall through to the API path below.
    if (card.courseType !== 'caira') {
      const userBadge = this.extractUserBadge(card);
      if (userBadge?.accept_url && this.isBrowser) {
        window.open(userBadge.accept_url, '_blank', 'noopener');
        return;
      }
    }

    // ponytail: gated on an active subscription, read from the removed
    // session service. Claiming is open until a plan source is re-attached.
    this.facade
      .claimBadge(card.badgeId, badgeClaimCourse(card.raw))
      .pipe(
        catchError(() => of(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((res) => {
        const url = this.utils.claimAcceptUrl(res);
        if (url && this.isBrowser) {
          window.open(url, '_blank', 'noopener');
          return;
        }
        this.notify.error('Claim failed', 'Something went wrong while claiming the badge.');
      });
  }

  private downloadCertificate(card: BadgeCardData) {
    if (!card.courseId) {
      this.notify.error('Unavailable', 'Course details not available for certificate.');
      return;
    }

    const userBadge = this.extractUserBadge(card);

    const data: CertificateDialogData = {
      courseId: card.courseId,
      courseType: card.courseType,
      courseTitle: card.title,
      // Pass the badge whenever the row has one — the dialog renders the
      // share row and falls back to a claim-then-open when `acceptUrl` isn't
      // populated yet.
      badge: userBadge
        ? {
            id: userBadge.id,
            acceptUrl: userBadge.accept_url ?? undefined,
            name: card.title,
            image: card.badgeIconUrl,
          }
        : undefined,
    };
    this.dialog.open<CertificateDownloadDialog, CertificateDialogData>(CertificateDownloadDialog, {
      maxWidth: '100%',
      enterAnimationDuration: '300ms',
      exitAnimationDuration: '300ms',
      data,
    });
  }

  /**
   * Pulls the first `user_badges` entry off a course-tied badge row. Level
   * items (CAIRA / invite-only) don't carry `user_badges` so they hit the
   * null branch and `triggerCredlyHandoff` no-ops.
   */
  private extractUserBadge(card: BadgeCardData): UserBadgeRef | null {
    const raw = card.raw as Partial<BadgeCourseItem>;
    return raw.user_badges?.[0] ?? null;
  }
}
