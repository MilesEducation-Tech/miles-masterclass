import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { ApiClient } from '@core/services/api-client/api-client';
import { Content } from '@core/models/course.model';
import { FeatureApiResponse } from '@core/models/feature.model';

/** One CAIRA level (1 / 2 / 3) with the course-library content tagged to it. */
export interface CairaLevelGroup {
  id: number;
  name: string;
  courses: Content[];
}

const LIBRARY_URL = 'v2/library/';

/** Fixed CAIRA levels — passed straight through as the `caira_levels` param. */
const CAIRA_LEVELS = [1, 2, 3] as const;

/**
 * Route-scoped facade for the UAE CAIRA landing page.
 *
 * Sources the "CAIRA Levels 1/2/3" section straight from the course library.
 * For each level (1, 2, 3) it calls
 * `GET v2/library/?course_type=masterclass&caira_levels=<level>` and groups the
 * returned masterclasses. The level values are fixed, so there's no
 * `library-filters` lookup.
 *
 * Browser-only (mirrors `CourseFacade` / `BadgeFacade`) so SSR renders the
 * page's static marketing sections without firing authed library calls; the
 * level carousels hydrate client-side.
 */
@Injectable()
export class UaeCairaFacade {
  private readonly api = inject(ApiClient);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** CAIRA levels (only those that returned at least one course). */
  readonly levels = toSignal(this.loadLevels(), { initialValue: [] as CairaLevelGroup[] });

  private loadLevels(): Observable<CairaLevelGroup[]> {
    if (!this.isBrowser) return of<CairaLevelGroup[]>([]);

    return forkJoin(CAIRA_LEVELS.map((level) => this.loadLevelCourses(level))).pipe(
      map((groups) => groups.filter((group) => group.courses.length > 0)),
      catchError(() => of<CairaLevelGroup[]>([])),
    );
  }

  private loadLevelCourses(level: number): Observable<CairaLevelGroup> {
    return this.api
      .get<FeatureApiResponse<Content[]>>(LIBRARY_URL, {
        params: { course_type: 'masterclass', caira_levels: String(level), page: 1 },
      })
      .pipe(
        map((res) => ({ id: level, name: `CAIRA Level ${level}`, courses: res?.data ?? [] })),
        catchError(() => of({ id: level, name: `CAIRA Level ${level}`, courses: [] as Content[] })),
      );
  }
}
