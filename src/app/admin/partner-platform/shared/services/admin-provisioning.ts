import { inject, Service } from '@angular/core';
import { Supabase } from '../../../../shared/core/services/supabase/supabase';
import { Logger } from '../../../../shared/core/services/logger/logger';
import { NotificationService } from '../../../../shared/core/services/notification/notification';

/**
 * Static initial password set for a newly-created admin login by the
 * `provision_admin_user` RPC. MUST match `v_initial_password` in
 * `supabase/migrations/20260713020000_provision_admin_user.sql`. Shown to the
 * operator so they can pass it to the new admin (who should then change it).
 */
export const INITIAL_ADMIN_PASSWORD = 'Miles@12345';

export interface ProvisionAdminUserInput {
  email: string;
  fullName: string;
  roleSlug: string;
  domains?: string[];
  grants?: string[];
  denies?: string[];
  /** Optional report scope stored on admin_users.report_type. */
  reportType?: string;
}

/**
 * Wraps the `provision_admin_user` Supabase RPC — creates a Supabase login +
 * admin_* RBAC rows server-side (replacing the old copy-paste SQL). The RPC is
 * permission-gated: `admin:users:manage` provisions any role; a
 * `partner_network_admin` may provision only `partner_subcompany_admin`.
 * Used by both Admin Users (super-admin) and the sub-company create flow.
 */
@Service()
export class AdminProvisioning {
  private readonly supabase = inject(Supabase);
  private readonly logger = inject(Logger);
  private readonly notification = inject(NotificationService);

  /** Returns the created/existing Supabase user_id, or null on failure. */
  async provisionAdminUser(input: ProvisionAdminUserInput): Promise<string | null> {
    try {
      const client = await this.supabase.getClient();
      const { data, error } = await client.rpc('provision_admin_user', {
        p_email: input.email,
        p_full_name: input.fullName,
        p_role_slug: input.roleSlug,
        p_domains: input.domains ?? [],
        p_grants: input.grants ?? [],
        p_denies: input.denies ?? [],
        p_report_type: input.reportType?.trim() || null,
      });
      if (error) throw error;
      return data as string;
    } catch (err) {
      this.logger.error('[AdminProvisioning] provisionAdminUser failed', err);
      this.notification.error(
        'Provisioning failed',
        err instanceof Error ? err.message : 'Please try again.',
      );
      return null;
    }
  }
}
