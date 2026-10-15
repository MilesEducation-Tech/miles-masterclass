import { Component } from '@angular/core';
import { Backward } from '@shared/components/backward/backward';

/**
 * `/instructor/:instructorId/:instructorName`. The retired `instructor/:id/`
 * and `instructor/:id/courses/` reads are gone; the page is bound to
 * `instructor-detail/` and `filter/` next (MIL-95), so until then it shows only
 * the Back link.
 */
@Component({
  selector: 'app-instructor-details',
  imports: [Backward],
  templateUrl: './instructor-details.html',
})
export class InstructorDetails {}
