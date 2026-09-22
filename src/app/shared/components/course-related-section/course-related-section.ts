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
import { ApiClient } from '@core/services/api-client/api-client';
import { Logger } from '@core/services/logger/logger';
import { swiperConfigEven, swiperConfigPodcast } from '@core/config/swiper.config';

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
  styleUrl: './course-related-section.css',
})
export class CourseRelatedSection {
  readonly courseId = input.required<number>();
  readonly courseType = input.required<RelatedContentType>();
  /** Lead instructor + co-instructors from the current course. */
  readonly instructors = input<InstructorDetails | null>(null);

  private readonly http = inject(ApiClient);
  private readonly logger = inject(Logger);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly relatedCards = signal<Content[]>([]);
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
    // Related-content fetch — fires as soon as the (id, type) pair lands.
    effect(() => {
      const id = this.courseId();
      const type = this.courseType();
      if (!id || !type) return;
      this.loadRelated(id, type);
    });

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

  private loadRelated(id: number, type: RelatedContentType): void {
    this.http
      .get<CommonResponse<Content[]>>(RELATED_CONTENT_ROUTES.getRelatedContent.path, {
        params: { id, type },
      })
      .pipe(
        catchError((err) => {
          this.logger.warn('Related content fetch failed', err);
          return of({
            data: [],
            status: false,
            status_code: 0,
            message: '',
          } as CommonResponse<Content[]>);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((res) => {
        // Defensive filter: hide the current course if the API mistakenly
        // includes it in its own related list.
        const filtered = (res.data ?? []).filter((c) => c.id !== this.courseId());
        this.relatedCards.set(filtered);
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
