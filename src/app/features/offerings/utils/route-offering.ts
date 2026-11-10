import { ActivatedRoute } from '@angular/router';
import { COURSE_DETAIL_API } from '@features/offerings/constants/course-detail';
import { CourseOffering } from '@features/offerings/models/course-detail.model';

/**
 * The route data key naming a course tree's offering. The podcast course route
 * sets it; the masterclass one doesn't need to (the default).
 */
export const COURSE_OFFERING_DATA_KEY = 'offering';

/**
 * Which offering a shared course page (the exam, the report, the evaluation)
 * belongs to, from its route's data: the course route is componentless, so its
 * children inherit its data. Read from the snapshot, because the pages connect
 * `CourseDetailFacade` in their constructors, before inputs are bound.
 */
export function routeOffering(route: ActivatedRoute): CourseOffering {
  const offering: unknown = route.snapshot.data[COURSE_OFFERING_DATA_KEY];
  return isCourseOffering(offering) ? offering : 'masterclass';
}

const isCourseOffering = (v: unknown): v is CourseOffering =>
  typeof v === 'string' && Object.hasOwn(COURSE_DETAIL_API, v);
