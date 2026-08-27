import {
  Component,
  DestroyRef,
  effect,
  inject,
  linkedSignal,
  signal,
  computed,
  untracked,
} from '@angular/core';
import { Auth } from '../../../../shared/core/services/auth/auth';
import { ApiClient } from '../../../../shared/core/services/api-client/api-client';
import { CAIRA } from '../../../../shared/core/http/caira.endpoints';
import { cairaError, userMessage } from '../../../../shared/core/http/caira-error';
import {
  CairaUser,
  StatusResponse,
  UpdateUserRequest,
  UpdateUserResponse,
  toCairaUser,
} from '../../../../shared/core/models/caira/auth.model';
import {
  disabled,
  form,
  FormField as AngularFormField,
  required,
  validate,
} from '@angular/forms/signals';
import { Forms } from '../../../../shared/components/ui/forms/forms';
import { AriaInput } from '../../../../shared/components/ui/aria/aria-input/aria-input';
import { Button } from '../../../../shared/components/ui/button/button';
import { AriaAutocomplete } from '../../../../shared/components/ui/aria/aria-autocomplete/aria-autocomplete';
import { AriaMultiselect } from '../../../../shared/components/ui/aria/aria-multiselect/aria-multiselect';
import { AutoCompleteOption } from '../../../../shared/core/models/form.model';
import { NotificationService } from '../../../../shared/core/services/notification/notification';
import { Logger } from '../../../../shared/core/services/logger/logger';
import { Analytics } from '../../../../shared/core/services/analytics/analytics';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, ActivatedRoute } from '@angular/router';
import { dialCodeWithLength } from '../../../../shared/core/constant/dial-code';
import { map } from 'rxjs/operators';
import { Observable, firstValueFrom } from 'rxjs';
import { Dialog } from '../../../../shared/core/services/dialog/dialog';
import { PartnerCode } from '../../../../shared/core/services/partner-code/partner-code';
import {
  UtilsDialog,
  DialogButton,
} from '../../../../shared/components/dialog/utils-dialog/utils-dialog';

/**
 * Translate the changed slice of the form into a `v2/update` body.
 *
 * Only the fields CAIRA accepts are forwarded. The other six
 * (`is_currently_working`, `terms_accepted`, `license_status`, `state_board`,
 * `professional_courses`, `company_id` / `sector_id` / `job_role_id`) have no
 * counterpart on the endpoint, so sending them would be silently dropped by the
 * serializer at best — dropping them here makes that explicit.
 *
 * Note `location` maps to `city`, and `mobile` / `country_code` are **not**
 * writable through this endpoint at all: the phone number is owned by the SSO
 * and changed through the Miles One app.
 */
function toUpdateRequest(changed: Partial<ProfileFormState>): UpdateUserRequest {
  const body: UpdateUserRequest = {};
  if (changed.first_name !== undefined) body.first_name = changed.first_name;
  if (changed.last_name !== undefined) body.last_name = changed.last_name;
  if (changed.email !== undefined) body.email = changed.email;
  if (changed.location !== undefined) body.city = changed.location;
  return body;
}

/**
 * Fields the profile form renders and validates. This is the form's own shape,
 * not a wire payload — it stays here so the signal-forms schema keeps its field
 * typing. `toUpdateRequest` maps it onto `v2/update` at the edge.
 */
interface ProfileFormState {
  email: string;
  first_name: string;
  last_name: string;
  country_code: string;
  location: string;
  mobile: string;
  is_currently_working: boolean;
  terms_accepted: boolean;
  license_status: string;
  state_board: number[];
  professional_courses: number[];
  company_id: number | null;
  sector_id: number | null;
  job_role_id: number | null;
}

