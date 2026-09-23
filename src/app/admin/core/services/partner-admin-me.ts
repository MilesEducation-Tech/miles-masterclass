import { isPlatformBrowser } from '@angular/common';
import { computed, inject, Injectable, PLATFORM_ID, resource } from '@angular/core';
import { firstValueFrom, fromEvent, takeUntil } from 'rxjs';
import { ApiClient } from '@core/services/api-client/api-client';
import { AdminAuth } from '@admin/core/services/admin-auth';
import {
  adminContext,
  PartnerAdminMeResponse,
  PartnerCapability,
  PartnerFirmRef,
  PartnerNetworkRef,
  PartnerRole,
} from '@admin/core/models/partner-platform.model';

const PARTNER_ME_ENDPOINT = 'partners/panel/me/';

/**
 * The Django `PartnerAdmin` identity for the signed-in Supabase user, from
 * `GET /panel/me/`. This is the ONLY source of the fine-grained
 * capabilities and the network scope — the Supabase profile RPC deliberately
 * doesn't carry them. Action-level UI gating in the network panel reads from
 * here; route/sidebar gating still uses the coarse Supabase `partner:platform:*`
 * perms.
 *
 * Degrade gracefully: the observe-mode fallback `{ is_partner_admin: false }`
 * (or a fetch failure) resolves to "not a partner admin" so callers can render
 * an empty state and hide every write action (fail-closed).
 */
// Route-scoped (see admin.routes.ts): the injector dies on navigation, which
// aborts in-flight resource() loads and stops this page's calls firing elsewhere.
@Injectable()
export class PartnerAdminMe {
  private readonly api = inject(ApiClient);
  private readonly auth = inject(AdminAuth);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly meResource = resource({
    // Keyed on WHO is signed in (a primitive, so a profile refresh that rebuilds
    // the same user is a no-op). Keying on the access token refetched /me/ on
    // every hourly rotation, from whatever page the admin happened to be on.
    params: () => {
      if (!this.isBrowser || !this.auth.isAuthenticated()) return undefined;
      return this.auth.adminUser()?.user_id;
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
    // Both shapes now carry `is_partner_admin`; the literal `true`/`false` is
    // what discriminates them, not the key's presence.
    if (!value || !value.is_partner_admin) return null;
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

  /**
   * Does the signed-in partner admin hold this Django capability? Typed against
   * `PartnerCapability` so a rename in the API is a compile error here rather
   * than a silently-false gate that hides a button forever.
   */
  can(capability: PartnerCapability): boolean {
    return this.capabilities().has(capability);
  }

  /**
   * Either report-read capability — the gate the panel report/list/export
   * endpoints all share (`report:network:read` for network admins,
   * `report:firm:read` for firm admins).
   */
  readonly canReadReports = computed(
    () => this.can('report:network:read') || this.can('report:firm:read'),
  );

  /** Network admins (Django role=network) may create sub-companies + assign coupons. */
  readonly isNetworkAdmin = computed(() => this.role() === 'network');

  /** Firm admins (Django role=firm) are pinned to their own firm — no creation. */
  readonly isFirmAdmin = computed(() => this.role() === 'firm');

  reload(): void {
    this.meResource.reload();
  }
}
