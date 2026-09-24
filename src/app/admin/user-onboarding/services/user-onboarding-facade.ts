import { HttpContext } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import {
  computed,
  effect,
  inject,
  Service,
  linkedSignal,
  PLATFORM_ID,
  resource,
  signal,
  untracked,
} from '@angular/core';
import { firstValueFrom, fromEvent, takeUntil } from 'rxjs';
import { AriaSelectOption } from '@core/models/aria.model';
import { RequestOptions, SKIP_AUTH_TOKEN } from '@core/models/http.model';
import {
  adminContext,
  PartnerCode,
  PartnerCodesResponse,
  partnerErrorMessage,
  partnerLoadError,
} from '@admin/core/models/partner-platform.model';
import {
  CompanyList,
  JobSector,
  ProfessionList,
  ProfessionalCourseList,
  StateBoardList,
} from '@core/models/profile.model';
import { ApiClient } from '@core/services/api-client/api-client';
import { Logger } from '@core/services/logger/logger';
import { NotificationService } from '@core/services/notification/notification';
import { withPreviousValue } from '@shared/utils/with-previous-value';
import {
  InternalUser,
  MutateUserResponse,
  OfflinePaymentResponse,
  OfflinePaymentResult,
  OnboardUserPayload,
  UpdateUserPayload,
  UsersListResponse,
} from '@admin/user-onboarding/models/user-onboarding.model';

const SUPERADMIN_USERS = 'partners/superadmin/users/';
const offlinePaymentUrl = (userId: number) => `${SUPERADMIN_USERS}${userId}/offline-payment/`;

/**
 * Owns every Django call for the admin "User Onboarding" section.
 *
 * Two auth modes, deliberately:
 *   - The user CRUD lives under `partners/superadmin/users/` and authenticates
 *     with the Supabase admin token via `adminContext()`. It replaced an
 *     `internal/*` surface guarded by an `X-Internal-Api-Key` that shipped in
 *     the JS bundle — a shared secret readable by anyone who opened devtools.
 *     Do not reintroduce a bundled key here.
 *   - The reference dropdowns (professions, courses, state boards, sectors,
 *     companies) are public endpoints shared with the signup flow, so they send
 *     no credential at all.
 *
 * Paths are relative — `ApiClient` resolves them against `BASE_API_URL`.
 *
 * Route-scoped (provided on the `user-onboarding` parent route) so the list and
 * the create/edit form share one instance — reference data is fetched once.
 */
@Service({ autoProvided: false })
export class UserOnboardingFacade {
  private readonly api = inject(ApiClient);
  private readonly notification = inject(NotificationService);
  private readonly logger = inject(Logger);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Admin-authenticated call: Supabase bearer token. Fresh context per call. */
  private opts(extra?: Partial<RequestOptions>): RequestOptions {
    return { context: adminContext(), ...extra };
  }

  /** Public reference data — no token, no key. */
  private publicOpts(extra?: Partial<RequestOptions>): RequestOptions {
    return { context: new HttpContext().set(SKIP_AUTH_TOKEN, true), ...extra };
  }

  /** Generic reference-list loader (relative → `BASE_API_URL`) — we only read `.data`. */
  private list<T>(path: string) {
    return resource({
      params: () => (this.isBrowser ? { path } : undefined),
      loader: ({ abortSignal }) =>
        firstValueFrom(
          this.api
            .get<{ data: T[] }>(path, this.publicOpts())
            .pipe(takeUntil(fromEvent(abortSignal, 'abort'))),
          { defaultValue: { data: [] as T[] } },
        ).then((r) => r?.data ?? []),
    });
  }

  // ---- Users list ----------------------------------------------------------

  readonly searchTerm = signal('');
  /** Comma-separated email domains, e.g. "acme.com,other.com". Empty = all. */
  readonly domainFilter = signal('');
  readonly pageNumber = signal(1);
  readonly pageSize = 30;

  private readonly rawUsersResource = resource({
    params: () => {
      if (!this.isBrowser) return undefined;
      return { page: this.pageNumber(), search: this.searchTerm(), domain: this.domainFilter() };
    },
    loader: ({ params, abortSignal }) => {
      const httpParams: Record<string, string | number> = {
        page: params.page,
        page_size: this.pageSize,
      };
      if (params.search) httpParams['search'] = params.search;
      if (params.domain) httpParams['domain'] = params.domain;
      return firstValueFrom(
        this.api
          .get<UsersListResponse>(SUPERADMIN_USERS, this.opts({ params: httpParams }))
          .pipe(takeUntil(fromEvent(abortSignal, 'abort'))),
        { defaultValue: { data: [] } as UsersListResponse },
      );
    },
  });

