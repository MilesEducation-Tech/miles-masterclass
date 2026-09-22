import { Component, computed, inject, signal } from '@angular/core';
import { AriaInput } from '@shared/components/ui/aria/aria-input/aria-input';
import { Button } from '@shared/components/ui/button/button';
import { Spinner } from '@shared/components/ui/spinner/spinner';
import { AdminAuth } from '@admin/core/services/admin-auth';
import { PERM } from '@core/models/admin/admin-rbac.model';
import { HasPermissionDirective } from '@admin/shared/directives/has-permission.directive';
import { RbacFacade, RbacPermission, RbacRole } from './shared/services/rbac-facade';

type PendingDelete = { type: 'role' | 'permission'; id: string } | null;

@Component({
  selector: 'app-roles-permissions',
  imports: [AriaInput, Button, Spinner, HasPermissionDirective],
  templateUrl: './roles-permissions.html',
  host: { class: 'block w-full' },
})
export class RolesPermissions {
  protected readonly facade = inject(RbacFacade);
  private readonly auth = inject(AdminAuth);

  protected readonly PERM = PERM;
  protected readonly canManageRoles = computed(() =>
    this.auth.hasPermission(PERM.ADMIN_ROLES_MANAGE),
  );
  protected readonly canManagePermissions = computed(() =>
    this.auth.hasPermission(PERM.ADMIN_PERMISSIONS_MANAGE),
  );

  /** Permissions grouped by category — used by both the role checklist and the catalog table. */
  protected readonly permissionGroups = computed(() => {
    const groups = new Map<string, RbacPermission[]>();
    for (const p of this.facade.permissions()) {
      const arr = groups.get(p.category) ?? [];
      arr.push(p);
      groups.set(p.category, arr);
    }
    return [...groups.entries()].map(([category, perms]) => ({ category, perms }));
  });

  protected readonly pendingDelete = signal<PendingDelete>(null);
  protected isSaving = signal(false);

  // ---- Role form -----------------------------------------------------------
  protected readonly showRoleForm = signal(false);
  protected readonly editingRoleId = signal<string | null>(null);
  protected readonly roleName = signal('');
  protected readonly roleSlug = signal('');
  protected readonly roleDescription = signal('');
  protected readonly rolePerms = signal<ReadonlySet<string>>(new Set());

  protected readonly roleSlugInvalid = computed(() => {
    const v = this.roleSlug().trim();
    if (!v) return false;
    return !/^[a-z][a-z0-9_]*$/.test(v);
  });
  protected readonly canSaveRole = computed(
    () =>
      !!this.roleName().trim() &&
      (!!this.editingRoleId() || (!!this.roleSlug().trim() && !this.roleSlugInvalid())),
  );

  protected permName(id: string): string {
    return this.facade.permissions().find((p) => p.id === id)?.key ?? '';
  }

  protected openCreateRole(): void {
    this.editingRoleId.set(null);
    this.roleName.set('');
    this.roleSlug.set('');
    this.roleDescription.set('');
    this.rolePerms.set(new Set());
    this.showRoleForm.set(true);
  }

  protected openEditRole(role: RbacRole): void {
    if (role.is_system) return;
    this.editingRoleId.set(role.id);
    this.roleName.set(role.name);
    this.roleSlug.set(role.slug);
    this.roleDescription.set(role.description ?? '');
    this.rolePerms.set(new Set(role.permissionIds));
    this.showRoleForm.set(true);
  }

  protected cancelRoleForm(): void {
    this.showRoleForm.set(false);
  }

  protected isPermChecked(id: string): boolean {
    return this.rolePerms().has(id);
  }

  protected toggleRolePerm(id: string, checked: boolean): void {
    this.rolePerms.update((set) => {
      const next = new Set(set);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  protected async saveRole(): Promise<void> {
    if (!this.canSaveRole() || this.isSaving()) return;
    this.isSaving.set(true);
    const permissionIds = [...this.rolePerms()];
    const id = this.editingRoleId();
    const ok = id
      ? await this.facade.updateRole(id, {
          name: this.roleName().trim(),
          description: this.roleDescription().trim(),
          permissionIds,
        })
      : await this.facade.createRole({
          slug: this.roleSlug().trim(),
          name: this.roleName().trim(),
          description: this.roleDescription().trim(),
          permissionIds,
        });
    this.isSaving.set(false);
    if (ok) this.showRoleForm.set(false);
  }

  // ---- Permission form -----------------------------------------------------
  protected readonly showPermForm = signal(false);
  protected readonly editingPermId = signal<string | null>(null);
  protected readonly permKey = signal('');
  protected readonly permCategory = signal('');
  protected readonly permLabel = signal('');
  protected readonly permDescription = signal('');

  protected readonly permKeyInvalid = computed(() => {
    const v = this.permKey().trim();
    if (!v) return false;
    return !/^[a-z][a-z0-9:_-]*$/.test(v);
  });
  protected readonly canSavePerm = computed(
    () =>
      !!this.permLabel().trim() &&
      !!this.permCategory().trim() &&
      (!!this.editingPermId() || (!!this.permKey().trim() && !this.permKeyInvalid())),
  );

  protected openCreatePerm(): void {
    this.editingPermId.set(null);
    this.permKey.set('');
    this.permCategory.set('');
    this.permLabel.set('');
    this.permDescription.set('');
    this.showPermForm.set(true);
  }

  protected openEditPerm(perm: RbacPermission): void {
    this.editingPermId.set(perm.id);
    this.permKey.set(perm.key);
    this.permCategory.set(perm.category);
    this.permLabel.set(perm.label);
    this.permDescription.set(perm.description ?? '');
    this.showPermForm.set(true);
  }

  protected cancelPermForm(): void {
    this.showPermForm.set(false);
  }

  protected async savePerm(): Promise<void> {
    if (!this.canSavePerm() || this.isSaving()) return;
    this.isSaving.set(true);
    const id = this.editingPermId();
    const ok = id
      ? await this.facade.updatePermission(id, {
          category: this.permCategory().trim(),
          label: this.permLabel().trim(),
          description: this.permDescription().trim(),
        })
      : await this.facade.createPermission({
          key: this.permKey().trim(),
          category: this.permCategory().trim(),
          label: this.permLabel().trim(),
          description: this.permDescription().trim(),
        });
    this.isSaving.set(false);
    if (ok) this.showPermForm.set(false);
  }

  // ---- Delete (two-step inline confirm) ------------------------------------
  protected askDelete(type: 'role' | 'permission', id: string): void {
    this.pendingDelete.set({ type, id });
  }

  protected cancelDelete(): void {
    this.pendingDelete.set(null);
  }

  protected isPendingDelete(type: 'role' | 'permission', id: string): boolean {
    const p = this.pendingDelete();
    return !!p && p.type === type && p.id === id;
  }

  protected async confirmDelete(): Promise<void> {
    const p = this.pendingDelete();
    if (!p || this.isSaving()) return;
    this.isSaving.set(true);
    if (p.type === 'role') await this.facade.deleteRole(p.id);
    else await this.facade.deletePermission(p.id);
    this.isSaving.set(false);
    this.pendingDelete.set(null);
  }
}
