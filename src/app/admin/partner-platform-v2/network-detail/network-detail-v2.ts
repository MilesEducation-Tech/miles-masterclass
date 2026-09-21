import { isPlatformBrowser } from '@angular/common';
import {
  Component,
  DestroyRef,
  EnvironmentInjector,
  PLATFORM_ID,
  computed,
  inject,
  resource,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom, fromEvent, take, takeUntil } from 'rxjs';
import { Button } from '../../../shared/components/ui/button/button';
import { Spinner } from '../../../shared/components/ui/spinner/spinner';
import { Dialog } from '../../../shared/core/services/dialog/dialog';
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';
import { PERM } from '../../../shared/core/models/admin/admin-rbac.model';
import { StatCard } from '../../partner-platform/shared/components/stat-card/stat-card';
import {
  Firm,
  NetworkDetailResponse,
  partnerLoadError,
  CreateFirmResponse,
} from '../../partner-platform/shared/models/partner-platform.model';
import { PartnerSuperAdminFacade } from '../../partner-platform/shared/services/partner-superadmin-facade';
import {
  AllocateSeatsDialog,
  AllocateSeatsDialogData,
} from '../../partner-platform/super-admin/network-tracker/shared/components/allocate-seats-dialog/allocate-seats-dialog';
import {
  NetworkFormDialog,
  NetworkFormDialogData,
  NetworkFormResult,
} from '../../partner-platform/super-admin/networks/shared/components/network-form-dialog/network-form-dialog';
import {
  AssignSeatDialog,
  AssignSeatDialogData,
  AssignSeatResult,
} from './shared/components/assign-seat-dialog/assign-seat-dialog';
import {
  FirmFormDialog,
  FirmFormDialogData,
} from '../firms/shared/components/firm-form-dialog/firm-form-dialog';
import { AdminAuth } from '../../../shared/core/services/admin-auth/admin-auth';

/**
 * Partner Platform v2 — Network detail hub (`/admin/partner-v2/networks/:id`).
 * `GET /superadmin/networks/<id>/`: the seat pool, the member firms, and every
 * network-scoped action in one place — edit/mint, top up a firm, move a pool
 * seat onto a firm, jump to pre-scoped reports.
 *
 * Reachable with `partner:platform:read`; the write actions are additionally
 * gated on `partner:platform:manage` in the template.
 */
@Component({
  selector: 'app-network-detail-v2',
  imports: [Button, Spinner, StatCard, HasPermissionDirective],
  templateUrl: './network-detail-v2.html',
  host: { class: 'block w-full' },
})
export class NetworkDetailV2 {
  protected readonly PERM = PERM;

