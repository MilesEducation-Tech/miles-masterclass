import { isPlatformBrowser } from '@angular/common';
import {
  Component,
  DestroyRef,
  EnvironmentInjector,
  PLATFORM_ID,
  computed,
  inject,
  linkedSignal,
  resource,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { firstValueFrom, fromEvent, take, takeUntil } from 'rxjs';
import { Button } from '../../../shared/components/ui/button/button';
import { Spinner } from '../../../shared/components/ui/spinner/spinner';
import { Dialog } from '../../../shared/core/services/dialog/dialog';
import { withPreviousValue } from '../../../shared/utils/with-previous-value';
import {
  CreateFirmResponse,
  Firm,
  FirmsResponse,
  partnerLoadError,
} from '../../partner-platform/shared/models/partner-platform.model';
import { PartnerSuperAdminFacade } from '../../partner-platform/shared/services/partner-superadmin-facade';
import {
  AllocateSeatsDialog,
  AllocateSeatsDialogData,
} from '../../partner-platform/super-admin/network-tracker/shared/components/allocate-seats-dialog/allocate-seats-dialog';
import {
  FirmFormDialog,
  FirmFormDialogData,
} from './shared/components/firm-form-dialog/firm-form-dialog';
import { AriaSelect } from '../../../shared/components/ui/aria/aria-select/aria-select';
import { AriaSelectOption } from '../../../shared/core/models/aria.model';
import { AdminAuth } from '../../../shared/core/services/admin-auth/admin-auth';

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
  private readonly dialog = inject(Dialog);
  // Dialogs are built by the root Dialog service; hand it this page's injector
  // so the route-scoped facade resolves instead of a NullInjectorError.
  private readonly envInjector = inject(EnvironmentInjector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Editing a firm is super-admin only — everyone else gets the read/seat actions. */
  protected readonly canEdit = inject(AdminAuth).isSuperAdmin;

  protected readonly scope = signal<FirmScopeFilter>('all');

  private readonly rawFirmsResource = resource({
    params: () => (this.isBrowser ? { scope: this.scope() } : undefined),
    loader: ({ params, abortSignal }) => {
      const [kind, id] = params.scope.split(':');
      const filter =
        kind === 'standalone'
          ? { standalone: true }
          : kind === 'network'
            ? { networkId: Number(id) }
            : undefined;
      return firstValueFrom(
        this.facade.listFirms(filter).pipe(takeUntil(fromEvent(abortSignal, 'abort'))),
        { defaultValue: { firms: [] } as FirmsResponse },
      );
    },
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

  protected openAllocate(firm: Firm): void {
    const ref = this.dialog.open<AllocateSeatsDialog, number | undefined>(AllocateSeatsDialog, {
      data: { firm } satisfies AllocateSeatsDialogData,
      environmentInjector: this.envInjector,
      maxWidth: '520px',
      ariaLabel: `Add seats to ${firm.name}`,
    });
    ref.afterClosed$.pipe(take(1), takeUntilDestroyed(this.destroyRef)).subscribe((minted) => {
      if (minted != null) this.rawFirmsResource.reload();
    });
  }

  /** Edit name, email domains and status — `PATCH /superadmin/firms/<id>/`. */
  protected openEdit(firm: Firm): void {
    const ref = this.dialog.open<FirmFormDialog, Firm | undefined>(FirmFormDialog, {
      data: { firm } satisfies FirmFormDialogData,
      environmentInjector: this.envInjector,
      maxWidth: '560px',
      ariaLabel: `Edit ${firm.name}`,
    });
    ref.afterClosed$.pipe(take(1), takeUntilDestroyed(this.destroyRef)).subscribe((updated) => {
      if (updated) this.rawFirmsResource.reload();
    });
  }

  /** Create a firm (member or standalone), optionally with seats + admin, atomically. */
  protected openCreate(): void {
    const ref = this.dialog.open<FirmFormDialog, CreateFirmResponse | undefined>(FirmFormDialog, {
      environmentInjector: this.envInjector,
      maxWidth: '560px',
      ariaLabel: 'Create firm',
    });
    ref.afterClosed$.pipe(take(1), takeUntilDestroyed(this.destroyRef)).subscribe((created) => {
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
