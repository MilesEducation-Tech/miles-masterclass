import { formatDate } from '@angular/common';
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
import { AriaInput } from '@shared/components/ui/aria/aria-input/aria-input';
import { Button } from '@shared/components/ui/button/button';
import {
  ApplyPartnerCodeDialog,
  ApplyPartnerCodeDialogData,
  ApplyPartnerCodeDialogResult,
} from '@shared/components/dialog/apply-partner-code-dialog/apply-partner-code-dialog';
import { UtilsDialog, UtilsDialogData } from '@shared/components/dialog/utils-dialog/utils-dialog';
import { Dialog } from '@core/services/dialog/dialog';
import {
  RecordPaymentDialog,
  RecordPaymentDialogData,
  RecordPaymentDialogResult,
} from '@admin/user-onboarding/shared/components/record-payment-dialog/record-payment-dialog';
import { UserOnboardingTable } from '@admin/user-onboarding/shared/components/user-onboarding-table/user-onboarding-table';
import {
  InternalUser,
  OfflinePaymentResult,
} from '@admin/user-onboarding/shared/models/user-onboarding.model';
import { UserOnboardingFacade } from '@admin/user-onboarding/shared/services/user-onboarding-facade';

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

  /** Every field the list returns that the row can't fit — read-only, so UtilsDialog. */
  protected onView(user: InternalUser): void {
    const yesNo = (v: boolean | null | undefined) => (v == null ? '—' : v ? 'Yes' : 'No');
    const date = (v: string | null) => (v ? formatDate(v, 'MMM d, y, h:mm a', 'en-US') : '—');
    const text = (v: string | null | undefined) => (v && v.trim() ? v : '—');
    this.dialog.open<UtilsDialog>(UtilsDialog, {
      data: {
        title: `${user.first_name} ${user.last_name}`.trim() || user.email,
        containerClass: 'max-w-lg text-left!',
        content: [
          {
            type: 'table',
            headers: ['Field', 'Value'],
            rows: [
              ['Email', user.email],
              ['Email domain', text(user.email_domain)],
              ['Mobile', `${user.country_code ?? ''} ${user.mobile ?? ''}`.trim() || '—'],
              ['Location', text(user.location)],
              ['Profession', text(user.profession)],
              ['Professional courses', user.professional_courses.join(', ') || '—'],
              ['State boards', user.state_board.join(', ') || '—'],
              ['Qualification', text(user.qualification_status)],
              ['License', text(user.license_status)],
              ['Currently working', yesNo(user.is_currently_working)],
              ['Company', text(user.company)],
              ['Sector', text(user.sector)],
              ['Job role', text(user.job_role)],
              ['Country', text(user.country_selected)],
              ['Partner code', text(user.partner_code)],
              ['Subscribed', yesNo(user.is_subscribed)],
              ['Terms accepted', yesNo(user.terms_accepted)],
              ['SMS consent', yesNo(user.sms_consent)],
              ['Account type', text(user.account_type)],
              ['Created via', text(user.creation_platform)],
              ['Created', date(user.created_at)],
              ['Last login', date(user.last_login)],
            ],
          },
        ],
        buttons: [{ label: 'Close', action: 'close' }],
      } satisfies UtilsDialogData,
      maxWidth: '560px',
      ariaLabel: `Details for ${user.email}`,
    });
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
        data: {
          userEmail: user.email,
          isSubscribed: user.is_subscribed,
        } satisfies RecordPaymentDialogData,
        maxWidth: '480px',
        ariaLabel: 'Record offline payment',
      },
    );

    ref.afterClosed$
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe(async (result) => {
        if (!result) return;
        const paid = await this.facade.recordOfflinePayment(user.id, result.file, result.comment);
        if (paid) this.showPaymentResult(user, paid);
      });
  }

  /** The receipt link and ids the toast can't hold — read-only, so UtilsDialog. */
  private showPaymentResult(user: InternalUser, paid: OfflinePaymentResult): void {
    this.dialog.open<UtilsDialog>(UtilsDialog, {
      data: {
        title: `Payment recorded — ${user.email}`,
        containerClass: 'max-w-lg text-left!',
        content: [
          {
            type: 'table',
            headers: ['Field', 'Value'],
            rows: [
              ['Subscription', paid.subscription_status],
              ['Amount paid', String(paid.amount_paid)],
              ['Payment ID', paid.payment_id],
              ['Order / transaction', `${paid.order_id} / ${paid.transaction_id}`],
              ['Mode', paid.payment_mode],
              ['Note', paid.payment_note ?? '—'],
            ],
          },
          ...(paid.receipt_url
            ? [
                {
                  type: 'links' as const,
                  items: [{ label: 'Open receipt', href: paid.receipt_url }],
                },
              ]
            : []),
        ],
        buttons: [{ label: 'Close', action: 'close' }],
      } satisfies UtilsDialogData,
      maxWidth: '560px',
      ariaLabel: 'Payment recorded',
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