@Component({
  selector: 'app-profile',
  imports: [Forms, AriaInput, Button, AngularFormField, AriaAutocomplete, AriaMultiselect],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
  host: {
    '(window:beforeunload)': 'onBeforeUnload($event)',
  },
})
export class Profile {
  private readonly api = inject(ApiClient);
  private readonly auth = inject(Auth);
  private readonly dialog = inject(Dialog);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly notification = inject(NotificationService);
  private readonly logger = inject(Logger);
  private readonly analytics = inject(Analytics);
  // ponytail: JobSectors was deleted with the Django strip. This placeholder
  // keeps the template bindings compiling and renders the empty state.
  // Swap in the new backend's service — the template needs no changes.
  private readonly partnerCode = inject(PartnerCode);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * Map the authenticated user onto the form shape. Shared by the form's source
   * signal and `save()`'s diff baseline, so an untouched form diffs to
   * "no change".
   *
   * Six of the thirteen fields have **no CAIRA counterpart** and seed empty:
   * `is_currently_working`, `terms_accepted`, `license_status`,
   * `professional_courses`, `company_id`, `sector_id` and `job_role_id`. Their
   * values came from `User` columns and reference-data endpoints that the
   * backend does not expose — see the gap register. They stay in the form so
   * the template renders unchanged and so they light up the moment endpoints
   * land.
   *
   * The seven that do map are the ones `v2/status` returns and `v2/update`
   * accepts.
   */
  private mapUserToForm(user: CairaUser | null): ProfileFormState {
    return {
      email: user?.email || '',
      first_name: user?.firstName || '',
      last_name: user?.lastName || '',
      country_code: user?.countryCode || '',
      location: user?.location || '',
      mobile: user?.phone || '',
      is_currently_working: false,
      terms_accepted: false,
      license_status: '',
      state_board: [],
      professional_courses: [],
      company_id: null,
      sector_id: null,
      job_role_id: null,
    };
  }

  readonly profile = linkedSignal<ProfileFormState>(() =>
    this.mapUserToForm(this.auth.currentUser()),
  );

  /**
   * Drives the "returning learner" branches — the CPA-status field, the
   * partner-code prompt, the terms checkbox.
   *
   * Was `user.is_existing_user`. CAIRA has no such column; the nearest true
   * statement is "this profile is already filled in", which `v2/status` can
   * answer.
   */
  readonly isExistingUser = computed(() => this.auth.isProfileComplete());

  readonly countryCodes: any[] = dialCodeWithLength.map((item) => ({
    ...item,
    value: item.CountryCode?.toString() || '',
    label: item.CountryCode?.toString() || '',
  }));

  readonly profileForm = form<ProfileFormState>(this.profile, (s) => {
    // Required Fields
    required(s.email, { message: 'Email is required' });
    required(s.first_name, { message: 'First Name is required' });
    required(s.last_name, { message: 'Last Name is required' });
    required(s.mobile, { message: 'Mobile Number is required' });
    required(s.country_code, { message: 'Code is required' });
    required(s.location, { message: 'Location is required' });

    // CPA Status is required only for existing users — new users don't see
    // the field at all, so requiring it would lock them out of save.
    validate(s.license_status, ({ value }) => {
      if (!this.isExistingUser()) return null;
      return value() ? null : { kind: 'required', message: 'CPA Status is required' };
    });

    // Mobile: digits-only + min/max length based on selected country code.
    // Only effective for users entering their phone for the first time — once
    // `currentUser().mobile` is set, the disabled() rule below freezes the field
    // and these validators no longer fire (server-side data is already canonical).
    validate(s.mobile, ({ value }) => {
      const val = value();
      if (!val) return null;
      if (!/^\d+$/.test(val)) {
        return { kind: 'pattern', message: 'Must be digits' };
      }
      const selectedCode = this.countryCodes.find(
        (c) => c.CountryCode === this.profile().country_code,
      );
      if (selectedCode) {
        const min = selectedCode.phLengthMin ?? 7;
        const max = selectedCode.phLengthMax ?? 18;
        if (val.length < min) {
          return { kind: 'minlength', message: `Minimum length is ${min}` };
        }
        if (val.length > max) {
          return { kind: 'maxlength', message: `Maximum length is ${max}` };
        }
      }
      return null;
    });

    // Country code: must be a valid selection from the list when set
    validate(s.country_code, ({ value }) => {
      const val = value();
      if (!val) return null;
      const selectedCode = this.countryCodes.find((c) => c.CountryCode === val);
      return selectedCode ? null : { kind: 'required', message: 'Invalid Country code' };
    });

    // Disabling logic
    disabled(s.email, { when: () => !!this.auth.currentUser()?.email });
    disabled(s.country_code, { when: () => !!this.auth.currentUser()?.countryCode });
    disabled(s.mobile, { when: () => !!this.auth.currentUser()?.phone });
    disabled(s.location, { when: () => !!this.auth.currentUser()?.location });

    // Conditional Validation for State Boards (Required if CPA is Yes).
    // Gated on isExistingUser — the field isn't rendered for new users.
    validate(s.state_board, (val) => {
      if (!this.isExistingUser()) return null;
      const isCpa = this.profile().license_status === 'yes';
      if (isCpa && (!val.value() || val.value().length === 0)) {
        return {
          kind: 'required',
          message: 'Please select at least one State Board',
        };
      }
      return null;
    });

    // Conditional Validation for Professional Certification (Required if CPA is No).
    // Gated on isExistingUser — the field isn't rendered for new users.
    validate(s.professional_courses, (val) => {
      if (!this.isExistingUser()) return null;
      const isNotCpa = this.profile().license_status === 'no';
      if (isNotCpa && (!val.value() || val.value().length === 0)) {
        return {
          kind: 'required',
          message: 'Professional Certification is required',
        };
      }
      return null;
    });

    // Validations for Terms Accepted (Required if New User)
    validate(s.terms_accepted, (val) => {
      const isExistingUser = this.auth.isProfileComplete();
      if (!isExistingUser && !val.value()) {
        return {
          kind: 'required',
          message: 'Please accept the terms and conditions',
        };
      }
      return null;
    });
  });

