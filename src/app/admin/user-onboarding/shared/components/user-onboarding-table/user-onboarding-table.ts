import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Button } from '../../../../../shared/components/ui/button/button';
import { Spinner } from '../../../../../shared/components/ui/spinner/spinner';
import { InternalUser } from '../../models/user-onboarding.model';

@Component({
  selector: 'app-user-onboarding-table',
  imports: [DatePipe, Button, Spinner],
  templateUrl: './user-onboarding-table.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block w-full' },
})
export class UserOnboardingTable {
  readonly rows = input.required<InternalUser[]>();
  readonly isLoading = input<boolean>(false);
  readonly currentPage = input<number>(1);
  readonly totalCount = input<number>(0);
  readonly hasNext = input<boolean>(false);
  readonly hasPrev = input<boolean>(false);

  readonly view = output<InternalUser>();
  readonly edit = output<InternalUser>();
  readonly recordPayment = output<InternalUser>();
  readonly applyPartnerCode = output<InternalUser>();
  readonly prevPage = output<void>();
  readonly nextPage = output<void>();

  protected readonly canPrev = computed(() => this.hasPrev() && !this.isLoading());
  protected readonly canNext = computed(() => this.hasNext() && !this.isLoading());

  protected fullName(row: InternalUser): string {
    return `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim() || '—';
  }
}
