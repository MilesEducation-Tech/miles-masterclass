import { DatePipe, DecimalPipe } from '@angular/common';
import {
  Component,
  DestroyRef,
  EnvironmentInjector,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideDownload, lucideEye, lucideUsers } from '@ng-icons/lucide';
import { AriaInput } from '@shared/ui/aria/aria-input/aria-input';
import { Button } from '@shared/ui/button/button';
import { Spinner } from '@shared/ui/spinner/spinner';
import { Dialog } from '@core/services/dialog/dialog';
import { NotificationService } from '@core/services/notification/notification';
import {
  CourseDetailCategory,
  CourseIds,
  UserReportRow,
  hasCourseIds,
  mergeCourseIds,
} from './shared/models/user-report.model';
import { UserReportFacade } from './shared/services/user-report-facade';
import {
  UserCourseDetailDialog,
  UserCourseDetailDialogData,
} from './shared/components/user-course-detail-dialog/user-course-detail-dialog';

@Component({
  selector: 'app-user-report',
  imports: [DatePipe, DecimalPipe, NgIcon, AriaInput, Button, Spinner],
  providers: [provideIcons({ lucideDownload, lucideEye, lucideUsers })],
  templateUrl: './user-report.html',
  styleUrl: './user-report.css',
  host: { class: 'block w-full' },
})
export class UserReport {
  protected readonly facade = inject(UserReportFacade);
  private readonly dialog = inject(Dialog);
  // Dialogs are built by the root Dialog service; hand it this page's injector
  // so the route-scoped facade resolves instead of a NullInjectorError.
  private readonly envInjector = inject(EnvironmentInjector);
  private readonly notification = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  /** Raw search input — debounced before reaching the facade. */
  protected readonly searchInput = signal('');

  protected readonly pageWindow = computed(() => {
    const len = this.facade.rows().length;
    const total = this.facade.totalCount();
    if (len === 0) return { from: 0, to: 0, total };
    const from = (this.facade.currentPage() - 1) * this.facade.pageSize + 1;
    return { from, to: from + len - 1, total };
  });

  constructor() {
    toObservable(this.searchInput)
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.facade.setSearch(value));
  }

  protected goPrev(): void {
    this.facade.setPage(this.facade.currentPage() - 1);
  }

  protected goNext(): void {
    this.facade.setPage(this.facade.currentPage() + 1);
  }

  protected exportCsv(): void {
    void this.facade.exportCsv();
  }

  /** "State board" comes back namespaced (`user_details.StateBoards.<x>`). */
  protected cleanStateBoard(value: string): string {
    return value?.replace('user_details.StateBoards.', '') || '—';
  }

  /** Open the drill-down for one metric bucket. No-op with a toast when empty. */
  protected openCourseDetail(
    row: UserReportRow,
    category: CourseDetailCategory,
    courseIds: CourseIds,
  ): void {
    if (!hasCourseIds(courseIds)) {
      this.notification.info('No course data', 'There are no courses for this field.');
      return;
    }

    this.dialog.open<UserCourseDetailDialog>(UserCourseDetailDialog, {
      data: {
        userName: row.name,
        category,
        courseIds,
      } satisfies UserCourseDetailDialogData,
      environmentInjector: this.envInjector,
      maxWidth: '560px',
      ariaLabel: `${category} for ${row.name}`,
    });
  }

  /** Combine every bucket on the row and open the dialog. */
  protected openAllCourses(row: UserReportRow): void {
    const merged = mergeCourseIds([
      row.courses_completed_cpe_ids,
      row.courses_in_progress_cpe_ids,
      row.caira_credits_earned_ids,
      row.caira_credits_in_progress_ids,
      row.courses_completed_preview_ids,
      row.courses_in_progress_preview_ids,
    ]);
    this.openCourseDetail(row, 'All Courses', merged);
  }
}
