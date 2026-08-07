import { Pipe, PipeTransform } from '@angular/core';
import { FieldOfStudy } from '../../models/course.model';

@Pipe({
  name: 'totalCpeCredits',
  standalone: true,
})
export class TotalCpeCreditsPipe implements PipeTransform {
  transform(fields: FieldOfStudy[] | null | undefined, fallback = 0): number {
    if (!fields?.length) return fallback;
    return fields.reduce((sum, f) => sum + (f.cpe_credits ?? 0), 0);
  }
}