  private readonly usersResource = withPreviousValue(this.rawUsersResource);

  readonly users = linkedSignal({
    source: this.usersResource.snapshot,
    computation: (snap, previous): InternalUser[] => {
      if (snap.status !== 'resolved') return previous?.value ?? [];
      return snap.value?.data ?? [];
    },
  });

  readonly pagination = computed(() => this.usersResource.value()?.pagination_data);
  readonly isLoading = computed(() => this.usersResource.isLoading());
  /** Backend `message` when the load failed, else null — the banner renders it verbatim. */
  readonly error = computed(() =>
    partnerLoadError(this.usersResource.error(), 'Failed to load users.'),
  );

  constructor() {
    // A search on page 3 with a different filter set would otherwise load stale rows.
    effect(() => {
      this.searchTerm();
      this.domainFilter();
      untracked(() => {
        if (this.pageNumber() !== 1) this.pageNumber.set(1);
      });
    });
  }

  setSearch(value: string): void {
    this.searchTerm.set(value.trim());
  }

  setDomainFilter(value: string): void {
    // Normalise "acme.com, other.com" → "acme.com,other.com".
    this.domainFilter.set(
      value
        .split(',')
        .map((d) => d.trim())
        .filter(Boolean)
        .join(','),
    );
  }

  setPage(page: number): void {
    if (page >= 1) this.pageNumber.set(page);
  }

  reload(): void {
    this.rawUsersResource.reload();
  }

  /** Prefill source for the edit form — the list row is passed via router state;
   *  this is the cold-deep-link fallback (only finds users on the loaded page). */
  findLoadedUser(id: number): InternalUser | null {
    return this.users().find((u) => u.id === id) ?? null;
  }

  // ---- Partner codes (+ Creator default) -----------------------------------

  private readonly partnerCodesResource = resource({
    params: () => (this.isBrowser ? {} : undefined),
    loader: ({ abortSignal }) =>
      firstValueFrom(
        this.api
          .get<PartnerCodesResponse>('partners/superadmin/partner-codes/', this.opts())
          .pipe(takeUntil(fromEvent(abortSignal, 'abort'))),
        { defaultValue: { partner_codes: [] } as PartnerCodesResponse },
      ).then((r) => r?.partner_codes ?? []),
  });

  readonly partnerCodes = computed<PartnerCode[]>(() => this.partnerCodesResource.value() ?? []);

  readonly partnerCodeOptions = computed<AriaSelectOption<string>[]>(() =>
    this.partnerCodes()
      .filter((c) => c.is_active)
      .map((c) => ({
        value: c.code,
        label: c.description ? `${c.code} — ${c.description}` : c.code,
      })),
  );

  /** Re-fetch the codes — the apply dialog opens on a fresh list. */
  reloadPartnerCodes(): void {
    this.partnerCodesResource.reload();
  }

  /** Apply a partner code to a user from the list (a one-field update-user PATCH). */
  applyPartnerCode(user: InternalUser, code: string): Promise<boolean> {
    return this.updateUser({ user_id: user.id, email: user.email, partner_code: code });
  }

  /**
   * The partner code representing the "Creator" plan — pre-selected in the create
   * form. Heuristic match on code/description; TODO(open dep): confirm the exact
   * code that maps to the Creator plan.
   */
  readonly defaultPartnerCode = computed<string | null>(() => {
    const match = this.partnerCodes().find(
      (c) => c.is_active && /creator/i.test(`${c.code} ${c.description ?? ''}`),
    );
    return match?.code ?? null;
  });

  // ---- Reference dropdowns -------------------------------------------------

  private readonly professionsRes = this.list<ProfessionList>('professions/');
  readonly professionOptions = computed<AriaSelectOption<number>[]>(() =>
    (this.professionsRes.value() ?? []).map((p) => ({ value: p.id, label: p.name })),
  );

  private readonly coursesRes = this.list<ProfessionalCourseList>('user/professional-course/');
  readonly courseOptions = computed<AriaSelectOption<number>[]>(() =>
    (this.coursesRes.value() ?? []).map((c) => ({ value: c.id, label: c.title })),
  );

  private readonly stateBoardsRes = this.list<StateBoardList>('user/state-boards/');
  readonly stateBoardOptions = computed<AriaSelectOption<number>[]>(() =>
    (this.stateBoardsRes.value() ?? []).map((s) => ({ value: s.id, label: s.name })),
  );

  private readonly jobSectorsRes = this.list<JobSector>('user/job-sectors/');
  readonly jobSectors = computed<JobSector[]>(() => this.jobSectorsRes.value() ?? []);
  readonly sectorOptions = computed<AriaSelectOption<number>[]>(() =>
    this.jobSectors().map((s) => ({ value: s.id, label: s.name })),
  );

