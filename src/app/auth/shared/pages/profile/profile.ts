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
import { placeSuggestions } from '../../../../shared/core/services/location-autocomplete/location-autocomplete';
import { AutoCompleteOption } from '../../../../shared/core/models/form.model';
import { ApiClient } from '../../../../shared/core/services/api-client/api-client';
import { NotificationService } from '../../../../shared/core/services/notification/notification';
import { Logger } from '../../../../shared/core/services/logger/logger';
import { Analytics } from '../../../../shared/core/services/analytics/analytics';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router, ActivatedRoute } from '@angular/router';
import {
  ProfessionList,
  PROFILE_ROUTES,
  ProfileFormState,
} from '../../../../shared/core/models/profile.model';
import { CountryCodeOption, User } from '../../../../shared/core/models/auth.model';
import { dialCodeWithLength } from '../../../../shared/core/constant/dial-code';
import { RouteParams, RouteResponse } from '../../../../shared/core/models/http.model';
import { debounceTime, map, switchMap, catchError } from 'rxjs/operators';
import { firstValueFrom, of, Observable } from 'rxjs';
import { Dialog } from '../../../../shared/core/services/dialog/dialog';
import { JobSectors } from '../../../../shared/core/services/job-sectors/job-sectors';
import { PartnerCode } from '../../../../shared/core/services/partner-code/partner-code';
import {
  UtilsDialog,
  DialogButton,
} from '../../../../shared/components/dialog/utils-dialog/utils-dialog';

// Type Definitions using RouteResponse and RouteParams
type CompanyListResponse = RouteResponse<typeof PROFILE_ROUTES.getCompanyList>;
type CompanyListParams = RouteParams<typeof PROFILE_ROUTES.getCompanyList>;
type ProfessionListResponse = RouteResponse<typeof PROFILE_ROUTES.getProfessionList>;
type StateBoardListResponse = RouteResponse<typeof PROFILE_ROUTES.getStateBoardList>;
type ProfessionalCourseListResponse = RouteResponse<
  typeof PROFILE_ROUTES.getProfessionalCourseList
