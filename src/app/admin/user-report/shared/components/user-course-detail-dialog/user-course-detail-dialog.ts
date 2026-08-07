import { hasCourseIds } from '../../utils/course-ids';
import { Component, OnInit, signal } from '@angular/core';
import { DecimalPipe, formatDate } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideBookOpen } from '@ng-icons/lucide';
import { DialogRef } from '../../../../../shared/core/services/dialog/dialog';
import { Button } from '../../../../../shared/components/ui/button/button';
import { Spinner } from '../../../../../shared/components/ui/spinner/spinner';

export interface UserCourseDetailDialogData {
  userName: string;
  category: any;
  courseIds: any;
}

/**
 * Drill-down dialog for the user report. Opened from a metric cell, it lists the
 * courses behind that bucket via `UserReportFacade.getCourseDetail`.
 *
 * `data` and `dialogRef` are property-injected by the `Dialog` service after
 * construction (see `Dialog.open`), so the fetch is kicked off in `ngOnInit`.
 */
@Component({
  selector: 'app-user-course-detail-dialog',
  imports: [DecimalPipe, NgIcon, Button, Spinner],
  providers: [provideIcons({ lucideBookOpen })],
  templateUrl: './user-course-detail-dialog.html',
})
export class UserCourseDetailDialog implements OnInit {
  /** Set by the Dialog service immediately after construction. */
  dialogRef!: DialogRef<UserCourseDetailDialog>;
  data!: UserCourseDetailDialogData;

  // ponytail: UserReportFacade was deleted with the Django strip. This placeholder

  // keeps the template bindings compiling and renders the empty state.

  // Swap in the new backend's service — the template needs no changes.

  private readonly facade: any = {
    getCourseDetail: (..._args: any[]): any => null,
  };

  protected readonly courses = signal<any[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal('');

  ngOnInit(): void {
    void this.loadCourseDetails();
  }

  private async loadCourseDetails(): Promise<void> {
    if (!hasCourseIds(this.data?.courseIds)) {
      this.courses.set([]);
      this.isLoading.set(false);
      return;
    }

    try {
      const courses = await this.facade.getCourseDetail(this.data.courseIds);
      this.courses.set(courses);
    } catch {
      this.errorMessage.set('Failed to load course details.');
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * The API isn't strict about `completed_on` — it can be a real date, `'N/A'`,
   * empty, or an unrelated token like `'WA'`. Format genuine dates nicely and
   * pass anything else through untouched so the `date` pipe can't throw.
   */
  protected formatCompletedOn(value: string | null | undefined): string {
    if (!value || value === 'N/A') return '—';
    const parsed = Date.parse(value);
    if (Number.isNaN(parsed)) return value;
    try {
      return formatDate(value, 'MMM d, y', 'en-US');
    } catch {
      return value;
    }
  }

  protected badgeLabel(courseType: string): string {
    const map: Record<string, string> = {
      masterclass: 'Masterclass',
      podcast: 'Podcast',
      nano_learning: 'Micro-learning',
      micro_learning: 'Micro-learning',
    };
    return map[courseType?.toLowerCase()] ?? courseType ?? 'Course';
  }

  close(): void {
    this.dialogRef.close();
  }
}
