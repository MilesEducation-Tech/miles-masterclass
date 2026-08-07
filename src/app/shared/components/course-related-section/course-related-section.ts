import { Component, computed, inject, input, signal } from '@angular/core';
import { Carousel } from '../carousel/carousel';
import { Horizontal } from '../cards/horizontal/horizontal';
import { Square } from '../cards/square/square';
import { Logger } from '../../core/services/logger/logger';
import { swiperConfigEven, swiperConfigPodcast } from '../../core/config/swiper.config';

interface InstructorCarousel {
  instructorId: number;
  fullName: string;
  cards: any[];
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
  readonly courseType = input.required<any>();
  /** Lead instructor + co-instructors from the current course. */
  readonly instructors = input<any | null>(null);

  private readonly logger = inject(Logger);

  // ponytail: both carousels used to be filled by `relatedContent` and
  // `instructorCourses` GETs. Feed these two signals from the new backend and
  // the template, carousel config and card variants all work unchanged.
  protected readonly relatedCards = signal<any[]>([]);
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
    this.logger.warn('CourseRelatedSection: no backend configured — carousels stay empty');
  }

  /**
   * Group instructor courses into one carousel per instructor. Kept because it
   * is presentation logic, not transport: hand it the new backend's response
   * and `instructorCarousels` renders as before.
   */
  protected buildInstructorCarousels(
    details: any,
    coursesByInstructorId: Map<number, any[]>,
  ): void {
    const nameById = this.buildNameMap(details);
    const out: InstructorCarousel[] = [];
    for (const [iid, courses] of coursesByInstructorId) {
      // An instructor with no courses of the current type is dropped so the
      // page doesn't render an empty carousel.
      const cards = courses.filter((c) => c.id !== this.courseId());
      if (!cards.length) continue;
      out.push({ instructorId: iid, fullName: nameById.get(iid) ?? 'Instructor', cards });
    }
    this.instructorCarousels.set(out);
  }

  private buildNameMap(details: any): Map<number, string> {
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
