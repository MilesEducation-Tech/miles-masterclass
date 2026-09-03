import { isPlatformBrowser } from '@angular/common';
import {
  Component,
  DestroyRef,
  computed,
  inject,
  linkedSignal,
  PLATFORM_ID,
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
import { CreateFirmDialog } from './shared/components/create-firm-dialog/create-firm-dialog';

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
  imports: [Button, Spinner],
  templateUrl: './firms-v2.html',
  host: { class: 'block w-full' },
})
export class FirmsV2 {
  protected readonly facade = inject(PartnerSuperAdminFacade);
  private readonly dialog = inject(Dialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

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

  protected onScopeChange(event: Event): void {
    this.scope.set((event.target as HTMLSelectElement).value || 'all');
  }

  protected openNetwork(firm: Firm): void {
    if (firm.network) {
      void this.router.navigate(['/admin/partner-v2/superadmin/networks', firm.network.id]);
    }
  }

  /** Top up one firm's seats — `POST /superadmin/firms/<id>/allocate/`. */
  protected openAllocate(firm: Firm): void {
    const ref = this.dialog.open<AllocateSeatsDialog, number | undefined>(AllocateSeatsDialog, {
      data: { firm } satisfies AllocateSeatsDialogData,
      maxWidth: '520px',
      ariaLabel: `Add seats to ${firm.name}`,
    });
    ref.afterClosed$.pipe(take(1), takeUntilDestroyed(this.destroyRef)).subscribe((minted) => {
      if (minted != null) this.rawFirmsResource.reload();
    });
  }

  /** Create a firm (member or standalone), optionally with seats + admin, atomically. */
  protected openCreate(): void {
    const ref = this.dialog.open<CreateFirmDialog, CreateFirmResponse | undefined>(
      CreateFirmDialog,
      { maxWidth: '560px', ariaLabel: 'Create firm' },
    );
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
