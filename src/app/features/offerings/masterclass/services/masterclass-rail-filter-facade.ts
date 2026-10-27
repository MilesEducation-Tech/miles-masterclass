import { computed, effect, inject, Service, signal, untracked } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { NgpDialogManager } from 'ng-primitives/dialog';
import { forkJoin, map, Observable, of, switchMap, take } from 'rxjs';
import { ApiClient } from '@core/services/api-client/api-client';
import { Logger } from '@core/services/logger/logger';
import {
  MASTERCLASS_FILTER_PARAMS,
  MASTERCLASS_FILTER_ROUTE,
} from '@features/offerings/masterclass/constants/masterclass';
import { MasterclassRail } from '@features/offerings/masterclass/models/masterclass-library.model';
import {
  CourseFilterIndex,
  FilteredRail,
  FilterPage,
  LevelCourses,
  parseFilterPage,
  RailFilterDialogData,
  RailFilterSelection,
} from '@features/offerings/masterclass/models/masterclass-rail-filter.model';
import {
  buildFilterIndex,
  matchesSelection,
  railFilterOptions,
  selectedCount,
  selectionFromDialog,
} from '@features/offerings/masterclass/utils/masterclass-rail-filter';

/**
 * The filter icon on the masterclass page's rails, the signed-in ones and the
 * tracks. Route-scoped, like the page's other facades, so each rail's
 * selection lasts the visit.
 *
 * The cards carry fields of study and credits but no instructors, additional
 * categories or level. The first open reads those from `filter/`, once for
 * every rail: one read of every masterclass, then one per CAIRA level. A
 * visitor who never filters makes none of these reads.
 */
@Service({ autoProvided: false })
export class MasterclassRailFilterFacade {
  private readonly api = inject(ApiClient);
  private readonly dialogs = inject(NgpDialogManager);
  private readonly logger = inject(Logger);

  /** Each rail's selection, by rail id. */
  private readonly selections = signal<Readonly<Record<string, RailFilterSelection>>>({});

  /** Set by the first open; the reads wait for it. */
  private readonly requested = signal(false);

  /** The rail whose dialog is about to open. */
  private readonly waiting = signal<MasterclassRail | null>(null);

  private readonly index = rxResource<CourseFilterIndex, true | undefined>({
    params: () => this.requested() || undefined,
    stream: () => this.readIndex(),
  });

  private readonly latestIndex = computed(() =>
    this.index.hasValue() ? this.index.value() : null,
  );

  /** A dialog is on its way; the icons disable until it opens. */
  readonly opening = computed(() => this.waiting() !== null);

  /** The rails with their filters applied, for the page's `computed`s. */
  narrow(rails: readonly MasterclassRail[]): FilteredRail[] {
    const selections = this.selections();
    const index = this.latestIndex();
    return rails.map((rail) => {
      const selection = selections[rail.id] ?? {};
      const count = selectedCount(selection);
      return {
        ...rail,
        shown: count
          ? rail.courses.filter((course) => matchesSelection(course, selection, index))
          : rail.courses,
        selectedCount: count,
      };
    });
  }

  /** A rail's filter icon. The dialog opens once the reads settle. */
  open(rail: MasterclassRail): void {
    if (this.waiting()) return;
    this.waiting.set(rail);
    // The first open starts the reads; one after a failure tries again.
    if (!this.requested()) this.requested.set(true);
    else if (this.index.error()) this.index.reload();
  }

  private readonly openWhenReady = effect(() => {
    const rail = this.waiting();
    if (!rail || this.index.isLoading()) return;
    untracked(() => void this.showDialog(rail));
  });

  // On failure the dialog opens with the cards' groups only, so the log is
  // the only place it shows.
  private readonly indexErrorLog = effect(() => {
    const error = this.index.error();
    if (error) this.logger.error('[MasterclassRailFilterFacade] filter load failed', error);
  });

  private async showDialog(rail: MasterclassRail): Promise<void> {
    const data = railFilterOptions(
      rail.courses,
      this.latestIndex(),
      this.selections()[rail.id] ?? {},
    );
    try {
      // Loaded on open: only a filter click needs it.
      const { FilterDialog } = await import('@shared/dialogs/filter-dialog/filter-dialog');
      this.dialogs
        .open<RailFilterDialogData>(FilterDialog, { data })
        .afterClosed.pipe(take(1))
        .subscribe((result) => {
          const selection = selectionFromDialog(result);
          if (selection) this.selections.update((all) => ({ ...all, [rail.id]: selection }));
        });
    } finally {
      this.waiting.set(null);
    }
  }

  private readIndex(): Observable<CourseFilterIndex> {
    return this.readPage().pipe(
      switchMap((page) => {
        if (page.hasNext) {
          this.logger.warn(
            '[MasterclassRailFilterFacade] over one page of masterclasses; the rest have no instructor or level',
          );
        }
        const levels = page.levels.map((level) =>
          this.readPage(level.id).pipe(
            map((levelPage): LevelCourses => ({
              levelId: level.id,
              courseIds: levelPage.courses.map((course) => course.id),
            })),
          ),
        );
        return (levels.length ? forkJoin(levels) : of<LevelCourses[]>([])).pipe(
          map((levelCourses) => buildFilterIndex(page, levelCourses)),
        );
      }),
    );
  }

  private readPage(level?: string): Observable<FilterPage> {
    const params = level ? { ...MASTERCLASS_FILTER_PARAMS, level } : MASTERCLASS_FILTER_PARAMS;
    return this.api
      .call(MASTERCLASS_FILTER_ROUTE, undefined, { params })
      .pipe(map(parseFilterPage));
  }
}
