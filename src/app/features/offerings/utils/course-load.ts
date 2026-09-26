import { HttpErrorResponse, httpResource } from '@angular/common/http';
import { computed, effect, inject, linkedSignal, signal } from '@angular/core';
import { apiUrl } from '@core/services/api-client/api-client';
import { Logger } from '@core/services/logger/logger';
import { RouteParams, RouteResponse } from '@core/models/http.model';
import { MASTERCLASS_ROUTES } from '@core/models/masterclass.model';
import { ContentDetails, CourseChapter, normalizeBookmarkField } from '@core/models/course.model';

type CourseDetailsResponse = RouteResponse<typeof MASTERCLASS_ROUTES.getCourseDetails>;
type CourseChapterResponse = RouteResponse<typeof MASTERCLASS_ROUTES.getCourseChapter>;
type CourseChapterParams = RouteParams<typeof MASTERCLASS_ROUTES.getCourseChapter>;

export type CourseLoadParams = Pick<CourseChapterParams, 'id' | 'course_type'>;

/**
 * One course's details and chapters: the two reads the course page and the
 * chapter player both need, which each facade used to hand-roll as a `forkJoin`.
 * Call it from a field initializer, since it creates `httpResource`s.
 *
 * `details`/`chapters` are `linkedSignal`s, not `computed`: the CPE-mode switch,
 * the quiz report, activity tracking and the cart all edit the loaded course in
 * place. A new load replaces those edits. Loading, a failure, or an empty payload
 * keep what is shown, as the old subscription did. Only `clear()` empties it.
 * Neither signal updates until BOTH reads answer: the `forkJoin` set neither on a failure.
 * Responses are reused from Angular's HTTP transfer cache after SSR.
 */
export function courseLoad() {
  const logger = inject(Logger);
  const params = signal<CourseLoadParams | null>(null);

  const detailsResource = httpResource<ContentDetails | null>(
    () => {
      const p = params();
      if (!p) return undefined;
      return {
        url: apiUrl(
          MASTERCLASS_ROUTES.getCourseDetails.path.replace(':course_type', p.course_type),
        ),
        params: { id: p.id },
      };
    },
    {
      parse: (raw) => {
        const data = (raw as CourseDetailsResponse).data;
        if (!data) return null;
        data.learning_objective_list = data.learning_objectives.split('\r\n');
        return normalizeBookmarkField(data);
      },
    },
  );

  const chaptersResource = httpResource<CourseChapter[] | null>(
    () => {
      const p = params();
      if (!p) return undefined;
      const query: CourseChapterParams = { id: p.id, course_type: p.course_type };
      return { url: apiUrl(MASTERCLASS_ROUTES.getCourseChapter.path), params: query };
    },
    { parse: (raw) => (raw as CourseChapterResponse).data ?? null },
  );

  /** Both reads, as the server sent them, once BOTH have answered. */
  const loaded = computed(() =>
    detailsResource.hasValue() && chaptersResource.hasValue()
      ? { details: detailsResource.value(), chapters: chaptersResource.value() }
      : null,
  );

  const source = () => ({ params: params(), loaded: loaded() });

  const details = linkedSignal({
    source,
    computation: ({ params, loaded }, previous?: { value: ContentDetails | null }) =>
      params ? (loaded?.details ?? previous?.value ?? null) : null,
  });

  const chapters = linkedSignal({
    source,
    computation: ({ params, loaded }, previous?: { value: CourseChapter[] }) =>
      params ? (loaded?.chapters ?? previous?.value ?? []) : [],
  });

  const failure = computed(() => detailsResource.error() ?? chaptersResource.error());

  effect(() => {
    const err = failure();
    if (err) logger.error('Failed to load course', err);
  });

  return {
    /** The course being shown, or `null`. */
    params: params.asReadonly(),
    details,
    chapters,
    /** The freshly loaded details, before any local edit — fires once per load. */
    loadedDetails: computed(() => loaded()?.details ?? null),
    isLoading: computed(() => detailsResource.isLoading() || chaptersResource.isLoading()),
    error: computed<string | null>(() => {
      const err = failure();
      if (!err) return null;
      return (
        (err instanceof HttpErrorResponse && err.error?.message) || 'Failed to load course data'
      );
    }),
    load: (next: CourseLoadParams) => params.set({ id: next.id, course_type: next.course_type }),
    clear: () => params.set(null),
  };
}
