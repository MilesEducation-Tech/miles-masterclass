import { isPlatformBrowser } from '@angular/common';
import { HttpContext, httpResource } from '@angular/common/http';
import {
  computed,
  inject,
  linkedSignal,
  PLATFORM_ID,
  ResourceSnapshot,
  Service,
  signal,
  untracked,
} from '@angular/core';
import { NgpDialogManager } from 'ng-primitives/dialog';
import { map } from 'rxjs';
import { SKIP_LOADING } from '@core/models/http.model';
import { MasterclassCourse } from '@core/models/masterclass-home.model';
import { ApiClient } from '@core/services/api-client/api-client';
import { Logger } from '@core/services/logger/logger';
import { NotificationService } from '@core/services/notification/notification';
import { withPreviousValue } from '@core/utils/with-previous-value';
import type { UtilsDialogData } from '@shared/dialogs/utils-dialog/utils-dialog';
import {
  AI_KIT_CONTENT_TYPE,
  COURSE_LIBRARY_PAGE_SIZE,
  COURSE_LIBRARY_URL,
  COURSE_RESOURCES_COPY,
  COURSE_RESOURCES_ROUTE,
  EMPTY_LIBRARY_SELECTION,
  LIBRARY_FILTER_GROUPS,
} from '@features/library/course/constants/course-library';
import {
  CourseLibraryPage,
  CourseResources,
  LibraryCourseType,
  LibraryFilterGroup,
  LibraryFilterSelection,
  parseCourseLibrary,
  parseCourseResources,
} from '@features/library/course/models/course-library.model';

/**
 * Owns course-listing state for `/library/course-library`. Lazy by
 * `providedIn: 'root'`: it is created only when the Course page injects it,
 * so the Instructor and Badge libraries never touch it.
 *
 * One read, `filter/`, answers both the sidebar's options and a page of
 * cards. Browser-only, as the page has always been.
 */
@Service()
export class CourseFacade {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly api = inject(ApiClient);
  private readonly dialogs = inject(NgpDialogManager);
  private readonly notification = inject(NotificationService);
  private readonly logger = inject(Logger);

  readonly courseType = signal<LibraryCourseType>('course');
  readonly selection = signal<LibraryFilterSelection>(EMPTY_LIBRARY_SELECTION);
  private readonly page = signal(1);

  private readonly rawResource = httpResource<CourseLibraryPage>(
    () => {
      if (!this.isBrowser) return undefined;
      const page = this.page();
      const params: Record<string, string | number> = {
        course_type: this.courseType(),
        page,
        page_size: COURSE_LIBRARY_PAGE_SIZE,
      };
      for (const [key, values] of Object.entries(this.selection())) {
        if (values.length > 0) params[key] = values.join(',');
      }
      return {
        url: COURSE_LIBRARY_URL,
        params,
        // Later pages show their own "Loading…" under the grid.
        context: page > 1 ? new HttpContext().set(SKIP_LOADING, true) : undefined,
      };
    },
    // The trust boundary: an answer that drifted from the contract lands in `error()`.
    { parse: parseCourseLibrary },
  );

  /** Holds the last answer while the next page or selection loads. */
  private readonly libraryResource = withPreviousValue(this.rawResource);

  private readonly latest = computed(() =>
    this.libraryResource.hasValue() ? this.libraryResource.value() : undefined,
  );

  /**
   * The sidebar groups, in production's order, from the latest answer. Held
   * through the next load, since the API does not narrow them by selection. A
   * group with no options is dropped, and only AI Kit is offered from the
   * content types: the tabs already cover the rest.
   */
  readonly groups = computed<readonly LibraryFilterGroup[]>(() => {
    const filters = this.latest()?.filters;
    if (!filters) return [];
    return LIBRARY_FILTER_GROUPS.map(({ key, label }) => ({
      key,
      label,
      options:
        key === 'content_type'
          ? filters.content_type.filter((option) => option.value === AI_KIT_CONTENT_TYPE)
          : filters[key],
    })).filter((group) => group.options.length > 0);
  });

  /** Every page loaded so far; page 1 starts the list over. */
  readonly courses = linkedSignal<
    ResourceSnapshot<CourseLibraryPage | undefined>,
    MasterclassCourse[]
  >({
    source: this.libraryResource.snapshot,
    computation: (snap, previous) => {
      if (snap.status === 'resolved' && snap.value) {
        const { page, courses } = snap.value;
        return page === 1 ? courses : [...(previous?.value ?? []), ...courses];
      }
      // A new tab or selection empties the grid while page 1 loads.
      return untracked(this.page) === 1 ? [] : (previous?.value ?? []);
    },
  });

  readonly hasNext = computed(() => this.latest()?.hasNext ?? false);
  readonly isLoading = computed(() => this.libraryResource.isLoading());
  readonly error = computed(() => this.libraryResource.error());

  readonly selectedCount = computed(() =>
    Object.values(this.selection()).reduce((n, values) => n + values.length, 0),
  );

  selectCourseType(type: LibraryCourseType): void {
    if (type === this.courseType()) return;
    this.page.set(1);
    this.courseType.set(type);
  }

  setSelection(selection: LibraryFilterSelection): void {
    this.page.set(1);
    this.selection.set(selection);
  }

  clearSelection(): void {
    this.setSelection(EMPTY_LIBRARY_SELECTION);
  }

  loadNextPage(): void {
    if (this.isLoading() || !this.hasNext()) return;
    this.page.update((page) => page + 1);
  }

  reload(): void {
    this.rawResource.reload();
  }

  /**
   * The card's AI Kit button: reads the course's extras and lists them in the
   * "Additional Resources" dialog, the kit first, as the legacy button did.
   */
  openAiKit(course: MasterclassCourse): void {
    const route = COURSE_RESOURCES_ROUTE;
    this.api
      .call({ ...route, path: route.path.replace(':id', course.id) }, undefined, {
        params: { login_type: 'pre_login' },
      })
      .pipe(map(parseCourseResources))
      .subscribe({
        next: (resources) => void this.showResources(resources),
        error: (error: unknown) => {
          this.logger.error('Failed to fetch additional resources', error);
          this.notification.error(
            COURSE_RESOURCES_COPY.errorTitle,
            COURSE_RESOURCES_COPY.errorMessage,
          );
        },
      });
  }

  private async showResources({ aiKit, exerciseFiles }: CourseResources): Promise<void> {
    const links = [
      ...(aiKit
        ? [
            {
              label: aiKit.name,
              href: aiKit.url,
              description: aiKit.description ?? COURSE_RESOURCES_COPY.aiKit,
            },
          ]
        : []),
      ...exerciseFiles.map(({ name, url }) => ({
        label: name,
        href: url,
        description: COURSE_RESOURCES_COPY.exerciseFile,
      })),
    ];
    if (!links.length) {
      this.notification.info(COURSE_RESOURCES_COPY.emptyTitle, COURSE_RESOURCES_COPY.emptyMessage);
      return;
    }
    // Loaded on open: only an AI Kit click needs it.
    const { UtilsDialog } = await import('@shared/dialogs/utils-dialog/utils-dialog');
    this.dialogs.open<UtilsDialogData>(UtilsDialog, {
      data: {
        title: COURSE_RESOURCES_COPY.title,
        containerClass: 'max-w-lg text-start!',
        content: [{ type: 'links', items: links }],
        buttons: [{ label: 'Close', variant: 'default', action: 'close' }],
      },
    });
  }
}
