import { NgOptimizedImage } from '@angular/common';
import {
  Component,
  computed,
  DestroyRef,
  EnvironmentInjector,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Button } from '../../ui/button/button';
import { NgIcon } from '@ng-icons/core';
import { faSolidInfo, faSolidPlay, faSolidRobot } from '@ng-icons/font-awesome/solid';
import { matBookmarkBorderRound, matBookmarkRound } from '@ng-icons/material-icons/round';
import { Utils } from '../../../core/services/utils/utils';
import { Auth } from '../../../core/services/auth/auth';
import { Logger } from '../../../core/services/logger/logger';
import { CategoriesList } from '../../categories-list/categories-list';
import { TotalCpeCreditsPipe } from '../../../core/pipes/total-cpe-credits/total-cpe-credits.pipe';
import { CairaCredlyBadge } from '../caira-credly-badge/caira-credly-badge';
import { CairaUuid } from '../../../core/models/caira/envelope.model';
import {
  ctaFor,
  webinarTagFor,
  WebinarCta,
} from '../../../../features/offerings/webinar/shared/utils/webinar-status';

@Component({
  selector: 'app-horizontal',
  imports: [
    NgOptimizedImage,
    Button,
    NgIcon,
    CategoriesList,
    TotalCpeCreditsPipe,
    CairaCredlyBadge,
  ],
  templateUrl: './horizontal.html',
  styleUrl: './horizontal.css',
})
export class Horizontal {
  private readonly utils = inject(Utils);
  // ponytail: FeatureFacade was deleted with the Django strip. This placeholder
  // keeps the template bindings compiling and renders the empty state.
  // Swap in the new backend's service — the template needs no changes.
  private readonly feature: any = {};
  private readonly logger = inject(Logger);
  private readonly auth = inject(Auth);
  /**
   * `WebinarFacade` lives at the webinar route level — it isn't globally
   * available, so the card injects it optionally. Cards rendered outside the
   * webinar feature (masterclass / podcast / micro-learning) get `null` here
   * and fall back to the legacy Trailer button.
   */
  // ponytail: WebinarFacade went with the Django strip. The webinar CTAs below
  // already handle a null facade (cards outside the webinar feature always got
  // null), so they degrade to the same no-op path.
  private readonly webinarFacade: any = null;
  /**
   * Captured at the card's mount site so we can hand the route-scoped injector
   * to `Utils.openCourseInfoDialog`. The webinar details dialog needs it to
   * resolve `WebinarFacade`; without it the dialog's CTAs no-op.
   */
  private readonly envInjector = inject(EnvironmentInjector);
  private readonly destroyRef = inject(DestroyRef);

  card = model.required<any>();
  type = input<'masterclass' | 'podcast' | 'micro-learning' | 'webinar'>('masterclass');
  /**
   * Mark the first card(s) of an above-the-fold rail as the LCP candidate.
   * `NgOptimizedImage` logs NG02955 when the largest-contentful image isn't
   * flagged; set this on the leading cards only — flagging everything defeats
   * the point and preloads offscreen images.
   */
  priority = input<boolean>(false);

  /**
   * Card artwork, `null` when the payload has none. Empty strings count as
   * missing: `ngSrc=""` throws NG02952, and adapted webinar payloads can carry
   * `''` for thumbnails the API left blank.
   */
  protected readonly thumbnail = computed<string | null>(() => {
    const c = this.card();
    return c.horizontal_thumbnail || c.thumbnail || c.square_thumbnail || null;
  });

  icons = signal({
    faSolidPlay,
    faSolidInfo,
    faSolidRobot,
    matBookmarkRound,
    matBookmarkBorderRound,
  });
  loading = signal(false);

  /**
   * Original `UpcomingPremiere` stashed on the adapted `Content` via the
   * `upcomingToContent` mapper. Non-null only when the card represents a
   * webinar AND the facade is available — both gate the CTA bar.
   */
  protected readonly webinar = computed<any | null>(() => {
    if (this.type() !== 'webinar' || !this.webinarFacade) return null;
    const w = (this.card()._webinar as any | undefined) ?? null;
    return w;
  });

  /** Same CTA decision tree used by `WebinarHero` and `PremiereListItem`. */
  protected readonly webinarCta = computed<WebinarCta | null>(() => {
    const w = this.webinar();
    return w ? ctaFor(w, this.auth.isLoggedIn()) : null;
  });