  // Partner Code — owned by the PartnerCode service (shared with the
  // partner-code prompt dialog). Loading + toasts + profile-refresh live there;
  // the profile page just hosts the inline form.
  readonly partnerCodeLoading = this.partnerCode.loading;
  readonly partnerCodeApplied = signal(false);
  readonly partnerCodeModel = signal<{ partner_code: string }>({ partner_code: '' });
  readonly partnerCodeForm = form(this.partnerCodeModel, (s) => {
    disabled(s.partner_code, { when: () => this.partnerCodeLoading() });
  });
  readonly canApplyPartnerCode = computed(
    () => this.partnerCodeModel().partner_code.trim().length > 0 && !this.partnerCodeLoading(),
  );
  readonly showPartnerCodeSection = computed(
    () => this.isExistingUser() && !this.partnerCodeApplied() && !this.auth.hasActivePlan(),
  );

  // Data Fetching

  // Company Search Signal
  // ponytail: seeded from `currentUser().company[0].company_name`. CAIRA's
  // user has no company relation and there is no company lookup endpoint.
  readonly companySearchQuery = signal('');

  // ponytail: the profession list and debounced company search both came from
  // PROFILE_ROUTES. Point these two signals at the new backend and the
  // autocompletes work unchanged.
  readonly professions = signal<any[]>([]);

  readonly companyOptions = signal<AutoCompleteOption<number>[]>([]);

  readonly stateBoardOptions = signal<AutoCompleteOption<number>[]>([]);
  readonly professionalCourseOptions = signal<AutoCompleteOption<number>[]>([]);

  // Job sectors — single source of truth via the JobSectors service. The
  // service holds the cached fetch so the profile page and the engagement
  // dialog don't each hit the endpoint.
  /**
   * ponytail: Sector and Job Role are gone from the form, not merely emptied.
   *
   * G-10: CAIRA has no reference-data endpoint for either, and `v2/update`
   * excludes both fields — so the controls could be neither populated nor
   * saved. Worse, `sectorOptions` aliased `null as any` and the template called
   * it, which threw during render.
   *
   * Restore both controls together with the sectors endpoint.
   */

