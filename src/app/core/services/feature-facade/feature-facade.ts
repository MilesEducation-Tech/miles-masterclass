import { inject, Service } from '@angular/core';
import { FEATURE_ROUTES } from '@core/models/feature.model';
import { ApiClient } from '@core/services/api-client/api-client';
import { normalizeBookmarkField } from '@core/models/course.model';
import { map } from 'rxjs/operators';
import { Observable } from 'rxjs';

/**
 * The `about` endpoint's nano-learning serializer ships `fields_of_study` as
 * bare ids (`[45]`) instead of the `{ id, name, cpe_credits }` objects every
 * other course type returns. Drop the degenerate list so callers spreading the
 * about payload over a card keep the card's real one, and `totalCpeCredits`
 * falls back to `class_credits` instead of summing `undefined` to 0.
 * ponytail: remove once the backend serializer is fixed.
 */
function dropIdOnlyFieldsOfStudy<T>(data: T): T {
  const fields = (data as { fields_of_study?: unknown })?.fields_of_study;
  if (!Array.isArray(fields) || fields.every((f) => typeof f === 'object' && f !== null)) {
    return data;
  }
  const rest = { ...(data as Record<string, unknown>) };
  delete rest['fields_of_study'];
  return rest as T;
}

/**
 * The legacy `about/` read behind the shared cards' course-info dialog (`hover`, `horizontal` and
 * `vertical`). Its listing cache went with the reels epic (MIL-184): every page that rendered a
 * cached listing now reads the web API through its own facade.
 */
@Service()
export class FeatureFacade {
  private readonly api = inject(ApiClient);

  getAbout<T = unknown>(id: number, type = 'masterclass'): Observable<{ data: T }> {
    const url = FEATURE_ROUTES.about.path.replace(':id', id.toString());
    const params = type ? { course_type: type } : undefined;
    return this.api
      .get<{ data: T }>(url, { params })
      .pipe(
        map((res) =>
          res ? { ...res, data: dropIdOnlyFieldsOfStudy(normalizeBookmarkField(res.data)) } : res,
        ),
      );
  }
}
