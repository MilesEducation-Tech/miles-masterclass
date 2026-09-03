import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormField as AngularFormField, disabled, form, validate } from '@angular/forms/signals';
import { DialogRef } from '../../../core/services/dialog/dialog';
import { Auth } from '../../../core/services/auth/auth';
import { ApiClient } from '../../../core/services/api-client/api-client';
import { Logger } from '../../../core/services/logger/logger';
import { NotificationService } from '../../../core/services/notification/notification';
import { JobSectors } from '../../../core/services/job-sectors/job-sectors';
import { PROFILE_ROUTES } from '../../../core/models/profile.model';
import { RouteResponse } from '../../../core/models/http.model';
import { AriaAutocomplete } from '../../ui/aria/aria-autocomplete/aria-autocomplete';
import { Button } from '../../ui/button/button';
import { Forms } from '../../ui/forms/forms';

export interface ProfileCompletionDialogResult {
  saved: boolean;
}

type SaveProfileResponse = RouteResponse<typeof PROFILE_ROUTES.saveProfile>;

interface ProfileCompletionFormState {
  sector_id: number | null;
  job_role_id: number | null;
}

@Component({
  selector: 'app-profile-completion-dialog',
  imports: [AriaAutocomplete, Button, Forms, AngularFormField],
  templateUrl: './profile-completion-dialog.html',
  styleUrl: './profile-completion-dialog.css',
})
export class ProfileCompletionDialog {
  dialogRef!: DialogRef<ProfileCompletionDialog, ProfileCompletionDialogResult>;

  private readonly http = inject(ApiClient);
  private readonly auth = inject(Auth);
  private readonly logger = inject(Logger);
  private readonly notification = inject(NotificationService);
  private readonly jobSectors = inject(JobSectors);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(false);

  readonly model = signal<ProfileCompletionFormState>({
    sector_id: null,
    job_role_id: null,
  });

  readonly profileForm = form<ProfileCompletionFormState>(this.model, (s) => {
    validate(s.sector_id, ({ value }) =>
      value() != null ? null : { kind: 'required', message: 'Sector is required' },
    );
    validate(s.job_role_id, ({ value }) =>
      value() != null ? null : { kind: 'required', message: 'Job role is required' },
    );
    // Roles are sector-scoped; lock until a sector is chosen. [formField]-bound
    // controls don't accept a direct [disabled] template binding (NG8022).
    disabled(s.job_role_id, { when: () => this.model().sector_id == null });
  });

  readonly sectorOptions = this.jobSectors.sectorOptions;

  readonly jobRoleOptions = computed(() => this.jobSectors.rolesFor(this.model().sector_id));

  constructor() {
    // Pre-fill if the current user already has one of the two fields set (the
    // dialog opens when *either* is missing). Names on the User model are
    // resolved back to ids by the JobSectors service. Runs once when both
    // signals are available — guarded against overwriting an in-progress edit.
    effect(() => {
      const user = this.auth.currentUser();
      const sectors = this.jobSectors.sectors();
      if (!user || sectors.length === 0) return;
      untracked(() => {
        if (this.model().sector_id != null) return;
        const ids = this.jobSectors.resolveIds(user.sector, user.job_role);
        if (ids.sector_id == null) return;
        this.model.set(ids);
      });
    });

    // Clear `job_role_id` when it stops being a valid option for the current
    // sector. Checking against the live `jobRoleOptions` (rather than a
    // sector-id transition) means a seeded pair survives — the seeded role
    // is in the seeded sector's role list — while a stale role under a new
    // sector still gets cleared.
    effect(() => {
      const currentRoleId = this.model().job_role_id;
      if (currentRoleId == null) return;
      const validIds = this.jobRoleOptions().map((o) => o.value);
      if (validIds.includes(currentRoleId)) return;
      untracked(() => this.model.update((m) => ({ ...m, job_role_id: null })));
    });
  }

  submit(): void {
    if (this.profileForm().invalid() || this.loading()) return;
    const { sector_id, job_role_id } = this.model();
    this.loading.set(true);
    this.http
      .patch<SaveProfileResponse>(PROFILE_ROUTES.saveProfile.path, { sector_id, job_role_id })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.loading.set(false);
          if (res?.status && res.user) {
            this.auth.setAuthenticated(res.user);
            this.notification.success('Profile updated', "We'll tailor your recommendations now.");
            this.dialogRef.close({ saved: true });
          } else {
            this.notification.error(
              'Profile update failed',
              res?.message ?? 'Could not save your details. Please try again.',
            );
          }
        },
        error: (err) => {
          this.loading.set(false);
          this.logger.error('Failed to update sector/job_role', err);
        },
      });
  }
}
