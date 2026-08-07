import { isPlatformBrowser } from '@angular/common';
import { computed, inject, Injectable, PLATFORM_ID, resource } from '@angular/core';
import { firstValueFrom, fromEvent, takeUntil } from 'rxjs';
import { ApiClient } from '../../../../shared/core/services/api-client/api-client';
import { AdminAuth } from '../../../../shared/core/services/admin-auth/admin-auth';
import {
  adminContext,
  PartnerAdminMeResponse,
  PartnerFirmRef,
  PartnerNetworkRef,
  PartnerRole,
} from '../models/partner-platform.model';

const PARTNER_ME_ENDPOINT = 'reports/partner-admin/me/';

/**
 * The Django `PartnerAdmin` identity for the signed-in Supabase user, from
 * `GET /partner-admin/me/`. This is the ONLY source of the fine-grained
 * capabilities and the network scope — the Supabase profile RPC deliberately
 * doesn't carry them. Action-level UI gating in the network panel reads from
 * here; route/sidebar gating still uses the coarse Supabase `partner:platform:*`
 * perms.
 *
 * Degrade gracefully: the observe-mode fallback `{ is_partner_admin: false }`
 * (or a fetch failure) resolves to "not a partner admin" so callers can render
 * an empty state and hide every write action (fail-closed).
 */
@Injectable({ providedIn: 'root' })
export class PartnerAdminMe {
  private readonly api = inject(ApiClient);
  private readonly auth = inject(AdminAuth);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly meResource = resource({
    // Refetch when the session changes; skip on the server and when signed out.
    params: () => {
      if (!this.isBrowser || !this.auth.isAuthenticated()) return undefined;
      return { token: this.auth.getAccessToken() };
    },
    loader: ({ abortSignal }) =>
      firstValueFrom(
        this.api
          .get<PartnerAdminMeResponse>(PARTNER_ME_ENDPOINT, { context: adminContext() })
          .pipe(takeUntil(fromEvent(abortSignal, 'abort'))),
        { defaultValue: { is_partner_admin: false } as PartnerAdminMeResponse },
      ).catch(() => ({ is_partner_admin: false }) as PartnerAdminMeResponse),
  });

  /** The resolved profile, or null when the user isn't a verified partner admin. */
  private readonly profile = computed(() => {
    const value = this.meResource.value();
    if (!value || 'is_partner_admin' in value) return null;
    return value;
  });

  readonly isLoading = computed(() => this.meResource.isLoading());
  readonly isPartnerAdmin = computed(() => this.profile() !== null);
  readonly role = computed<PartnerRole | null>(() => this.profile()?.role ?? null);
  readonly network = computed<PartnerNetworkRef | null>(() => this.profile()?.network ?? null);
  /** The firm this admin is scoped to (firm admins only; null for network admins). */
  readonly firm = computed<PartnerFirmRef | null>(() => this.profile()?.firm ?? null);

  private readonly capabilities = computed<ReadonlySet<string>>(
    () => new Set(this.profile()?.capabilities ?? []),
  );

  /** Does the signed-in partner admin hold this Django capability? */
  can(capability: string): boolean {
    return this.capabilities().has(capability);
  }

  /** Network admins (Django role=network) may create sub-companies + assign coupons. */
  readonly isNetworkAdmin = computed(() => this.role() === 'network');

  /** Firm admins (Django role=firm) are pinned to their own firm — no creation. */
  readonly isFirmAdmin = computed(() => this.role() === 'firm');

  reload(): void {
    this.meResource.reload();
  }
}
