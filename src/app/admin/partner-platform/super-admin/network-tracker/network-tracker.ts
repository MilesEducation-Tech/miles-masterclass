import { isPlatformBrowser } from '@angular/common';
import {
  Component,
  DestroyRef,
  computed,
  inject,
  PLATFORM_ID,
  resource,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom, fromEvent, take, takeUntil } from 'rxjs';
import { Button } from '../../../../shared/components/ui/button/button';
import { Dialog } from '../../../../shared/core/services/dialog/dialog';
import { Spinner } from '../../../../shared/components/ui/spinner/spinner';
import { DeprecationBanner } from '../../../shared/components/deprecation-banner/deprecation-banner';
import { StatCard } from '../../shared/components/stat-card/stat-card';
import {
  Firm,
  NetworkDetailResponse,
  partnerLoadError,
} from '../../shared/models/partner-platform.model';
import { PartnerSuperAdminFacade } from '../../shared/services/partner-superadmin-facade';
import {
  AllocateSeatsDialog,
  AllocateSeatsDialogData,
} from './shared/components/allocate-seats-dialog/allocate-seats-dialog';

/**
 * Super-admin per-network detail (`/admin/partner/networks/:id/tracker`) —
 * `GET /superadmin/networks/<id>/`: the network's seat pool plus its member
 * firms.
 *
 * This used to also list every seat in the network. The new API has no
 * super-admin seat list (only `/panel/seats/`, which is auto-scoped to the
 * caller's own network and so unreachable for Miles ops), so seat-level rows
 * are gone. Engagement detail lives on the Reports page instead, which this
 * page deep-links into pre-scoped to this network.
 */
@Component({
  selector: 'app-network-tracker',
  imports: [Button, Spinner, StatCard, DeprecationBanner],
  templateUrl: './network-tracker.html',
  host: { class: 'block w-full' },
})
export class NetworkTracker {
  private readonly superFacade = inject(PartnerSuperAdminFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(Dialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly networkId = signal<number>(Number(this.route.snapshot.paramMap.get('id')));

  /** This page's v2 replacement — the network detail hub. */
  protected readonly v2Path = computed(
    () => `/admin/partner-v2/superadmin/networks/${this.networkId()}`,
  );

  private readonly detailResource = resource({
    params: () => (this.isBrowser && this.networkId() > 0 ? { id: this.networkId() } : undefined),
    loader: ({ params, abortSignal }) =>
      firstValueFrom(
        this.superFacade.networkDetail(params.id).pipe(takeUntil(fromEvent(abortSignal, 'abort'))),
      ),
  });

  private readonly detail = computed<NetworkDetailResponse | undefined>(() =>
    this.detailResource.value(),
  );

  protected readonly isLoading = computed(() => this.detailResource.isLoading());
  protected readonly error = computed(() =>
    partnerLoadError(this.detailResource.error(), 'Failed to load the network.'),
  );
  protected readonly networkName = computed(() => this.detail()?.network.name ?? 'Network');
  protected readonly firms = computed<Firm[]>(() => this.detail()?.firms ?? []);

  protected readonly cards = computed(() => {
    const n = this.detail()?.network;
    if (!n) return [];
    return [
      { label: 'Total seats', value: n.total_seats, accent: 'var(--mm-fg-3)' },
      { label: 'Allocated', value: n.allocated_seats, accent: 'var(--chart-1)' },
      { label: 'Unallocated', value: n.unallocated_seats, accent: 'var(--chart-5)' },
      { label: 'Used', value: n.used_seats, accent: 'var(--chart-3)' },
    ];
  });

  /** Top up one firm's seats — `POST /superadmin/firms/<id>/allocate/`. */
  protected openAllocate(firm: Firm): void {
    const ref = this.dialog.open<AllocateSeatsDialog, number | undefined>(AllocateSeatsDialog, {
      data: { firm } satisfies AllocateSeatsDialogData,
      maxWidth: '520px',
      ariaLabel: `Add seats to ${firm.name}`,
    });
    ref.afterClosed$.pipe(take(1), takeUntilDestroyed(this.destroyRef)).subscribe((minted) => {
      // The firm's allocated count changed — refetch this page's own payload.
      if (minted != null) this.detailResource.reload();
    });
  }

  /** Open the Reports page already scoped to this network. */
  protected openReports(): void {
    void this.router.navigate(['/admin/partner/reports'], {
      queryParams: { network: this.networkId() },
    });
  }
}
