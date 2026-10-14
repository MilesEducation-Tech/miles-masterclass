import { Service, signal } from '@angular/core';
import { ApiCourseType } from '@core/models/library-filters.model';

/**
 * Owns course-listing state for `/library/course-library`. Lazy by
 * `providedIn: 'root'`: it is created only when the Course page injects it,
 * so the Instructor and Badge libraries never touch it.
 */
@Service()
export class CourseFacade {
  readonly courseType = signal<ApiCourseType>('masterclass');

  selectCourseType(type: ApiCourseType): void {
    this.courseType.set(type);
  }
}
