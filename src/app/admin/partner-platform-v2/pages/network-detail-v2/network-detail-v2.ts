import {
  Component,
  DestroyRef,
  EnvironmentInjector,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { take } from 'rxjs';
import { Button } from '@shared/ui/button/button';
import { Spinner } from '@shared/ui/spinner/spinner';
import { NgpDialogManager } from 'ng-primitives/dialog';
import { HasPermissionDirective } from '@admin/core/directives/has-permission';
import { PERM } from '@admin/core/models/admin-rbac.model';
import { StatCard } from '@admin/partner-platform-v2/components/stat-card/stat-card';
import {
  Firm,
  NetworkDetailResponse,
  partnerLoadError,
  CreateFirmResponse,
} from '@admin/core/models/partner-platform.model';
import { PartnerSuperAdminFacade } from '@admin/core/services/partner-superadmin-facade';
// Type-only: dialog components below load with `import()` when opened (PROMPT.md §4.4).
import type { AllocateSeatsDialogData } from '@admin/partner-platform-v2/dialogs/allocate-seats-dialog/allocate-seats-dialog';
import type {
  NetworkFormDialogData,
  NetworkFormResult,
} from '@admin/partner-platform-v2/dialogs/network-form-dialog/network-form-dialog';
import type {
  AssignSeatDialogData,
  AssignSeatResult,
} from '@admin/partner-platform-v2/dialogs/assign-seat-dialog/assign-seat-dialog';
import type { FirmFormDialogData } from '@admin/partner-platform-v2/dialogs/firm-form-dialog/firm-form-dialog';
import { AdminAuth } from '@admin/core/services/admin-auth';

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
  private readonly dialogs = inject(NgpDialogManager);
  // Dialogs are created under the root injector; pass this page's injector as the
  // dialog's `injector` so the route-scoped facade resolves instead of a NullInjectorError.
  private readonly envInjector = inject(EnvironmentInjector);
  private readonly destroyRef = inject(DestroyRef);

  /** Editing a network or firm is super-admin only. */
  protected readonly canEdit = inject(AdminAuth).isSuperAdmin;

  protected readonly networkId = signal<number>(Number(this.route.snapshot.paramMap.get('id')));

  private readonly detailResource = this.facade.networkDetailResource(this.networkId);

  /** Guarded: `value()` throws on an errored resource, before the page's error banner could show. */
  private readonly detail = computed<NetworkDetailResponse | undefined>(() =>
    this.detailResource.hasValue() ? this.detailResource.value() : undefined,
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
  protected async openEdit(): Promise<void> {
    const network = this.network();
    if (!network) return;
    const { NetworkFormDialog } =
      await import('@admin/partner-platform-v2/dialogs/network-form-dialog/network-form-dialog');
    const ref = this.dialogs.open<NetworkFormDialogData, NetworkFormResult | undefined>(
      NetworkFormDialog,
      { data: { network } satisfies NetworkFormDialogData, injector: this.envInjector },
    );
    ref.afterClosed.pipe(take(1), takeUntilDestroyed(this.destroyRef)).subscribe(async (result) => {
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
  protected async openAllocate(firm: Firm): Promise<void> {
    const { AllocateSeatsDialog } =
      await import('@admin/partner-platform-v2/dialogs/allocate-seats-dialog/allocate-seats-dialog');
    const ref = this.dialogs.open<AllocateSeatsDialogData, number | undefined>(
      AllocateSeatsDialog,
      { data: { firm } satisfies AllocateSeatsDialogData, injector: this.envInjector },
    );
    ref.afterClosed.pipe(take(1), takeUntilDestroyed(this.destroyRef)).subscribe((minted) => {
      if (minted != null) this.detailResource.reload();
    });
  }

  /** Move a pool seat onto a member firm — `POST /superadmin/seats/<id>/assign-firm/`. */
  protected async openAssignSeat(): Promise<void> {
    const { AssignSeatDialog } =
      await import('@admin/partner-platform-v2/dialogs/assign-seat-dialog/assign-seat-dialog');
    const ref = this.dialogs.open<AssignSeatDialogData, AssignSeatResult | undefined>(
      AssignSeatDialog,
      { data: { firms: this.firms() } satisfies AssignSeatDialogData, injector: this.envInjector },
    );
    ref.afterClosed.pipe(take(1), takeUntilDestroyed(this.destroyRef)).subscribe(async (result) => {
      if (!result) return;
      const seat = await this.facade.assignSeatToFirm(result.seatId, result.firmId);
      if (seat) this.detailResource.reload();
    });
  }

  /** Add a member firm here — `POST /superadmin/firms/` with this network pre-selected. */
  protected async openCreateFirm(): Promise<void> {
    const { FirmFormDialog } =
      await import('@admin/partner-platform-v2/dialogs/firm-form-dialog/firm-form-dialog');
    const ref = this.dialogs.open<FirmFormDialogData, CreateFirmResponse | undefined>(
      FirmFormDialog,
      {
        data: { networkId: this.networkId() } satisfies FirmFormDialogData,
        injector: this.envInjector,
      },
    );
    ref.afterClosed.pipe(take(1), takeUntilDestroyed(this.destroyRef)).subscribe((created) => {
      if (created) this.detailResource.reload();
    });
  }

  /** Edit one member firm — `PATCH /superadmin/firms/<id>/`. */
  protected async openEditFirm(firm: Firm): Promise<void> {
    const { FirmFormDialog } =
      await import('@admin/partner-platform-v2/dialogs/firm-form-dialog/firm-form-dialog');
    const ref = this.dialogs.open<FirmFormDialogData, Firm | undefined>(FirmFormDialog, {
      data: { firm } satisfies FirmFormDialogData,
      injector: this.envInjector,
    });
    ref.afterClosed.pipe(take(1), takeUntilDestroyed(this.destroyRef)).subscribe((updated) => {
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