  private readonly facade = inject(PartnerSuperAdminFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(Dialog);
  // Dialogs are built by the root Dialog service; hand it this page's injector
  // so the route-scoped facade resolves instead of a NullInjectorError.
  private readonly envInjector = inject(EnvironmentInjector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Editing a network or firm is super-admin only. */
  protected readonly canEdit = inject(AdminAuth).isSuperAdmin;

  protected readonly networkId = signal<number>(Number(this.route.snapshot.paramMap.get('id')));

  private readonly detailResource = resource({
    params: () => (this.isBrowser && this.networkId() > 0 ? { id: this.networkId() } : undefined),
    loader: ({ params, abortSignal }) =>
      firstValueFrom(
        this.facade.networkDetail(params.id).pipe(takeUntil(fromEvent(abortSignal, 'abort'))),
      ),
  });

  private readonly detail = computed<NetworkDetailResponse | undefined>(() =>
    this.detailResource.value(),
  );

  protected readonly isLoading = computed(() => this.detailResource.isLoading());
  protected readonly error = computed(() =>
    partnerLoadError(this.detailResource.error(), 'Failed to load the network.'),
  );
  protected readonly network = computed(() => this.detail()?.network);
  protected readonly networkName = computed(() => this.network()?.name ?? 'Network');
  protected readonly firms = computed<Firm[]>(() => this.detail()?.firms ?? []);

  protected readonly cards = computed(() => {
    const n = this.network();
    if (!n) return [];
    return [
      { label: 'Total seats', value: n.total_seats, accent: 'var(--mm-fg-3)' },
      { label: 'Allocated', value: n.allocated_seats, accent: 'var(--chart-1)' },
      { label: 'Unallocated', value: n.unallocated_seats, accent: 'var(--chart-5)' },
      { label: 'Used', value: n.used_seats, accent: 'var(--chart-3)' },
    ];
  });

  /** Edit fields and/or mint seats into the pool — `PATCH /superadmin/networks/<id>/`. */
  protected openEdit(): void {
    const network = this.network();
    if (!network) return;
    const ref = this.dialog.open<NetworkFormDialog, NetworkFormResult | undefined>(
      NetworkFormDialog,
      {
        data: { network } satisfies NetworkFormDialogData,
        environmentInjector: this.envInjector,
        maxWidth: '520px',
        ariaLabel: 'Edit network',
      },
    );
    ref.afterClosed$
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe(async (result) => {
        if (!result) return;
        const saved = await this.facade.updateNetwork(network.id, {
          name: result.name,
          total_seats: result.total_seats,
          is_active: result.is_active,
          ...(result.allocations.length ? { allocations: result.allocations } : {}),
        });
        if (saved) this.detailResource.reload();
      });
  }

  /** Top up one firm's seats — `POST /superadmin/firms/<id>/allocate/`. */
  protected openAllocate(firm: Firm): void {
    const ref = this.dialog.open<AllocateSeatsDialog, number | undefined>(AllocateSeatsDialog, {
      data: { firm } satisfies AllocateSeatsDialogData,
      environmentInjector: this.envInjector,
      maxWidth: '520px',
      ariaLabel: `Add seats to ${firm.name}`,
    });
    ref.afterClosed$.pipe(take(1), takeUntilDestroyed(this.destroyRef)).subscribe((minted) => {
      if (minted != null) this.detailResource.reload();
    });
  }

  /** Move a pool seat onto a member firm — `POST /superadmin/seats/<id>/assign-firm/`. */
  protected openAssignSeat(): void {
    const ref = this.dialog.open<AssignSeatDialog, AssignSeatResult | undefined>(AssignSeatDialog, {
      data: { firms: this.firms() } satisfies AssignSeatDialogData,
      environmentInjector: this.envInjector,
      maxWidth: '480px',
      ariaLabel: 'Assign a pool seat to a firm',
    });
    ref.afterClosed$
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe(async (result) => {
        if (!result) return;
        const seat = await this.facade.assignSeatToFirm(result.seatId, result.firmId);
        if (seat) this.detailResource.reload();
      });
  }

  /** Add a member firm here — `POST /superadmin/firms/` with this network pre-selected. */
  protected openCreateFirm(): void {
    const ref = this.dialog.open<FirmFormDialog, CreateFirmResponse | undefined>(FirmFormDialog, {
      data: { networkId: this.networkId() } satisfies FirmFormDialogData,
      environmentInjector: this.envInjector,
      maxWidth: '560px',
      ariaLabel: 'Create firm',
    });
    ref.afterClosed$.pipe(take(1), takeUntilDestroyed(this.destroyRef)).subscribe((created) => {
      if (created) this.detailResource.reload();
    });
  }

  /** Edit one member firm — `PATCH /superadmin/firms/<id>/`. */
  protected openEditFirm(firm: Firm): void {
    const ref = this.dialog.open<FirmFormDialog, Firm | undefined>(FirmFormDialog, {
      data: { firm } satisfies FirmFormDialogData,
      environmentInjector: this.envInjector,
      maxWidth: '560px',
      ariaLabel: `Edit ${firm.name}`,
    });
    ref.afterClosed$.pipe(take(1), takeUntilDestroyed(this.destroyRef)).subscribe((updated) => {
      if (updated) this.detailResource.reload();
    });
  }

  /** Reports scoped to one member firm (the page honours `?firm=`). */
  protected openFirmReports(firm: Firm): void {
    void this.router.navigate(['/admin/partner-v2/superadmin/reports'], {
      queryParams: { firm: firm.id },
    });
  }

  /** Open the v2 superadmin Reports page already scoped to this network. */
  protected openReports(): void {
    void this.router.navigate(['/admin/partner-v2/superadmin/reports'], {
      queryParams: { network: this.networkId() },
    });
  }
}
