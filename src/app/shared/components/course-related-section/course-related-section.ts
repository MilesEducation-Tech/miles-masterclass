import { httpResource } from '@angular/common/http';
import { Component, computed, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, forkJoin, of } from 'rxjs';
import { Carousel } from '../carousel/carousel';
import { Horizontal } from '../cards/horizontal/horizontal';
import { Square } from '../cards/square/square';
import { Content, InstructorDetails } from '@core/models/course.model';
import { CommonResponse } from '@core/models/http.model';
import {
  InstructorCoursesData,
  InstructorCoursesResponse,
  RelatedContentType,
  RELATED_CONTENT_ROUTES,
} from '@core/models/related-content.model';
import { ApiClient, apiUrl } from '@core/services/api-client/api-client';
import { Logger } from '@core/services/logger/logger';
import { swiperConfigEven, swiperConfigPodcast } from '@core/config/swiper.config';

/** Empty envelope for the related-content resource's `defaultValue`. */
const EMPTY_RELATED: CommonResponse<Content[]> = {
  data: [],
  status: false,
  message: '',
};

interface InstructorCarousel {
  instructorId: number;
  fullName: string;
  cards: Content[];
}

/**
 * Course detail page extension: one "More by &lt;Instructor&gt;" carousel per
 * instructor (lead + co-instructors). Lazy — only fetches when inputs land.
 *
 * Card variant differs by host page:
 *   • masterclass → app-horizontal (16:9 promo card)
 *   • podcast     → app-square with carousel hover animation
 */
@Component({
  selector: 'app-course-related-section',
  imports: [Carousel, Horizontal, Square],
  templateUrl: './course-related-section.html',
  host: { class: 'block' },
})
export class CourseRelatedSection {
  readonly courseId = input.required<number>();
  readonly courseType = input.required<RelatedContentType>();
  /** Lead instructor + co-instructors from the current course. */
  readonly instructors = input<InstructorDetails | null>(null);

  private readonly http = inject(ApiClient);
  private readonly logger = inject(Logger);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * Related content for the current course.
   *
   * The request function reads `courseId()`/`courseType()` directly, which is the
   * whole point of the conversion: the old version was an `effect()` that called
   * `.subscribe()` and wrote a signal, and that effect re-fired whenever
   * `courseType()` changed even if `courseId()` had not. A resource re-requests
   * only when its request object actually differs.
   *
   * `defaultValue` AND the `hasValue()` guard below are both required — a default
   * covers idle and loading, but `value()` still throws in the error state, and a
   * failed related-content fetch must collapse the section rather than take the
   * course page down. That replaces the old `catchError` + `Logger.warn`, and the
   * failure is now observable via `relatedResource.error()` instead of discarded.
   */
  private readonly relatedResource = httpResource<CommonResponse<Content[]>>(
    () => {
      const id = this.courseId();
      const type = this.courseType();
      // undefined = idle, no request. Matches the old `if (!id || !type) return`.
      if (!id || !type) return undefined;
      return {
        url: apiUrl(RELATED_CONTENT_ROUTES.getRelatedContent.path),
        params: { id, type },
      };
    },
    { defaultValue: EMPTY_RELATED },
  );

  /**
   * Defensive filter: hide the current course if the API mistakenly includes it in
   * its own related list. This now reads `courseId()` inside a `computed`, so it
   * tracks properly — the old version read it inside a `.subscribe()` callback,
   * outside any reactive context.
   */
  protected readonly relatedCards = computed<Content[]>(() => {
    const rows = this.relatedResource.hasValue() ? (this.relatedResource.value()?.data ?? []) : [];
    const id = this.courseId();
    return rows.filter((c) => c.id !== id);
  });

  protected readonly instructorCarousels = signal<InstructorCarousel[]>([]);

  protected readonly swiperConfig = computed(() =>
    this.courseType() === 'podcast' ? swiperConfigPodcast : swiperConfigEven,
  );
  protected readonly skeletonClass = computed(() =>
    this.courseType() === 'podcast' ? 'aspect-square' : 'aspect-video',
  );

  protected readonly hasAnyContent = computed(
    () => this.relatedCards().length > 0 || this.instructorCarousels().length > 0,
  );

  constructor() {
    // No effect for related content any more — `relatedResource`'s request
    // function is the trigger, and it fires as soon as the (id, type) pair lands.

    // Lead + co-instructors are fetched in parallel; an instructor with no
    // courses of the current type is dropped so the page doesn't render an
    // empty carousel.
    effect(() => {
      const details = this.instructors();
      const type = this.courseType();
      if (!details || !type) {
        this.instructorCarousels.set([]);
        return;
      }
      const ids = this.collectInstructorIds(details);
      if (!ids.length) {
        this.instructorCarousels.set([]);
        return;
      }
      this.loadInstructorCourses(details, ids, type);
    });
  }

  private collectInstructorIds(details: InstructorDetails): number[] {
    const all: number[] = [details.id];
    for (const co of details.other_instructors ?? []) {
      if (co?.id && !all.includes(co.id)) all.push(co.id);
    }
    return all;
  }

  private loadInstructorCourses(
    details: InstructorDetails,
    ids: number[],
    type: RelatedContentType,
  ): void {
    const nameById = this.buildNameMap(details);
    const requests = ids.map((iid) =>
      this.http
        .get<InstructorCoursesResponse>(
          RELATED_CONTENT_ROUTES.getInstructorCourses.path.replace(':id', String(iid)),
          { params: { page: 1, type } },
        )
        .pipe(
          catchError((err) => {
            this.logger.warn(`Instructor ${iid} courses fetch failed`, err);
            return of(null);
          }),
        ),
    );

    forkJoin(requests)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((responses) => {
        const out: InstructorCarousel[] = [];
        responses.forEach((res, i) => {
          if (!res) return;
          const iid = ids[i];
          const cards = this.collectCardsFor(res.data, type).filter(
            (c) => c.id !== this.courseId(),
          );
          if (!cards.length) return;
          out.push({
            instructorId: iid,
            fullName: nameById.get(iid) ?? 'Instructor',
            cards,
          });
        });
        this.instructorCarousels.set(out);
      });
  }

  /**
   * Server already filtered the response to the requested type via the
   * `?type=` query param; just read the matching bucket out.
   */
  private collectCardsFor(data: InstructorCoursesData, pageType: RelatedContentType): Content[] {
    return data?.[pageType] ?? [];
  }

  private buildNameMap(details: InstructorDetails): Map<number, string> {
    const map = new Map<number, string>();
    map.set(details.id, `${details.first_name} ${details.last_name}`.trim());
    for (const co of details.other_instructors ?? []) {
      if (co?.id) {
        map.set(co.id, `${co.first_name} ${co.last_name}`.trim());
      }
    }
    return map;
  }
}
