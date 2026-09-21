import { inject, Injectable } from '@angular/core';
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

/** One row of `admin_users` — an existing Supabase login the operator can reuse. */
export interface ExistingAdminUser {
  user_id: string;
  email: string;
  full_name: string | null;
  /** Role names held today, e.g. ["Network Admin"] — shown so the operator can
   *  spot a clash (the partner roles are mutually exclusive). */
  roles: string[];
}

export interface ProvisionAdminUserInput {
  email: string;
  fullName: string;
  /** Supabase role slugs — at most one Django-mapped partner slug among them. */
  roleSlugs: string[];
  domains?: string[];
  grants?: string[];
  denies?: string[];
  /** Optional report scope stored on admin_users.report_type. */
  reportType?: string;
}

/**
 * Wraps the `provision_admin_user` Supabase RPC — creates a Supabase login +
 * admin_* RBAC rows server-side (replacing the old copy-paste SQL). The RPC is
 * permission-gated: `admin:users:manage` provisions any role set; a
 * `partner_network_admin` may provision exactly `['partner_subcompany_admin']`.
 * Used by both Admin Users (super-admin) and the sub-company create flow.
 */
@Injectable({ providedIn: 'root' })
export class AdminProvisioning {
  private readonly supabase = inject(Supabase);
  private readonly logger = inject(Logger);
  private readonly notification = inject(NotificationService);

  /**
   * Active `admin_users` rows, for "assign an existing login" instead of
   * provisioning a new one. RLS gates this read on `admin:users:manage`, so an
   * operator without it just gets an empty list — the callers say so and fall
   * back to creating a new login.
   */
  async listAdminUsers(): Promise<ExistingAdminUser[]> {
    const client = await this.supabase.getClient();
    const { data, error } = await client
      .from('admin_users')
      .select('user_id, email, full_name, admin_user_roles(admin_roles(name))')
      .eq('is_active', true)
      .order('email');
    if (error) throw error;
    return (
      (data ?? []) as unknown as {
        user_id: string;
        email: string;
        full_name: string | null;
        admin_user_roles: { admin_roles: { name: string } | null }[] | null;
      }[]
    ).map((r) => ({
      user_id: r.user_id,
      email: r.email,
      full_name: r.full_name,
      roles: (r.admin_user_roles ?? [])
        .flatMap((ur) => (ur.admin_roles ? [ur.admin_roles.name] : []))
        .sort(),
    }));
  }

  /** Returns the created/existing Supabase user_id, or null on failure. */
  async provisionAdminUser(input: ProvisionAdminUserInput): Promise<string | null> {
    try {
      const client = await this.supabase.getClient();
      const { data, error } = await client.rpc('provision_admin_user', {
        p_email: input.email,
        p_full_name: input.fullName,
        p_role_slugs: input.roleSlugs,
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