  /** Roles nested under the selected sector — one job-sectors call gives both. */
  rolesFor(sectorId: number | null): AriaSelectOption<number>[] {
    if (sectorId == null) return [];
    const sector = this.jobSectors().find((s) => s.id === sectorId);
    return (sector?.roles ?? []).map((r) => ({ value: r.id, label: r.name }));
  }

  // ---- Company typeahead ---------------------------------------------------

  readonly companyQuery = signal('');

  private readonly companiesRes = resource({
    params: () => (this.isBrowser ? { search: this.companyQuery() } : undefined),
    loader: ({ params, abortSignal }) =>
      firstValueFrom(
        this.api
          .get<{ data: CompanyList[] }>(
            'user/companies/',
            this.opts({ params: { search: params.search } }),
          )
          .pipe(takeUntil(fromEvent(abortSignal, 'abort'))),
        { defaultValue: { data: [] as CompanyList[] } },
      ).then((r) => r?.data ?? []),
  });

  readonly companyOptions = computed<AriaSelectOption<number>[]>(() =>
    (this.companiesRes.value() ?? []).map((c) => ({ value: c.id, label: c.company_name })),
  );

  setCompanyQuery(query: string): void {
    this.companyQuery.set(query);
  }

  // ---- Mutations -----------------------------------------------------------

  async createUser(payload: OnboardUserPayload): Promise<boolean> {
    try {
      const res = await firstValueFrom(
        this.api.post<MutateUserResponse>(SUPERADMIN_USERS, payload, this.opts()),
      );
      if (!res?.status) {
        this.notification.error(
          'Create failed',
          res?.message ?? 'The backend rejected the request.',
        );
        return false;
      }
      this.notification.success('User created', res.message || `${payload.email} was onboarded.`);
      this.reload();
      return true;
    } catch (err) {
      this.logger.error('[UserOnboardingFacade] createUser failed', err);
      // 409 "email exists" / 400 "invalid partner code" live on err.error, not err.message.
      this.notification.error('Create failed', partnerErrorMessage(err));
      return false;
    }
  }

  async updateUser(payload: UpdateUserPayload): Promise<boolean> {
    try {
      const res = await firstValueFrom(
        this.api.patch<MutateUserResponse>(SUPERADMIN_USERS, payload, this.opts()),
      );
      if (!res?.status) {
        this.notification.error(
          'Update failed',
          res?.message ?? 'The backend rejected the request.',
        );
        return false;
      }
      this.notification.success('User updated', res.message || `${payload.email} was updated.`);
      this.reload();
      return true;
    } catch (err) {
      this.logger.error('[UserOnboardingFacade] updateUser failed', err);
      this.notification.error('Update failed', partnerErrorMessage(err));
      return false;
    }
  }

  /**
   * Record an offline payment (multipart) — activates the user's subscription.
   *
   * Proof is an invoice file, a free-text comment, or both; **at least one is
   * required**, so an activation is never left unexplained. EXACTLY one — the
   * API rejects both together as well as neither. The dialog enforces this, and
   * the guards below repeat it so no caller can bypass them.
   */
  async recordOfflinePayment(
    userId: number,
    invoice: File | null,
    comment = '',
  ): Promise<OfflinePaymentResult | null> {
    const trimmed = comment.trim();
    if (!invoice && !trimmed) {
      this.notification.error('Payment failed', 'Attach an invoice or add a comment.');
      return null;
    }
    if (invoice && trimmed) {
      this.notification.error(
        'Payment failed',
        'Send an invoice or a comment, not both — the invoice is the proof when there is one.',
      );
      return null;
    }

    const formData = new FormData();
    // `user_id` is in the path now, not the body.
    if (invoice) formData.append('invoice', invoice);
    if (trimmed) formData.append('comment', trimmed);
    try {
      // No manual Content-Type: the browser sets the multipart boundary itself.
      const res = await firstValueFrom(
        this.api.post<OfflinePaymentResponse>(offlinePaymentUrl(userId), formData, this.opts()),
      );
      if (!res?.status || !res.data) {
        this.notification.error(
          'Payment failed',
          res?.message ?? 'The backend rejected the payment record.',
        );
        return null;
      }
      // "Invoice updated." / "Note recorded." / "Free access recorded." — the
      // backend says which branch ran (already subscribed vs. grant).
      this.notification.success(
        res.message || 'Payment recorded',
        `Subscription ${res.data.subscription_status}.`,
      );
      this.reload();
      return res.data;
    } catch (err) {
      this.logger.error('[UserOnboardingFacade] recordOfflinePayment failed', err);
      this.notification.error('Payment failed', partnerErrorMessage(err));
      return null;
    }
  }
}
