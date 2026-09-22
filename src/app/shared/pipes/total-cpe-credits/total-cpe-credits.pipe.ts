import { Pipe, PipeTransform } from '@angular/core';
import { FieldOfStudy } from '@core/models/course.model';

@Pipe({
  name: 'totalCpeCredits',
  standalone: true,
})
export class TotalCpeCreditsPipe implements PipeTransform {
  transform(fields: FieldOfStudy[] | null | undefined, fallback = 0): number {
    if (!fields?.length) return fallback;
    // Fields can arrive without per-field credits; don't render a bare 0 when
    // the course-level `class_credits` fallback knows the real value.
    return fields.reduce((sum, f) => sum + (f.cpe_credits ?? 0), 0) || fallback;
  }
}
