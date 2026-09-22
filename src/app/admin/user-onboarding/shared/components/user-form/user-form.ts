import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { FormField as AngularFormField, form, required, validate } from '@angular/forms/signals';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { AriaAutocomplete } from '@shared/components/ui/aria/aria-autocomplete/aria-autocomplete';
import { AriaInput } from '@shared/components/ui/aria/aria-input/aria-input';
import { AriaMultiselect } from '@shared/components/ui/aria/aria-multiselect/aria-multiselect';
import { AriaSelect } from '@shared/components/ui/aria/aria-select/aria-select';
import { Button } from '@shared/components/ui/button/button';
import { Forms } from '@shared/components/ui/forms/forms';
import { AriaSelectOption } from '@core/models/aria.model';
import { dialCodeWithLength } from '@core/constants/dial-code';
import { placeSuggestions } from '@core/services/location-autocomplete/location-autocomplete';
import { InternalUser, OnboardUserPayload } from '../../models/user-onboarding.model';
import { UserOnboardingFacade } from '../../services/user-onboarding-facade';

interface UserFormModel {
  email: string;
  first_name: string;
  last_name: string;
  country_code: string;
  mobile: string;
  location: string;
  partner_code: string | null;
  profession: number | null;
  professional_courses: number[];
  state_board: number[];
  qualification_status: string | null;
  license_status: string | null;
  is_currently_working: boolean;
  terms_accepted: boolean;
  sms_consent: boolean;
  company_id: number | null;
  sector_id: number | null;
  job_role_id: number | null;
  experience_id: number | null;
}

// Backend choice fields (User.QUALIFICATION_CHOICES / LICENSE_CHOICES): the
// values below are the ones the onboard endpoint accepts — `not_licensed` is not
// one of them and 400s.
const QUALIFICATION_OPTIONS: AriaSelectOption<string>[] = [
  { value: 'completed', label: 'Completed' },
  { value: 'pursuing', label: 'Pursuing' },
  { value: 'na', label: 'Not applicable' },
];
const LICENSE_OPTIONS: AriaSelectOption<string>[] = [
  { value: 'licensed', label: 'Licensed' },
  { value: 'awaiting', label: 'Awaiting license' },
  { value: 'na', label: 'Not applicable' },
];
/** Mirrors the backend's fixed `EXPERIENCE_MAP` — there is no table to fetch. */
const EXPERIENCE_OPTIONS: AriaSelectOption<number>[] = [
  { value: 1, label: '0 – 2 years' },
  { value: 2, label: '2 – 5 years' },
  { value: 3, label: '5 – 10 years' },
  { value: 4, label: 'Above 10 years' },
];

/** Case-insensitive label → option value; the list API returns names, not ids. */
function byLabel<T>(options: readonly AriaSelectOption<T>[], label: string | null): T | null {
  if (!label) return null;
  const needle = label.trim().toLowerCase();
  return options.find((o) => o.label.trim().toLowerCase() === needle)?.value ?? null;
}

/**
 * Full-page create / edit form for onboarding a learner user. One component for
 * both `/new` and `/:id/edit` — edit prefills from the list row passed via router
 * state (no get-by-id endpoint exists). Shares the route-scoped facade with the
 * list, so reference data is already loading.
 */
@Component({
  selector: 'app-user-form',
  imports: [
    AngularFormField,
    Forms,
    AriaInput,
    AriaSelect,
    AriaMultiselect,
    AriaAutocomplete,
    Button,
  ],
  templateUrl: './user-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block w-full' },
})
export class UserForm {
  protected readonly facade = inject(UserOnboardingFacade);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly idParam = this.route.snapshot.paramMap.get('id');
  protected readonly isEdit = this.idParam != null;
  private readonly userId = this.idParam ? Number(this.idParam) : null;

  protected readonly title = this.isEdit ? 'Edit user' : 'Create user';
  protected readonly saving = signal(false);
  /** Cold deep-link to /:id/edit with no row in router state — can't prefill. */
  protected readonly missingUser = signal(false);

