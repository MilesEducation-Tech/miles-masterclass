import { hasCourseIds } from '../../../../user-report/shared/utils/course-ids';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideShieldOff, lucideShieldCheck, lucideEye, lucideEyeOff } from '@ng-icons/lucide';
import { Button } from '../../../../../shared/components/ui/button/button';
import { Spinner } from '../../../../../shared/components/ui/spinner/spinner';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { PERM } from '../../../../../shared/core/models/admin/admin-rbac.model';
import { Dialog } from '../../../../../shared/core/services/dialog/dialog';
import { NotificationService } from '../../../../../shared/core/services/notification/notification';
import {
  UserCourseDetailDialog,
  UserCourseDetailDialogData,
} from '../../../../user-report/shared/components/user-course-detail-dialog/user-course-detail-dialog';

@Component({
  selector: 'app-users-table',
  imports: [DatePipe, DecimalPipe, NgIcon, Button, Spinner, HasPermissionDirective],
  providers: [provideIcons({ lucideShieldOff, lucideShieldCheck, lucideEye, lucideEyeOff })],
  templateUrl: './users-table.html',
  styleUrl: './users-table.css',
  host: { class: 'block w-full' },
})
export class UsersTable {
  private readonly dialog = inject(Dialog);
  private readonly notification = inject(NotificationService);

  readonly rows = input.required<any[]>();
  readonly isLoading = input<boolean>(false);
  readonly currentPage = input<number>(1);
  readonly totalCount = input<number>(0);
  readonly hasNext = input<boolean>(false);
  readonly hasPrev = input<boolean>(false);

  readonly blockToggle = output<any>();
  readonly prevPage = output<void>();
  readonly nextPage = output<void>();

  protected readonly PERM = PERM;

  protected readonly canPrev = computed(() => this.hasPrev() && !this.isLoading());
  protected readonly canNext = computed(() => this.hasNext() && !this.isLoading());

  protected readonly pageWindow = computed(() => {
    const rowsLen = this.rows().length;
    const total = this.totalCount();
    if (rowsLen === 0) return { from: 0, to: 0, total };
    // Without a page size from the API, the visible window is just the rows
    // currently rendered. Page * rows ≈ approximate "to" when the server
    // returns a uniform page size.
    const page = this.currentPage();
    const from = (page - 1) * rowsLen + 1;
    const to = from + rowsLen - 1;
    return { from, to, total };
  });

  protected onToggle(user: any): void {
    this.blockToggle.emit(user);
  }

  /**
   * Row ids whose email is currently shown in full. Emails render masked by
   * default for privacy; the admin can reveal one row at a time via the eye
   * toggle in the Email column.
   */
  private readonly revealedEmails = signal<ReadonlySet<number>>(new Set());

  protected isEmailRevealed(row: any): boolean {
    return this.revealedEmails().has(row.id);
  }

  protected toggleEmailReveal(row: any): void {
    this.revealedEmails.update((prev) => {
      const next = new Set(prev);
      if (next.has(row.id)) {
        next.delete(row.id);
      } else {
        next.add(row.id);
      }
      return next;
    });
  }

  /** Row ids whose phone number is currently shown in full. */
  private readonly revealedPhones = signal<ReadonlySet<number>>(new Set());

  protected isPhoneRevealed(row: any): boolean {
    return this.revealedPhones().has(row.id);
  }

  protected togglePhoneReveal(row: any): void {
    this.revealedPhones.update((prev) => {
      const next = new Set(prev);
      if (next.has(row.id)) {
        next.delete(row.id);
      } else {
        next.add(row.id);
      }
      return next;
    });
  }

  /** Whether the phone cell holds a maskable value (not empty / "N/A"). */
  protected hasPhone(row: any): boolean {
    return !!row.phone && row.phone !== 'N/A';
  }

  /** Mask the middle digits of a phone number, e.g. "2356897410" -> "23•••10". */
  protected maskPhone(phone: string): string {
    if (!phone || phone.length < 5) return phone;
    return `${phone.slice(0, 2)}•••${phone.slice(-2)}`;
  }

  /**
   * Mask the middle of the email's local part, keeping the domain visible
   * (the domain is the vendor-mapping context for this screen).
   * e.g. "manoj.hr.admin@mileseducation.com" -> "ma•••in@mileseducation.com"
   */
  protected maskEmail(email: string): string {
    if (!email || !email.includes('@')) return email;
    const at = email.lastIndexOf('@');
    const local = email.slice(0, at);
    const domain = email.slice(at + 1);
    let masked: string;
    if (local.length <= 2) {
      masked = `${local[0] ?? ''}•••`;
    } else if (local.length <= 5) {
      masked = `${local[0]}•••${local[local.length - 1]}`;
    } else {
      masked = `${local.slice(0, 2)}•••${local.slice(-2)}`;
    }
    return `${masked}@${domain}`;
  }

  /**
   * Open the reusable course-detail drill-down for one metric. The backend
   * returns each metric's ids already bucketed by course type, so pass them
   * straight through (nullish guards for any missing bucket).
   */
  protected openCourseDetail(
    row: any,
    category: any,
    courseIds: any | undefined,
  ): void {
    const buckets: any = {
      masterclass_id: courseIds?.masterclass_id ?? [],
      podcast_id: courseIds?.podcast_id ?? [],
      nano_learning_id: courseIds?.nano_learning_id ?? [],
    };
    if (!hasCourseIds(buckets)) {
      this.notification.info('No course data', 'There are no courses for this field.');
      return;
    }
    this.dialog.open<UserCourseDetailDialog>(UserCourseDetailDialog, {
      data: {
        userName: row.name,
        category,
        courseIds: buckets,
      } satisfies UserCourseDetailDialogData,
      maxWidth: '560px',
      ariaLabel: `${category} for ${row.name}`,
    });
  }
}
