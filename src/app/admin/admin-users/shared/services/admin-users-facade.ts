import { isPlatformBrowser } from '@angular/common';
import { computed, inject, Injectable, PLATFORM_ID, resource } from '@angular/core';
import { Supabase } from '../../../../shared/core/services/supabase/supabase';
import { Logger } from '../../../../shared/core/services/logger/logger';
import { NotificationService } from '../../../../shared/core/services/notification/notification';

export interface AdminRoleRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
}

export interface AdminPermissionRow {
  id: string;
  key: string;
  category: string;
  label: string;
}

export interface AdminUserRoleRef {
  id: string;
  slug: string;
  name: string;
}

export interface AdminUserListRow {
  user_id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  last_login_at: string | null;
  /** Every role held (admin_user_roles), sorted by name. */
  roles: AdminUserRoleRef[];
  /** Partner email domains mapped to this admin (admin_user_email_domains). */
  domains: string[];
}

interface AdminUsersData {
  roles: AdminRoleRow[];
  permissions: AdminPermissionRow[];
  /** role_id -> set of permission keys granted by that role (defaults) */
  rolePermissions: Record<string, string[]>;
  admins: AdminUserListRow[];
}

const EMPTY: AdminUsersData = { roles: [], permissions: [], rolePermissions: {}, admins: [] };

/**
 * Reads the RBAC catalog + existing admins straight from Supabase (these are
 * Supabase tables, not the Django REST API). RLS already restricts these reads
 * to admin:users:manage. Read-only — onboarding happens via generated SQL.
 */