  protected readonly qualificationOptions = QUALIFICATION_OPTIONS;
  protected readonly licenseOptions = LICENSE_OPTIONS;
  protected readonly experienceOptions = EXPERIENCE_OPTIONS;
  /** Country-code picker fed by the same dial-code constant the profile page uses. */
  protected readonly countryCodeOptions: AriaSelectOption<string>[] = dialCodeWithLength.map(
    (c) => ({
      value: (c.CountryCode ?? '').toString(),
      label: `${c.country} (${c.CountryCode})`,
    }),
  );

  private readonly model = signal<UserFormModel>({
    email: '',
    first_name: '',
    last_name: '',
    country_code: '',
    mobile: '',
    location: '',
    partner_code: null,
    profession: null,
    professional_courses: [],
    state_board: [],
    qualification_status: '',
    license_status: null,
    is_currently_working: false,
    // The API defaults terms_accepted to true on create; an unticked box is a deliberate "no".
    terms_accepted: true,
    sms_consent: false,
    company_id: null,
    sector_id: null,
    job_role_id: null,
    experience_id: null,
  });

  protected readonly form = form<UserFormModel>(this.model, (s) => {
    required(s.email, { message: 'Email is required' });
    validate(s.email, ({ value }) =>
      !value() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value())
        ? null
        : { kind: 'email', message: 'Enter a valid email' },
    );
    // ponytail: email is the only mandatory field — everything else is optional.
  });

  /** Job roles for the currently selected sector — one job-sectors call feeds both. */
  protected readonly roleOptions = computed(() => this.facade.rolesFor(this.model().sector_id));

  // Debounced company typeahead query.
  private readonly companyQueryInput = signal('');

  /** Google-Places-backed location picker — same helper the profile page uses. */
  protected readonly locationQuery = signal('');
  protected readonly locationOptions = placeSuggestions(
    this.locationQuery,
    computed(() => this.model().location),
  );

  /** The list row being edited — names only, resolved to ids once the reference lists load. */
  private readonly prefillRow = signal<InternalUser | null>(null);

  constructor() {
    this.prefillFromRow();

    // The list returns names, the form needs ids: resolve each FK by label as
    // soon as its option list arrives, and only fill fields still blank so an
    // operator's edit is never overwritten by a late-arriving list.
    effect(() => {
      const row = this.prefillRow();
      if (!row) return;
      const professions = this.facade.professionOptions();
      const courses = this.facade.courseOptions();
      const boards = this.facade.stateBoardOptions();
      const sectors = this.facade.sectorOptions();
      const companies = this.facade.companyOptions();
      untracked(() => {
        this.model.update((m) => ({
          ...m,
          profession: m.profession ?? byLabel(professions, row.profession),
          professional_courses: m.professional_courses.length
            ? m.professional_courses
            : row.professional_courses.flatMap((name) => {
                const id = byLabel(courses, name);
                return id == null ? [] : [id];
              }),
          state_board: m.state_board.length
            ? m.state_board
            : row.state_board.flatMap((name) => {
                const id = byLabel(boards, name);
                return id == null ? [] : [id];
              }),
          sector_id: m.sector_id ?? byLabel(sectors, row.sector),
          company_id: m.company_id ?? byLabel(companies, row.company),
        }));
        const m = this.model();
        if (m.job_role_id == null && m.sector_id != null) {
          const roleId = byLabel(this.facade.rolesFor(m.sector_id), row.job_role);
          if (roleId != null) this.model.update((x) => ({ ...x, job_role_id: roleId }));
        }
      });
    });

    toObservable(this.companyQueryInput)
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((q) => this.facade.setCompanyQuery(q));

    // Default the partner code to the Creator plan on create, once codes load.
    effect(() => {
      const def = this.facade.defaultPartnerCode();
      untracked(() => {
        if (this.isEdit || this.model().partner_code || !def) return;
        this.model.update((m) => ({ ...m, partner_code: def }));
      });
    });

    // Clear the job role when the sector changes to one that doesn't offer it.
    const selectedSector = computed(() => this.model().sector_id);
    effect(() => {
      selectedSector();
      untracked(() => {
        const role = this.model().job_role_id;
        if (role == null) return;
        if (!this.roleOptions().some((r) => r.value === role)) {
          this.model.update((m) => ({ ...m, job_role_id: null }));
        }
      });
    });
  }

  private stateUser(): InternalUser | null {
    if (!this.isBrowser) return null;
    return (history.state as { user?: InternalUser })?.user ?? null;
  }

  private prefillFromRow(): void {
    if (!this.isEdit || this.userId == null) return;
    const row = this.stateUser() ?? this.facade.findLoadedUser(this.userId);
    if (!row) {
      this.missingUser.set(true);
      return;
    }
    this.model.set({
      email: row.email ?? '',
      first_name: row.first_name ?? '',
      last_name: row.last_name ?? '',
      country_code: row.country_code ?? '',
      mobile: row.mobile ?? '',
      location: row.location ?? '',
      partner_code: row.partner_code ?? null,
      // FKs arrive as names — the constructor effect resolves them to ids.
      profession: null,
      professional_courses: [],
      state_board: [],
      qualification_status: row.qualification_status ?? '',
      license_status: row.license_status ?? '',
      is_currently_working: row.is_currently_working ?? false,
      terms_accepted: row.terms_accepted ?? false,
      sms_consent: row.sms_consent ?? false,
      company_id: null,
      sector_id: null,
      job_role_id: null,
      // Not in the list response — backend ask.
      experience_id: null,
    });
    // The company typeahead is server-filtered: seed the query so the row's
    // company is in the option list the effect resolves against.
    if (row.company) this.facade.setCompanyQuery(row.company);
    this.prefillRow.set(row);
  }

  protected onCompanyQuery(query: string): void {
    this.companyQueryInput.set(query);
  }

  private buildPayload(): OnboardUserPayload {
    const m = this.model();
    // Checkboxes always carry an answer — false is "no", not "left blank".
    const payload: Record<string, unknown> = {
      email: m.email.trim(),
      is_currently_working: m.is_currently_working,
      terms_accepted: m.terms_accepted,
      sms_consent: m.sms_consent,
    };
    const optional: Record<string, unknown> = {
      first_name: m.first_name.trim(),
      last_name: m.last_name.trim(),
      mobile: m.mobile.trim(),
      country_code: m.country_code.trim(),
      location: m.location.trim(),
      partner_code: m.partner_code,
      profession: m.profession,
      professional_courses: m.professional_courses,
      state_board: m.state_board,
      qualification_status: m.qualification_status,
      license_status: m.license_status,
      company_id: m.company_id,
      sector_id: m.sector_id,
      job_role_id: m.job_role_id,
      experience_id: m.experience_id,
    };
    // Send only what was filled — blanks are omitted rather than sent as ''/null.
    for (const [key, value] of Object.entries(optional)) {
      if (value == null || value === '' || (Array.isArray(value) && !value.length)) continue;
      payload[key] = value;
    }
    return payload as unknown as OnboardUserPayload;
  }

  protected async submit(): Promise<void> {
    if (this.form().invalid() || this.saving()) return;
    this.saving.set(true);
    const payload = this.buildPayload();
    const ok =
      this.isEdit && this.userId != null
        ? await this.facade.updateUser({ ...payload, user_id: this.userId })
        : await this.facade.createUser(payload);
    this.saving.set(false);
    if (ok) this.cancel();
  }

  protected cancel(): void {
    // Relative to the componentless list parent, so the form works from both
    // /admin/user-onboarding (v1) and /admin/partner-v2/superadmin/onboarding (v2).
    void this.router.navigate(['.'], { relativeTo: this.route.parent });
  }
}