  constructor() {
    // Effect to handle conditional data fetching
    effect(() => {
      const cpaStatus = this.profile().license_status;
      if (cpaStatus === 'yes' && this.stateBoardOptions().length === 0) {
        this.fetchStateBoards();
      } else if (cpaStatus === 'no' && this.professionalCourseOptions().length === 0) {
        this.fetchProfessionalCourses();
      }
    });

    // Reset the CPA-dependent selection that no longer applies when the license
    // status changes (yes→no drops the state boards, no→yes drops the courses,
    // na drops both) so a hidden stale selection can't be saved. Only writes
    // when there's something to clear, so it's a no-op on the initial seed (a
    // user only ever has one of the two populated).
    effect(() => {
      const status = this.profile().license_status;
      untracked(() => {
        const p = this.profile();
        const clearBoards = status !== 'yes' && p.state_board.length > 0;
        const clearCourses = status !== 'no' && p.professional_courses.length > 0;
        if (!clearBoards && !clearCourses) return;
        this.profile.update((cur) => ({
          ...cur,
          state_board: clearBoards ? [] : cur.state_board,
          professional_courses: clearCourses ? [] : cur.professional_courses,
        }));
      });
    });

    // Resolve `sector_id` / `job_role_id` from the user's current display
    // names once both the user and the sector list are available. Skipped if
    // the user has already started editing (sector_id is non-null), so we
    // never clobber in-progress input.
    // Clear `job_role_id` when it stops being a valid option for the current
    // sector — i.e. user picked a new sector whose roles don't include the
    // previously-selected role, or cleared the sector entirely. Gated on the
    // sector list being loaded so the seeded role isn't wiped during the
    // initial render while options are still empty.
  }

  onCompanySearch(search: string) {
    this.companySearchQuery.set(search);
  }

  private async fetchStateBoards() {
    // ponytail: was a `getStateBoardList` GET. Feed `boards` from the new
    // backend and the name→id seeding below keeps working as-is.
    const boards: any[] = [];
    if (boards.length > 0) {
      this.stateBoardOptions.set(boards.map((b: any) => ({ label: b.name, value: b.id })));
      // Now the name→id map exists, seed the user's saved boards (the API only
      // returns names). Skip if the user has already selected something.
      // ponytail: was `currentUser().state_board_name`. No CAIRA equivalent.
      const ids = this.resolveStateBoardIds(null);
      if (ids.length > 0 && this.profile().state_board.length === 0) {
        this.profile.update((p) => ({ ...p, state_board: ids }));
      }
    }
  }

  /** Map saved state-board names to their ids using the loaded board list. */
  private resolveStateBoardIds(names: string[] | null | undefined): number[] {
    if (!names?.length) return [];
    const opts = this.stateBoardOptions();
    return names
      .map((n) => opts.find((o) => o.label === n)?.value)
      .filter((v): v is number => v != null);
  }

  private async fetchProfessionalCourses() {
    // ponytail: was a `getProfessionalCourseList` GET.
    const courses: any[] = [];
    if (courses.length > 0) {
      this.professionalCourseOptions.set(
        courses.map((c: any) => ({ label: c.title, value: c.id })),
      );
    }
  }

  readonly cpaStatusOptions: AutoCompleteOption[] = [
    { label: 'Yes', value: 'yes' },
    { label: 'No', value: 'no' },
    { label: 'NA', value: 'na' },
  ];

  // ponytail: `placeSuggestions` came from the deleted LocationAutocomplete
  // service, which proxied Google Places through the backend. Point this at the
  // new backend's place search and the location autocomplete works unchanged.
  readonly locationQuery = signal('');
  readonly locationOptions = signal<AutoCompleteOption<string>[]>([]);

