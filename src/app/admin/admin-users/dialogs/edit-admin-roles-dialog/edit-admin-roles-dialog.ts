import { Component, OnInit, computed, signal } from '@angular/core';
import { injectDialogRef } from 'ng-primitives/dialog';
import { DialogShell } from '@shared/ui/dialog-shell/dialog-shell';
import { toggleRoleSlug } from '@admin/core/models/admin-rbac.model';
import { Button } from '@shared/ui/button/button';
import { AriaInput } from '@shared/ui/aria/aria-input/aria-input';

export interface EditAdminRolesRole {
  slug: string;
  name: string;
  description: string | null;
}

export interface EditAdminRolesDialogData {
  /** Display only — whose roles are being edited. */
  email: string;
  roles: EditAdminRolesRole[];
  /** Slugs currently held. */
  selected: string[];
  /** Editing your own row: super_admin can't be removed (RPC refuses too). */
  isSelf: boolean;
  /** Only a super admin may grant super_admin (RPC refuses too). */
  callerIsSuper: boolean;
}

/**
 * Replace an admin's role set. Partner roles behave like radios (one Django
 * PartnerAdmin row per login); everything else stacks. Resolves with the new
 * slug list, or `undefined` on cancel / no change.
 */
@Component({
  selector: 'app-edit-admin-roles-dialog',
  imports: [Button, AriaInput, DialogShell],
  templateUrl: './edit-admin-roles-dialog.html',
  styleUrl: './edit-admin-roles-dialog.css',
})
export class EditAdminRolesDialog implements OnInit {
  private readonly dialogRef = injectDialogRef<EditAdminRolesDialogData, string[] | undefined>();
  protected readonly data = this.dialogRef.data;

  protected readonly selected = signal<ReadonlySet<string>>(new Set());

  protected readonly changed = computed(() => {
    const now = this.selected();
    const was = new Set(this.data?.selected ?? []);
    return now.size !== was.size || [...now].some((s) => !was.has(s));
  });

  protected readonly canSave = computed(() => this.selected().size > 0 && this.changed());

  ngOnInit(): void {
    this.selected.set(new Set(this.data.selected));
  }

  protected isChecked(slug: string): boolean {
    return this.selected().has(slug);
  }

  protected isLocked(slug: string): boolean {
    if (slug !== 'super_admin') return false;
    return !this.data.callerIsSuper || (this.data.isSelf && this.isChecked(slug));
  }

  protected toggle(slug: string, checked: boolean): void {
    this.selected.update((set) => toggleRoleSlug(set, slug, checked));
  }

  cancel(): void {
    this.dialogRef.close();
  }

  save(): void {
    if (!this.canSave()) return;
    this.dialogRef.close([...this.selected()]);
  }
}