  /**
   * Attendance chip shown on the thumbnail of webinar cards that the user has
   * actually booked.
   *
   *   - `attendance_status === 'Absent'`     → "Absent" (red)
   *   - `attendance_status === 'Present'`    → "Present" (green)
   *   - `attendance_status === 'Attended'`   → "Attended" (emerald)
   *   - `attendance_status === 'Pending'` AND the webinar has already ended
   *     (last session's `end_date < now`, via `webinarTagFor`) → "Pending"
   *     (amber). Pending stays hidden for upcoming / live sessions — the
   *     host hasn't had a chance to mark attendance yet.
   */
  protected readonly attendanceTag = computed<{ label: string; classes: string } | null>(() => {
    const w = this.webinar();
    if (!w) return null;
    const enrollment = w.registered_webinar?.user_enrollments;
    if (!enrollment) return null;
    switch (enrollment.attendance_status) {
      case 'Absent':
        return { label: 'Absent', classes: 'bg-red-500 text-white' };
      case 'Present':
        return { label: 'Present', classes: 'bg-green-500 text-white' };
      case 'Attended':
        return { label: 'Attended', classes: 'bg-emerald-500 text-white' };
      case 'Pending':
        return webinarTagFor(w) === 'ended'
          ? { label: 'Pending', classes: 'bg-amber-500 text-white' }
          : null;
      default:
        return null;
    }
  });

  navigateToCourse(id: CairaUuid, title: string) {
    this.utils.navigateToCourse(this.type(), id, title);
  }

  openCourseInfo() {
    if (!this.card().allDataFetched) {
      this.loading.set(true);
      this.feature
        .getAbout(this.card().id, this.type() === 'micro-learning' ? 'micro_learning' : this.type())
        .subscribe({
          next: (res: any) => {
            const updatedCard = {
              ...this.card(),
              ...res.data,
              allDataFetched: true,
              learning_objective_list: res.data.learning_objectives.split('\r\n'),
            };
            this.card.set(updatedCard);
            this.utils.openCourseInfoDialog(this.card(), this.envInjector);
            this.loading.set(false);
          },
          error: (err: any) => {
            this.logger.error('Failed to load course info', err);
            this.loading.set(false);
          },
        });
    } else {
      this.loading.set(false);
      this.utils.openCourseInfoDialog(this.card(), this.envInjector);
    }
  }

  openVideoDialog() {
    this.utils.openVideoDialog(this.card().trailer_link, this.card().title);
  }

  toggleBookmark(event: Event) {
    event.stopPropagation();
    const t = this.type();
    // Webinar bookmarks aren't supported by the bookmark API course-type union,
    // so fall back to `masterclass` for that variant (matches the rest of the
    // platform — webinars don't surface a bookmark icon in the hero either).
    const apiType = t === 'micro-learning' ? 'micro_learning' : t === 'webinar' ? 'masterclass' : t;
    this.utils
      .toggleBookmarkCourse(this.card().id, { course_type: apiType })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((res) => {
        if (res.status) {
          this.card.update((c) => ({ ...c, added_bookmark: res.is_bookmarked }));
        }
      });
  }

  // ─── Webinar CTA handlers (delegate to facade / window.open) ─────────────

  /** Book / register flow — same auth-branch as `PremiereListItem.book()`. */
  protected bookWebinar(): void {
    const w = this.webinar();
    if (!w || !this.webinarFacade) return;
    if (!this.auth.isLoggedIn()) {
      this.webinarFacade.openRegistration(w);
      return;
    }
    this.webinarFacade.enroll(w).subscribe();
  }

  /** Open the live Zoom session in a new tab. */
  protected joinLive(): void {
    const w = this.webinar();
    if (!w) return;
    const url =
      w.registered_webinar?.user_enrollments?.join_url ??
      w.webinar_dates?.find((s: any) => s.join_url)?.join_url ??
      null;
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  }

  /** Open the recording in a new tab. */
  protected watchRecording(): void {
    const w = this.webinar();
    if (w?.video_recording) {
      window.open(w.video_recording, '_blank', 'noopener,noreferrer');
    }
  }

  /**
   * Navigate straight to the webinar's feedback route. The card lives on the
   * webinar listing (not the detail page), so we can't reuse the facade's
   * `router.url`-based composition — that would land on
   * `/.../webinar/feedback` instead of `/.../webinar/:id/:slug/feedback`.
   * `Utils.navigateToCourseFeedback` rebuilds the full URL from the resolved
   * country/profession + webinar id/title.
   */
  protected submitFeedback(): void {
    const w = this.webinar();
    if (!w) return;
    this.utils.navigateToCourseFeedback('webinar', w.id, w.webinar_title);
  }

  protected downloadCertificate(): void {
    const w = this.webinar();
    if (w && this.webinarFacade) this.webinarFacade.openCertificateDownloadDialog(w);
  }

  openAdditionalResources(): void {
    this.utils.openAdditionalResources(this.card().id);
  }
}