@Injectable()
export class AdminUsersFacade {
  private readonly supabase = inject(Supabase);
  private readonly logger = inject(Logger);
  private readonly notification = inject(NotificationService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly dataResource = resource<AdminUsersData, unknown>({
    params: () => (this.isBrowser ? true : undefined),
    loader: async () => {
      const client = await this.supabase.getClient();

      const [roles, perms, rolePerms, admins] = await Promise.all([
        client.from('admin_roles').select('id, slug, name, description').order('name'),
        client
          .from('admin_permissions')
          .select('id, key, category, label')
          .order('category')
          .order('label'),
        client.from('admin_role_permissions').select('role_id, admin_permissions(key)'),
        client
          .from('admin_users')
          .select(
            'user_id, email, full_name, is_active, last_login_at, admin_user_roles(admin_roles(id, slug, name)), admin_user_email_domains(domain)',
          )
          .order('email'),
      ]);

      const firstError = roles.error || perms.error || rolePerms.error || admins.error;
      if (firstError) throw firstError;

      const rolePermissions: Record<string, string[]> = {};
      for (const row of (rolePerms.data ?? []) as unknown as {
        role_id: string;
        admin_permissions: { key: string } | null;
      }[]) {
        if (!row.admin_permissions?.key) continue;
        (rolePermissions[row.role_id] ??= []).push(row.admin_permissions.key);
      }

      const adminRows: AdminUserListRow[] = (
        (admins.data ?? []) as unknown as (Omit<AdminUserListRow, 'roles' | 'domains'> & {
          admin_user_roles: { admin_roles: AdminUserRoleRef | null }[] | null;
          admin_user_email_domains: { domain: string }[] | null;
        })[]
      ).map((r) => ({
        user_id: r.user_id,
        email: r.email,
        full_name: r.full_name,
        is_active: r.is_active,
        last_login_at: r.last_login_at,
        roles: (r.admin_user_roles ?? [])
          .flatMap((ur) => (ur.admin_roles ? [ur.admin_roles] : []))
          .sort((a, b) => a.name.localeCompare(b.name)),
        domains: (r.admin_user_email_domains ?? []).map((d) => d.domain).sort(),
      }));

      return {
        roles: (roles.data ?? []) as AdminRoleRow[],
        permissions: (perms.data ?? []) as AdminPermissionRow[],
        rolePermissions,
        admins: adminRows,
      };
    },
  });

  private readonly data = computed(() => this.dataResource.value() ?? EMPTY);

  readonly roles = computed(() => this.data().roles);
  readonly permissions = computed(() => this.data().permissions);
  readonly rolePermissions = computed(() => this.data().rolePermissions);
  readonly admins = computed(() => this.data().admins);
  readonly isLoading = computed(() => this.dataResource.isLoading());
  readonly error = computed(() => this.dataResource.error());

  constructor() {
    if (this.dataResource.error()) {
      this.logger.error('[AdminUsersFacade] load failed', this.dataResource.error());
    }
  }

  /**
   * Flip an admin's active flag. RLS allows this for admin:users:manage. Once
   * inactive, has_admin_permission() denies all their access and AdminAuth's
   * enforceAdminSession() signs them out on their next auth event (token
   * refresh / reload) — see admin-auth.ts.
   * ponytail: refetches the whole list after the write — fine for a small,
   * rarely-used admin table; switch to an optimistic patch if it ever grows.
   */
  async setActive(userId: string, isActive: boolean): Promise<boolean> {
    try {
      const client = await this.supabase.getClient();
      const { error } = await client
        .from('admin_users')
        .update({ is_active: isActive })
        .eq('user_id', userId);
      if (error) throw error;

      this.dataResource.reload();
      this.notification.success(
        isActive ? 'User activated' : 'User deactivated',
        isActive
          ? 'They can sign in again.'
          : 'They can no longer sign in and will be signed out on their next session refresh.',
      );
      return true;
    } catch (err) {
      this.logger.error('[AdminUsersFacade] setActive failed', err);
      this.notification.error(
        'Update failed',
        err instanceof Error ? err.message : 'Please try again.',
      );
      return false;
    }
  }

  /**
   * Replace the email-domain mapping for one admin. RLS gates both writes on
   * `admin:users:manage` (20260519000000_partner_users_admin.sql). Delete-then-
   * insert mirrors what `provision_admin_user` does, so the two paths agree.
   */
  async setDomains(userId: string, domains: string[]): Promise<boolean> {
    try {
      const client = await this.supabase.getClient();
      const { error: delError } = await client
        .from('admin_user_email_domains')
        .delete()
        .eq('user_id', userId);
      if (delError) throw delError;

      if (domains.length) {
        const { error } = await client
          .from('admin_user_email_domains')
          .insert(domains.map((domain) => ({ user_id: userId, domain })));
        if (error) throw error;
      }

      this.dataResource.reload();
      this.notification.success(
        'Domains updated',
        domains.length
          ? `Mapped to ${domains.join(', ')}.`
          : 'All domain mappings removed — this admin now sees the unfiltered scope.',
      );
      return true;
    } catch (err) {
      this.logger.error('[AdminUsersFacade] setDomains failed', err);
      this.notification.error(
        'Update failed',
        err instanceof Error ? err.message : 'Please try again.',
      );
      return false;
    }
  }

  /**
   * Replace an admin's role set via the `set_admin_user_roles` RPC, which
   * enforces the partner-role exclusivity, the super_admin grant guard and the
   * "never strand the app without a super admin" rule server-side.
   */
  async setRoles(userId: string, slugs: string[]): Promise<boolean> {
    try {
      const client = await this.supabase.getClient();
      const { error } = await client.rpc('set_admin_user_roles', {
        p_user_id: userId,
        p_role_slugs: slugs,
      });
      if (error) throw error;

      this.dataResource.reload();
      this.notification.success('Roles updated', 'They apply on their next sign-in or refresh.');
      return true;
    } catch (err) {
      this.logger.error('[AdminUsersFacade] setRoles failed', err);
      this.notification.error(
        'Update failed',
        err instanceof Error ? err.message : 'Please try again.',
      );
      return false;
    }
  }

  /**
   * Permanently delete an admin login via the `delete_admin_user` RPC
   * (SECURITY DEFINER — auth.users deletion needs elevation; cascades wipe all
   * admin_* rows). The RPC refuses self-delete and non-admin targets.
   */
  async deleteUser(userId: string, email: string): Promise<boolean> {
    try {
      const client = await this.supabase.getClient();
      const { error } = await client.rpc('delete_admin_user', { p_user_id: userId });
      if (error) throw error;

      this.dataResource.reload();
      this.notification.success('User deleted', `${email} has been permanently removed.`);
      return true;
    } catch (err) {
      this.logger.error('[AdminUsersFacade] deleteUser failed', err);
      this.notification.error(
        'Delete failed',
        err instanceof Error ? err.message : 'Please try again.',
      );
      return false;
    }
  }

  reload(): void {
    this.dataResource.reload();
  }
}
