import {
  Component,
  DestroyRef,
  EnvironmentInjector,
  computed,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { take } from 'rxjs';
import { Button } from '@shared/ui/button/button';
import { Spinner } from '@shared/ui/spinner/spinner';
import { NgpDialogManager } from 'ng-primitives/dialog';
import { withPreviousValue } from '@shared/utils/with-previous-value';
import {
  CreateFirmResponse,
  Firm,
  partnerLoadError,
} from '@admin/core/models/partner-platform.model';
import { PartnerSuperAdminFacade } from '@admin/core/services/partner-superadmin-facade';
// Type-only: dialog components below load with `import()` when opened (PROMPT.md §4.4).
import type { AllocateSeatsDialogData } from '@admin/partner-platform-v2/dialogs/allocate-seats-dialog/allocate-seats-dialog';
import type { FirmFormDialogData } from '@admin/partner-platform-v2/dialogs/firm-form-dialog/firm-form-dialog';
import { AriaSelect } from '@shared/ui/aria/aria-select/aria-select';
import { AriaSelectOption } from '@core/models/aria.model';
import { AdminAuth } from '@admin/core/services/admin-auth';

/** Scope filter encoded as one select value: all | standalone | network:<id>. */
type FirmScopeFilter = string;

/**
 * Partner Platform v2 — Firms (`/admin/partner-v2/firms`). Every firm across
 * networks, filtered SERVER-side via `GET /superadmin/firms/?network_id=` /
 * `?standalone=1` — unlike v1, which fetched everything once and filtered in
 * the client.
 */
@Component({
  selector: 'app-firms-v2',
  imports: [Button, Spinner, AriaSelect],
  templateUrl: './firms-v2.html',
  host: { class: 'block w-full' },
})
export class FirmsV2 {
  protected readonly facade = inject(PartnerSuperAdminFacade);
  private readonly dialogs = inject(NgpDialogManager);
  // Dialogs are created under the root injector; pass this page's injector as the
  // dialog's `injector` so the route-scoped facade resolves instead of a NullInjectorError.
  private readonly envInjector = inject(EnvironmentInjector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);

  /** Editing a firm is super-admin only — everyone else gets the read/seat actions. */
  protected readonly canEdit = inject(AdminAuth).isSuperAdmin;

  protected readonly scope = signal<FirmScopeFilter>('all');

  private readonly rawFirmsResource = this.facade.listFirmsResource(() => {
    const [kind, id] = this.scope().split(':');
    return kind === 'standalone'
      ? { standalone: true }
      : kind === 'network'
        ? { networkId: Number(id) }
        : undefined;
  });

  private readonly firmsResource = withPreviousValue(this.rawFirmsResource);

  protected readonly firms = linkedSignal({
    source: this.firmsResource.snapshot,
    computation: (snap, previous): Firm[] => {
      if (snap.status !== 'resolved') return previous?.value ?? [];
      return snap.value?.firms ?? [];
    },
  });

  protected readonly isLoading = computed(() => this.firmsResource.isLoading());
  protected readonly error = computed(() =>
    partnerLoadError(this.firmsResource.error(), 'Failed to load firms.'),
  );

  protected readonly scopeOptions = computed<AriaSelectOption<FirmScopeFilter>[]>(() => [
    { value: 'all', label: 'All firms' },
    { value: 'standalone', label: 'Standalone only' },
    ...this.facade.networks().map((n) => ({ value: `network:${n.id}`, label: n.name })),
  ]);

  protected onScopeChange(value: FirmScopeFilter | null): void {
    this.scope.set(value || 'all');
  }

  protected openNetwork(firm: Firm): void {
    if (firm.network) {
      void this.router.navigate(['/admin/partner-v2/superadmin/networks', firm.network.id]);
    }
  }

  /** Top up one firm's seats — `POST /superadmin/firms/<id>/allocate/`. */
  /** Open the v2 superadmin Reports page already scoped to this firm. */
  protected openReports(firm: Firm): void {
    void this.router.navigate(['/admin/partner-v2/superadmin/reports'], {
      queryParams: { firm: firm.id },
    });
  }

  protected async openAllocate(firm: Firm): Promise<void> {
    const { AllocateSeatsDialog } =
      await import('@admin/partner-platform-v2/dialogs/allocate-seats-dialog/allocate-seats-dialog');
    const ref = this.dialogs.open<AllocateSeatsDialogData, number | undefined>(
      AllocateSeatsDialog,
      { data: { firm } satisfies AllocateSeatsDialogData, injector: this.envInjector },
    );
    ref.afterClosed.pipe(take(1), takeUntilDestroyed(this.destroyRef)).subscribe((minted) => {
      if (minted != null) this.rawFirmsResource.reload();
    });
  }

  /** Edit name, email domains and status — `PATCH /superadmin/firms/<id>/`. */
  protected async openEdit(firm: Firm): Promise<void> {
    const { FirmFormDialog } =
      await import('@admin/partner-platform-v2/dialogs/firm-form-dialog/firm-form-dialog');
    const ref = this.dialogs.open<FirmFormDialogData, Firm | undefined>(FirmFormDialog, {
      data: { firm } satisfies FirmFormDialogData,
      injector: this.envInjector,
    });
    ref.afterClosed.pipe(take(1), takeUntilDestroyed(this.destroyRef)).subscribe((updated) => {
      if (updated) this.rawFirmsResource.reload();
    });
  }

  /** Create a firm (member or standalone), optionally with seats + admin, atomically. */
  protected async openCreate(): Promise<void> {
    const { FirmFormDialog } =
      await import('@admin/partner-platform-v2/dialogs/firm-form-dialog/firm-form-dialog');
    const ref = this.dialogs.open<void, CreateFirmResponse | undefined>(FirmFormDialog, {
      injector: this.envInjector,
    });
    ref.afterClosed.pipe(take(1), takeUntilDestroyed(this.destroyRef)).subscribe((created) => {
      if (!created) return;
      this.rawFirmsResource.reload();
      // No admin created atomically → hand off to admin provisioning, like v1.
      if (!created.admin) {
        void this.router.navigate(['/admin/admin-users'], {
          queryParams: { firm: created.id, provision: 1 },
        });
      }
    });
  }
}
