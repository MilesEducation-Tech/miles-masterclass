import { isPlatformBrowser } from '@angular/common';
import { computed, inject, Service, PLATFORM_ID, resource } from '@angular/core';
import { Supabase } from '@core/services/supabase/supabase';
import { Logger } from '@core/services/logger/logger';
import { NotificationService } from '@core/services/notification/notification';

export interface RbacRole {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  is_system: boolean;
  permissionIds: string[];
}

export interface RbacPermission {
  id: string;
  key: string;
  category: string;
  label: string;
  description: string | null;
}

interface RbacData {
  roles: RbacRole[];
  permissions: RbacPermission[];
}

const EMPTY: RbacData = { roles: [], permissions: [] };

export interface RoleInput {
  slug: string;
  name: string;
  description: string;
  permissionIds: string[];
}

export interface PermissionInput {
  key: string;
  category: string;
  label: string;
  description: string;
}

/**
 * CRUD over the RBAC catalog (admin_roles, admin_permissions,
 * admin_role_permissions) straight from Supabase. RLS gates writes by
 * admin:roles:manage / admin:permissions:manage; reads are open to any admin.
 * ponytail: refetches the whole catalog after each write — the catalog is tiny
 * and rarely edited, so optimistic patching isn't worth the bookkeeping.
 */
// Route-scoped (see admin.routes.ts): the injector dies on navigation, which
// aborts in-flight resource() loads and stops this page's calls firing elsewhere.
@Service({ autoProvided: false })
export class RbacFacade {
  private readonly supabase = inject(Supabase);
  private readonly logger = inject(Logger);
  private readonly notification = inject(NotificationService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly dataResource = resource<RbacData, unknown>({
    params: () => (this.isBrowser ? true : undefined),
    loader: async () => {
      const client = await this.supabase.getClient();
      const [roles, perms, rolePerms] = await Promise.all([
        client.from('admin_roles').select('id, slug, name, description, is_system').order('name'),
        client
          .from('admin_permissions')
          .select('id, key, category, label, description')
          .order('category')
          .order('label'),
        client.from('admin_role_permissions').select('role_id, permission_id'),
      ]);

      const firstError = roles.error || perms.error || rolePerms.error;
      if (firstError) throw firstError;

      const permsByRole = new Map<string, string[]>();
      for (const row of (rolePerms.data ?? []) as { role_id: string; permission_id: string }[]) {
        const list = permsByRole.get(row.role_id) ?? [];
        list.push(row.permission_id);
        permsByRole.set(row.role_id, list);
      }

      const roleRows: RbacRole[] = ((roles.data ?? []) as Omit<RbacRole, 'permissionIds'>[]).map(
        (r) => ({ ...r, permissionIds: permsByRole.get(r.id) ?? [] }),
      );

      return {
        roles: roleRows,
        permissions: (perms.data ?? []) as RbacPermission[],
      };
    },
  });

  private readonly data = computed(() => this.dataResource.value() ?? EMPTY);

  readonly roles = computed(() => this.data().roles);
  readonly permissions = computed(() => this.data().permissions);
  readonly isLoading = computed(() => this.dataResource.isLoading());
  readonly error = computed(() => this.dataResource.error());

  reload(): void {
    this.dataResource.reload();
  }

  // ---- Roles ---------------------------------------------------------------

  async createRole(input: RoleInput): Promise<boolean> {
    try {
      const client = await this.supabase.getClient();
      const { data, error } = await client
        .from('admin_roles')
        .insert({ slug: input.slug, name: input.name, description: input.description || null })
        .select('id')
        .single();
      if (error) throw error;

      await this.replaceRolePermissions(data.id as string, [], input.permissionIds);
      this.dataResource.reload();
      this.notification.success('Role created', `“${input.name}” is ready to assign.`);
      return true;
    } catch (err) {
      return this.fail('Could not create role', err);
    }
  }

  async updateRole(
    id: string,
    input: { name: string; description: string; permissionIds: string[] },
  ): Promise<boolean> {
    try {
      const client = await this.supabase.getClient();
      const { error } = await client
        .from('admin_roles')
        .update({ name: input.name, description: input.description || null })
        .eq('id', id);
      if (error) throw error;

      const current = this.roles().find((r) => r.id === id)?.permissionIds ?? [];
      await this.replaceRolePermissions(id, current, input.permissionIds);
      this.dataResource.reload();
      this.notification.success('Role updated', `“${input.name}” saved.`);
      return true;
    } catch (err) {
      return this.fail('Could not update role', err);
    }
  }

  async deleteRole(id: string): Promise<boolean> {
    try {
      const client = await this.supabase.getClient();
      const { error } = await client.from('admin_roles').delete().eq('id', id);
      if (error) throw error;
      this.dataResource.reload();
      this.notification.success('Role deleted', 'The role was removed.');
      return true;
    } catch (err) {
      // FK is ON DELETE RESTRICT for admin_user_roles — a role assigned to an
      // admin can't be deleted until it's reassigned.
      return this.fail('Could not delete role', err, 'It may still be assigned to an admin user.');
    }
  }

  /** Diff role→permission rows: insert the added ids, delete the removed ones. */
  private async replaceRolePermissions(
    roleId: string,
    current: string[],
    next: string[],
  ): Promise<void> {
    const client = await this.supabase.getClient();
    const toAdd = next.filter((p) => !current.includes(p));
    const toRemove = current.filter((p) => !next.includes(p));

    if (toAdd.length) {
      const rows = toAdd.map((permission_id) => ({ role_id: roleId, permission_id }));
      const { error } = await client.from('admin_role_permissions').insert(rows);
      if (error) throw error;
    }
    if (toRemove.length) {
      const { error } = await client
        .from('admin_role_permissions')
        .delete()
        .eq('role_id', roleId)
        .in('permission_id', toRemove);
      if (error) throw error;
    }
  }

  // ---- Permissions ---------------------------------------------------------

  async createPermission(input: PermissionInput): Promise<boolean> {
    try {
      const client = await this.supabase.getClient();
      const { error } = await client.from('admin_permissions').insert({
        key: input.key,
        category: input.category,
        label: input.label,
        description: input.description || null,
      });
      if (error) throw error;
      this.dataResource.reload();
      this.notification.success('Permission created', `“${input.key}” added to the catalog.`);
      return true;
    } catch (err) {
      return this.fail('Could not create permission', err);
    }
  }

  async updatePermission(
    id: string,
    input: { category: string; label: string; description: string },
  ): Promise<boolean> {
    try {
      const client = await this.supabase.getClient();
      const { error } = await client
        .from('admin_permissions')
        .update({
          category: input.category,
          label: input.label,
          description: input.description || null,
        })
        .eq('id', id);
      if (error) throw error;
      this.dataResource.reload();
      this.notification.success('Permission updated', `“${input.label}” saved.`);
      return true;
    } catch (err) {
      return this.fail('Could not update permission', err);
    }
  }

  async deletePermission(id: string): Promise<boolean> {
    try {
      const client = await this.supabase.getClient();
      const { error } = await client.from('admin_permissions').delete().eq('id', id);
      if (error) throw error;
      this.dataResource.reload();
      this.notification.success('Permission deleted', 'It was removed from every role.');
      return true;
    } catch (err) {
      return this.fail('Could not delete permission', err);
    }
  }

  private fail(title: string, err: unknown, fallback?: string): boolean {
    this.logger.error(`[RbacFacade] ${title}`, err);
    const message =
      err instanceof Error && err.message ? err.message : (fallback ?? 'Please try again.');
    this.notification.error(title, message);
    return false;
  }
}
