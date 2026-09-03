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
import { AriaInput } from '../../../shared/components/ui/aria/aria-input/aria-input';
import { Button } from '../../../shared/components/ui/button/button';
import {
  ApplyPartnerCodeDialog,
  ApplyPartnerCodeDialogData,
  ApplyPartnerCodeDialogResult,
} from '../../../shared/components/dialog/apply-partner-code-dialog/apply-partner-code-dialog';
import { Dialog } from '../../../shared/core/services/dialog/dialog';
import {
  RecordPaymentDialog,
  RecordPaymentDialogData,
  RecordPaymentDialogResult,
} from '../../user-onboarding/shared/components/record-payment-dialog/record-payment-dialog';
import { UserOnboardingTable } from '../../user-onboarding/shared/components/user-onboarding-table/user-onboarding-table';
import { InternalUser } from '../../user-onboarding/shared/models/user-onboarding.model';
import { UserOnboardingFacade } from '../../user-onboarding/shared/services/user-onboarding-facade';

/**
 * Partner Platform v2 — User Onboarding (`/admin/partner-v2/onboarding`).
 * Onboard learners, edit them, apply partner codes and record offline payments
 * (`partners/superadmin/users/…`). Adds the `?domain=` server-side filter v1
 * never exposed.
 */
@Component({
  selector: 'app-onboarding-v2',
  imports: [AriaInput, Button, UserOnboardingTable],
  templateUrl: './onboarding-v2.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block w-full' },
})
export class OnboardingV2 {
  protected readonly facade = inject(UserOnboardingFacade);
  private readonly dialog = inject(Dialog);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  /** Raw inputs — debounced before reaching the facade. */
  protected readonly searchInput = signal('');
  protected readonly domainInput = signal('');

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
    toObservable(this.domainInput)
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.facade.setDomainFilter(value));
  }

  protected onCreate(): void {
    void this.router.navigate(['/admin/partner-v2/superadmin/onboarding/new']);
  }

  protected onEdit(user: InternalUser): void {
    // Pass the loaded row so the form can prefill without a get-by-id endpoint.
    void this.router.navigate(['/admin/partner-v2/superadmin/onboarding', user.id, 'edit'], {
      state: { user },
    });
  }

  protected onRecordPayment(user: InternalUser): void {
    const ref = this.dialog.open<RecordPaymentDialog, RecordPaymentDialogResult>(
      RecordPaymentDialog,
      {
        data: { userEmail: user.email } satisfies RecordPaymentDialogData,
        maxWidth: '480px',
        ariaLabel: 'Record offline payment',
      },
    );

    ref.afterClosed$
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe(async (result) => {
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

    ref.afterClosed$
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe(async (result) => {
        if (!result?.code) return;
        await this.facade.applyPartnerCode(user, result.code);
      });
  }

  protected goPrev(): void {
    this.facade.setPage(
      this.facade.pagination()?.previous_page ?? Math.max(1, this.currentPage() - 1),
    );
  }

  protected goNext(): void {
    this.facade.setPage(this.facade.pagination()?.next_page ?? this.currentPage() + 1);
  }
}
