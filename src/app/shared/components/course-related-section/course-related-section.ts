import { Component, computed, input } from '@angular/core';
import { Carousel } from '../carousel/carousel';
import { Horizontal } from '../cards/horizontal/horizontal';
import { Square } from '../cards/square/square';
import { swiperConfigEven, swiperConfigPodcast } from '../../core/config/swiper.config';
import { CairaUuid } from '../../core/models/caira/envelope.model';
import { CourseCard } from '../../core/models/caira/masterclass.model';
import { InstructorCarousel } from '../../core/models/caira/course-detail.model';

/**
 * Course detail page extension: a "Related Courses" rail plus one
 * "More by &lt;Instructor&gt;" carousel per instructor.
 *
 * Both lists arrive as inputs rather than being fetched here. CAIRA serves them
 * inside `Masterclass_Course_Detail` (#4) — `related_courses` and
 * `instructor_related_courses` — so the course page already holds them, and a
 * shared component reaching back into a route-scoped feature service to
 * re-derive what its parent has would invert the dependency for no gain.
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
  readonly courseId = input.required<CairaUuid>();
  readonly courseType = input.required<'masterclass' | 'podcast'>();
  /** Lead instructor + co-instructors from the current course. */
  readonly instructors = input<unknown | null>(null);

  readonly relatedCards = input<CourseCard[]>([]);
  readonly instructorCarousels = input<InstructorCarousel[]>([]);

  protected readonly swiperConfig = computed(() =>
    this.courseType() === 'podcast' ? swiperConfigPodcast : swiperConfigEven,
  );
  protected readonly skeletonClass = computed(() =>
    this.courseType() === 'podcast' ? 'aspect-square' : 'aspect-video',
  );

  protected readonly hasAnyContent = computed(
    () => this.relatedCards().length > 0 || this.instructorCarousels().length > 0,
  );
}