>;
type SaveProfileResponse = RouteResponse<typeof PROFILE_ROUTES.saveProfile>;

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
  private readonly http = inject(ApiClient);
  private readonly auth = inject(Auth);
  private readonly dialog = inject(Dialog);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly notification = inject(NotificationService);
  private readonly logger = inject(Logger);
  private readonly analytics = inject(Analytics);
  private readonly jobSectors = inject(JobSectors);
  private readonly partnerCode = inject(PartnerCode);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * Map the authenticated user onto the form shape. The API returns
   * sector / job_role as `{ id, name }` objects, so the ids are seeded directly
   * (the autocomplete shows the existing selection without waiting for the
   * sector list). Shared by the form's source signal and `save()`'s diff
   * baseline so an untouched form diffs to "no change".
   */
  private mapUserToForm(user: User | null): ProfileFormState {
    return {
      email: user?.email || '',
      first_name: user?.first_name || '',
      last_name: user?.last_name || '',
      country_code: user?.country_code || '',
      location: user?.location || '',
      mobile: user?.mobile || '',
      is_currently_working: user?.is_currently_working || false,
      terms_accepted: user?.terms_accepted || false,
      license_status: user ? user.license_status || '' : 'NA',
      // The API only returns state boards by name; the form is keyed by id, so
      // this seeds empty and `fetchStateBoards()` resolves the saved names→ids
      // once the board list lands.
      state_board: [],
      professional_courses: user?.professional_courses || [],
      company_id: user?.company?.[0]?.id || null,
      sector_id: user?.sector?.id ?? null,
      job_role_id: user?.job_role?.id ?? null,
    };
  }

  readonly profile = linkedSignal<ProfileFormState>(() =>
    this.mapUserToForm(this.auth.currentUser()),
  );

  readonly isExistingUser = computed(() => this.auth.currentUser()?.is_existing_user ?? false);

  readonly countryCodes: CountryCodeOption[] = dialCodeWithLength.map((item) => ({
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
    disabled(s.country_code, { when: () => !!this.auth.currentUser()?.country_code });
    disabled(s.mobile, { when: () => !!this.auth.currentUser()?.mobile });
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

    // Job Role is required once a Sector is picked. Skipped when the chosen
    // sector has no roles — otherwise save would be unreachable.
    validate(s.job_role_id, ({ value }) => {
      const sectorId = this.profile().sector_id;
      if (sectorId == null) return null;
      if (this.jobSectors.rolesFor(sectorId).length === 0) return null;
      return value() != null ? null : { kind: 'required', message: 'Job Role is required' };
    });

    // Validations for Terms Accepted (Required if New User)
    validate(s.terms_accepted, (val) => {
      const isExistingUser = this.auth.currentUser()?.is_existing_user;
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
  readonly companySearchQuery = signal(this.auth.currentUser()?.company?.[0]?.company_name || '');

  // Profession List (One-time fetch)
  readonly professions = toSignal(
    this.http.get<ProfessionListResponse>(PROFILE_ROUTES.getProfessionList.path).pipe(
      map((res) => res.data ?? []),
      catchError(() => of([])),
    ),
    { initialValue: [] as ProfessionList[] },
  );

  // Company Options (Search Stream mapped directly)
  readonly companyOptions = toSignal(
    toObservable(this.companySearchQuery).pipe(
      debounceTime(300),
      switchMap((search: string) => {
        const params: CompanyListParams = { search };
        return this.http
          .get<CompanyListResponse>(PROFILE_ROUTES.getCompanyList.path, { params })
          .pipe(
            map((res) =>
              (res.data ?? []).map(
                (c) => ({ label: c.company_name, value: c.id }) as AutoCompleteOption<number>,
              ),
            ),
            catchError((err) => {
              this.logger.error('Company list fetch failed', err);
              return of([] as AutoCompleteOption<string>[]);
            }),
          );
      }),
    ),
    { initialValue: [] as AutoCompleteOption<string>[] },
  );

  readonly stateBoardOptions = signal<AutoCompleteOption<number>[]>([]);
  readonly professionalCourseOptions = signal<AutoCompleteOption<number>[]>([]);

  // Job sectors — single source of truth via the JobSectors service. The
  // service holds the cached fetch so the profile page and the engagement
  // dialog don't each hit the endpoint.
  readonly sectorOptions = this.jobSectors.sectorOptions;
  readonly jobRoleOptions = computed(() => this.jobSectors.rolesFor(this.profile().sector_id));

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
    effect(() => {
      const user = this.auth.currentUser();
      const sectors = this.jobSectors.sectors();
      if (!user || sectors.length === 0) return;
      untracked(() => {
        if (this.profile().sector_id != null) return;
        const ids = this.jobSectors.resolveIds(user.sector, user.job_role);
        if (ids.sector_id == null) return;
        this.profile.update((p) => ({ ...p, ...ids }));
      });
    });

    // Clear `job_role_id` when it stops being a valid option for the current
    // sector — i.e. user picked a new sector whose roles don't include the
    // previously-selected role, or cleared the sector entirely. Gated on the
    // sector list being loaded so the seeded role isn't wiped during the
    // initial render while options are still empty.
    effect(() => {
      const currentRoleId = this.profile().job_role_id;
      if (currentRoleId == null) return;
      if (this.jobSectors.sectors().length === 0) return;
      const validIds = this.jobRoleOptions().map((o) => o.value);
      if (validIds.includes(currentRoleId)) return;
      untracked(() => this.profile.update((p) => ({ ...p, job_role_id: null })));
    });
  }

  onCompanySearch(search: string) {
    this.companySearchQuery.set(search);
  }

  private async fetchStateBoards() {
    const res = await firstValueFrom(
      this.http.get<StateBoardListResponse>(PROFILE_ROUTES.getStateBoardList.path),
    );
    if (res.data.length > 0) {
      this.stateBoardOptions.set(res.data.map((b) => ({ label: b.name, value: b.id })));
      // Now the name→id map exists, seed the user's saved boards (the API only
      // returns names). Skip if the user has already selected something.
      const ids = this.resolveStateBoardIds(this.auth.currentUser()?.state_board_name);
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
    const res = await firstValueFrom(
      this.http.get<ProfessionalCourseListResponse>(PROFILE_ROUTES.getProfessionalCourseList.path),
    );
    if (res.data.length > 0) {
      this.professionalCourseOptions.set(res.data.map((c) => ({ label: c.title, value: c.id })));
    }
  }

  // ponytail: two list endpoints with the same shape; left separate — a shared
  // helper only earns its keep at a third caller (different response types + map
  // shapes make the generic awkward today).

  readonly cpaStatusOptions: AutoCompleteOption[] = [
    { label: 'Yes', value: 'yes' },
    { label: 'No', value: 'no' },
    { label: 'NA', value: 'na' },
  ];

  // Granularity (city vs state vs country) is the backend's call — it owns the
  // Places request. Whatever it returns ends in the country, so the "country is
  // mandatory" requirement is satisfied implicitly.
  readonly locationQuery = signal('');
  readonly locationOptions = placeSuggestions(
    this.locationQuery,
    computed(() => this.profile().location),
  );

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
    const initialValues: Partial<ProfileFormState> = user
      ? {
          ...this.mapUserToForm(user),
          state_board: this.resolveStateBoardIds(user.state_board_name),
          ...this.jobSectors.resolveIds(user.sector, user.job_role),
        }
      : ({} as ProfileFormState);

    const payload: Partial<ProfileFormState> = {};

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

    try {
      const res = await firstValueFrom(
        this.http.patch<SaveProfileResponse>(PROFILE_ROUTES.saveProfile.path, payload),
      );

      if (res.status) {
        const wasComplete = this.auth.currentUser()?.is_profile_completed === true;
        // Capture new-vs-existing BEFORE setAuthenticated swaps in the refreshed
        // user, so the lifecycle branch below reflects the pre-save state.
        const wasNewUser = !this.auth.currentUser()?.is_existing_user;
        this.auth.setAuthenticated(res.user);
        // Activation milestone — fire only on the first false→true transition.
        if (
          !wasComplete &&
          (res.user as { is_profile_completed?: boolean })?.is_profile_completed
        ) {
          this.analytics.trackEvent('profile_completed');
        }
        // CPE-parity GA4 lifecycle: a new user's first profile completion =
        // `onboarding`; any later save by an existing user = `profile_update`.
        if (wasNewUser) {
          this.analytics.trackOnboarding(res.user, this.auth.currentPlan());
        } else {
          this.analytics.trackProfileUpdate(res.user, this.auth.currentPlan());
        }
        this.notification.success('Profile', 'Profile saved successfully');
        this.isSaving.set(true);

        const redirect = this.route.snapshot.queryParams['redirect'];
        await this.router.navigateByUrl(redirect || '/');
      }
    } catch (error: unknown) {
      this.logger.error('Failed to save profile', error);
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
