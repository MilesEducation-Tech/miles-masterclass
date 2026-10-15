import { httpResource } from '@angular/common/http';
import { computed, effect, inject, Service } from '@angular/core';
import { environment } from '@env/environment';
import { MASTERCLASS_COURSE_TYPE } from '@core/constants/masterclass';
import { MasterclassCourse, parseCoursePage } from '@core/models/masterclass-home.model';
import { apiUrl } from '@core/services/api-client/api-client';
import { Logger } from '@core/services/logger/logger';

/**
 * The admin-pinned courses (`PinnedCourseLink`, by priority) for the hero.
 * Web-only, `AllowAny`, no `login_type`; a valid token only fills
 * `is_bookmarked`, which the hero does not read. Postman
 * `web-masterclass-highlight-v1`. Replaced `v2/dashboard/?filter=popular`, a
 * 404 on every host.
 */
const HIGHLIGHT_URL = `${environment.BASE_API_URL}web-api/v1/masterclass/highlight/`;

/**
 * Every pinned course in one call (the API's ceiling; default 6). The list is
 * named `all_courses` in the query string — the form the API's own `next` link
 * uses. UAT pins 10.
 */
const HIGHLIGHT_PAGE_SIZE = 100;

/**
 * The masterclass hero. Route-scoped: only `/masterclass` renders it.
 *
 * Fetched on the server too — the hero is the first viewport, and the read is
 * anonymous — so the SSR HTML carries it and the browser reuses the response
 * from the transfer cache.
 */
@Service({ autoProvided: false })
export class MasterclassHighlightFacade {
  private readonly logger = inject(Logger);

  private readonly highlight = httpResource<MasterclassCourse[]>(
    () => ({
      url: apiUrl(HIGHLIGHT_URL),
      params: {
        'all_courses.page_size': HIGHLIGHT_PAGE_SIZE,
        course_type: MASTERCLASS_COURSE_TYPE,
      },
    }),
    { defaultValue: [], parse: parseCoursePage('highlight') },
  );

  /**
   * The slides, in the API's order. A course with no artwork at all is
   * dropped: binding `ngSrc=""` throws NG02952 and kills the render.
   */
  readonly courses = computed<MasterclassCourse[]>(() =>
    this.highlight.hasValue()
      ? this.highlight
          .value()
          .filter(({ thumbnails: t }) => !!(t.horizontal || t.vertical || t.square))
      : [],
  );

  readonly isLoading = computed(() => this.highlight.isLoading());

  // The hero hides on failure, so the log is the only place a drift shows.
  private readonly loadErrorLog = effect(() => {
    const error = this.highlight.error();
    if (error) this.logger.error('[MasterclassHighlightFacade] highlight load failed', error);
  });
}
