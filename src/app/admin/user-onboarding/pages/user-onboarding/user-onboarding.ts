import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, take } from 'rxjs';
import { AriaInput } from '@shared/ui/aria/aria-input/aria-input';
import { Button } from '@shared/ui/button/button';
import { DeprecationBanner } from '@shared/components/deprecation-banner/deprecation-banner';
import { Dialog } from '@core/services/dialog/dialog';
import {
  ApplyPartnerCodeDialog,
  ApplyPartnerCodeDialogData,
  ApplyPartnerCodeDialogResult,
} from '@shared/dialogs/apply-partner-code-dialog/apply-partner-code-dialog';
import {
  RecordPaymentDialog,
  RecordPaymentDialogData,
  RecordPaymentDialogResult,
} from '@admin/user-onboarding/dialogs/record-payment-dialog/record-payment-dialog';
import { UserOnboardingTable } from '@admin/user-onboarding/components/user-onboarding-table/user-onboarding-table';
import { UserOnboardingFacade } from '@admin/user-onboarding/services/user-onboarding-facade';
import { InternalUser } from '@admin/user-onboarding/models/user-onboarding.model';

@Component({
  selector: 'app-user-onboarding',
  imports: [AriaInput, Button, UserOnboardingTable, DeprecationBanner],
  templateUrl: './user-onboarding.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block w-full' },
})
export class UserOnboarding {
  protected readonly facade = inject(UserOnboardingFacade);
  private readonly dialog = inject(Dialog);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  /** Raw search input — debounced before reaching the facade. */
  protected readonly searchInput = signal('');

  // A non-null URL means a page exists in that direction (a prev URL pointing at
  // page 1 omits the ?page= param, so gate on presence, not the parsed number).
  protected readonly hasNextPage = computed(() => this.facade.pagination()?.next_page != null);
  protected readonly hasPrevPage = computed(() => this.facade.pagination()?.previous_page != null);
  protected readonly currentPage = computed(
    () => this.facade.pagination()?.current_page_number ?? this.facade.pageNumber(),
  );
  protected readonly totalCount = computed(() => this.facade.pagination()?.total_count ?? 0);

  constructor() {
    toObservable(this.searchInput)
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.facade.setSearch(value));
  }

  protected onCreate(): void {
    void this.router.navigate(['/admin/user-onboarding/new']);
  }

  protected onEdit(user: InternalUser): void {
    // Pass the loaded row so the form can prefill without a get-by-id endpoint.
    void this.router.navigate(['/admin/user-onboarding', user.id, 'edit'], { state: { user } });
  }

  protected onRecordPayment(user: InternalUser): void {
    const ref = this.dialog.open<RecordPaymentDialog, RecordPaymentDialogResult>(
      RecordPaymentDialog,
      {
        data: {
          userEmail: user.email,
          isSubscribed: user.is_subscribed,
        } satisfies RecordPaymentDialogData,
        maxWidth: '480px',
        ariaLabel: 'Record offline payment',
      },
    );

    ref.afterClosed$.pipe(take(1)).subscribe(async (result) => {
      // Cancelled. A resolved result always carries a file or a comment — the
      // dialog cannot submit without one.
      if (!result) return;
      await this.facade.recordOfflinePayment(user.id, result.file, result.comment);
    });
  }

  protected onApplyPartnerCode(user: InternalUser): void {
    // Open on a fresh list — codes are added outside this screen.
    this.facade.reloadPartnerCodes();
    const ref = this.dialog.open<ApplyPartnerCodeDialog, ApplyPartnerCodeDialogResult>(
      ApplyPartnerCodeDialog,
      {
        data: {
          userEmail: user.email,
          options: this.facade.partnerCodeOptions,
        } satisfies ApplyPartnerCodeDialogData,
        maxWidth: '480px',
        ariaLabel: 'Apply partner code',
      },
    );

    ref.afterClosed$.pipe(take(1)).subscribe(async (result) => {
      if (!result?.code) return;
      await this.facade.applyPartnerCode(user, result.code);
    });
  }

  // Pagination is page NUMBERS now, not URLs — no parsing needed.
  protected goPrev(): void {
    this.facade.setPage(
      this.facade.pagination()?.previous_page ?? Math.max(1, this.currentPage() - 1),
    );
  }

  protected goNext(): void {
    this.facade.setPage(this.facade.pagination()?.next_page ?? this.currentPage() + 1);
  }
}
