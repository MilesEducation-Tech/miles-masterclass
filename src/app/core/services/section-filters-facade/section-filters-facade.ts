import { HttpContext } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable, catchError, map, of, shareReplay } from 'rxjs';
import { ApiClient } from '@core/services/api-client/api-client';
import { SKIP_ERROR_NOTIFICATION } from '@core/models/http.model';
import {
  ApiCourseType,
  LibraryFiltersData,
  SectionApiKey,
} from '@core/models/library-filters.model';

/**
 * `GET /v2/filters/` envelope. Differs from `FeatureApiResponse` in that it
 * exposes `status_code` (number) rather than `status` (boolean).
 */
interface SectionFiltersEnvelope {
  status_code?: number;
  message?: string;
  data?: Partial<LibraryFiltersData>;
}

/**
 * Fetches the server-driven filter universe for a carousel section.
 *
 * - Returns `null` on HTTP error, missing/empty `data`, or when every group
 *   in the response is empty — so the carousel can fall back to client-side
 *   filter extraction without showing a toast or empty dialog.
 * - Caches per `${courseType}:${section}:${trackId}` for the session (filter
 *   universes are stable; the values applied don't change them).
 */
@Service()
export class SectionFiltersFacade {
  private readonly api = inject(ApiClient);
  private readonly cache = new Map<string, Observable<LibraryFiltersData | null>>();

  fetch(
    courseType: ApiCourseType,
    section: SectionApiKey,
    trackId?: number,
  ): Observable<LibraryFiltersData | null> {
    const key = `${courseType}:${section}:${trackId ?? ''}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    const params: Record<string, string | number> = {
      course_type: courseType,
      section,
    };
    if (section === 'track' && trackId != null) params['track_id'] = trackId;

    const context = new HttpContext().set(SKIP_ERROR_NOTIFICATION, true);

    const stream: Observable<LibraryFiltersData | null> = this.api
      .get<SectionFiltersEnvelope>('v2/filters/', { params, context })
      .pipe(
        map((res) => {
          const data = res?.data;
          if (!data || isAllEmpty(data)) return null;
          return normalize(data);
        }),
        catchError(() => of(null)),
        shareReplay({ bufferSize: 1, refCount: false }),
      );

    this.cache.set(key, stream);
    return stream;
  }

  /**
   * Drop cached filter universes so subsequent `fetch` calls hit the network.
   * Call with no args to clear everything, or pass `courseType`/`section` to
   * scope the eviction. Useful when the backend signals the universe changed
   * (e.g. an instructor was added) without forcing a full page reload.
   */
  clear(courseType?: ApiCourseType, section?: SectionApiKey): void {
    if (!courseType && !section) {
      this.cache.clear();
      return;
    }
    const cPrefix = courseType ?? '';
    for (const key of Array.from(this.cache.keys())) {
      const [c, s] = key.split(':');
      if (courseType && c !== cPrefix) continue;
      if (section && s !== section) continue;
      this.cache.delete(key);
    }
  }
}

function isAllEmpty(data: Partial<LibraryFiltersData>): boolean {
  return (
    !data.instructors?.length &&
    !data.categories?.length &&
    !data.fields_of_study?.length &&
    !data.additional_categories?.length &&
    !data.caira_levels?.length &&
    !data.cpe_credits?.length
  );
}

function normalize(data: Partial<LibraryFiltersData>): LibraryFiltersData {
  return {
    instructors: data.instructors ?? [],
    categories: data.categories ?? [],
    fields_of_study: data.fields_of_study ?? [],
    additional_categories: data.additional_categories ?? [],
    caira_levels: data.caira_levels ?? [],
    cpe_credits: data.cpe_credits ?? [],
    tracks: data.tracks,
  };
}