  applyPartnerCode(): void {
    if (!this.canApplyPartnerCode()) {
      return;
    }
    // Service handles the API call, profile refresh, loading flag, and toasts.
    // We just need to flip the section flag on success so it hides.
    this.partnerCode
      .apply(this.partnerCodeModel().partner_code)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ok) => {
        if (ok) this.partnerCodeApplied.set(true);
      });
  }

  async save() {
    if (this.profileForm().invalid()) {
      // TODO: Show validation error toast?
      return;
    }

    // `this.profile()` IS the live edited state. Diff it against the same
    // user→form mapping the source signal seeds from, so an untouched form
    // diffs to "no change". Sector/job_role go through `resolveIds` (mirrors
    // the seeding effect, handles legacy name-only payloads).
    const currentValues = this.profile();
    const user = this.auth.currentUser();
    const initialValues: Partial<any> = user
      ? {
          ...this.mapUserToForm(user),
          state_board: this.resolveStateBoardIds(null),
        }
      : ({} as any);

    const payload: Partial<any> = {};

    let hasChanges = false;

    (Object.keys(currentValues) as (keyof ProfileFormState)[]).forEach((key) => {
      // Simple JSON stringify comparison for primitives and arrays
      if (JSON.stringify(currentValues[key]) !== JSON.stringify(initialValues[key])) {
        (payload as Record<string, unknown>)[key] = currentValues[key];
        hasChanges = true;
      }
    });

    if (!hasChanges) {
      return;
    }

    // Capture new-vs-existing BEFORE the save, so the GA4 lifecycle branch
    // below reflects the pre-save state rather than the refreshed profile.
    const wasComplete = this.auth.isProfileComplete();
    this.isSaving.set(true);

    try {
      const res = await firstValueFrom(
        this.api.post<UpdateUserResponse>(CAIRA.updateUser, toUpdateRequest(payload)),
      );

      // ⚠️ #43 returns **200 even when the email was rejected** — the address is
      // simply not saved and `email_verification` explains why. Reporting a
      // blanket success here would tell the learner their email changed when it
      // did not.
      if (res?.email_verification) {
        this.notification.error(
          'Email not updated',
          'We could not verify that email address. Your other changes were saved.',
        );
      } else {
        this.notification.success('Profile', 'Profile saved successfully');
      }

      // #43's `data` has 18 keys to #42's 19 (no `is_test_user`) and its
      // `mo_education` is not guaranteed to be the `{text,value}` dict, so the
      // canonical read is a fresh v2/status rather than this response body.
      const refreshed = await firstValueFrom(this.api.get<StatusResponse>(CAIRA.status)).catch(
        () => null,
      );
      const user = refreshed?.data ? toCairaUser(refreshed.data) : null;
      if (user) this.auth.setAuthenticated(user);

      // Activation milestone — only on the first incomplete→complete transition.
      if (!wasComplete && this.auth.isProfileComplete()) {
        this.analytics.trackEvent('profile_completed');
      }
      // CPE-parity GA4 lifecycle: a new user's first completion = `onboarding`;
      // any later save by an existing user = `profile_update`.
      if (!wasComplete) {
        this.analytics.trackOnboarding(user, this.auth.currentPlan());
      } else {
        this.analytics.trackProfileUpdate(user, this.auth.currentPlan());
      }

      const redirect = this.route.snapshot.queryParams['redirect'];
      await this.router.navigateByUrl(redirect || '/');
    } catch (error: unknown) {
      const failure = cairaError(error);
      this.logger.error('Failed to save profile', failure);
      // `errorInterceptor` only toasts `unexpected`; a validation failure here
      // is the user's to fix and needs to be said out loud.
      if (failure.kind !== 'unexpected') {
        this.notification.error('Profile', userMessage(failure));
      }
      this.isSaving.set(false);
    }
  }

  // CanDeactivate Logic
  readonly isDirty = this.profileForm().dirty;
  readonly isSaving = signal(false);

  onBeforeUnload(event: Event) {
    if (this.isDirty() && !this.isSaving()) {
      event.preventDefault();
    }
  }

  canDeactivate(): Observable<boolean> | boolean {
    if (!this.isDirty() || this.isSaving()) {
      return true;
    }

    const dialogRef = this.dialog.open<
      UtilsDialog,
      { action?: DialogButton['action']; result: boolean }
    >(UtilsDialog, {
      data: {
        title: 'Unsaved Changes',
        content: [
          {
            type: 'text',
            value: 'You have unsaved changes. Are you sure you want to leave?',
          },
        ],
        buttons: [
          { label: 'Cancel', variant: 'outline', action: 'close' },
          { label: 'Leave', variant: 'destructive', action: 'confirm' },
        ],
      },
    });

    return dialogRef.afterClosed$.pipe(map((result) => result?.action === 'confirm'));
  }
}
