import { httpResource } from '@angular/common/http';
import { Service, computed } from '@angular/core';
import { apiUrl } from '../api-client/api-client';
import { JobRole, JobSector, PROFILE_ROUTES } from '../../models/profile.model';
import { CommonResponse } from '../../models/http.model';
import { AutoCompleteOption } from '../../models/form.model';

/** Empty envelope, so `sectors()` is always a real array and callers need no guard. */
const EMPTY_SECTORS: CommonResponse<JobSector[]> = {
  data: [],
  status: false,
  message: '',
};

/**
 * Single source of truth for the `user/job-sectors/` list (sectors with
 * nested roles). One `httpResource`, so the endpoint is fetched once and every
 * consumer — profile page, profile-completion dialog, anything future — shares
 * the same cached signal.
 *
 * Three things worth knowing:
 *
 *  1. **No auth gate, deliberately.** Unlike `AccountApi`/`OnboardingApi`, this
 *     endpoint is not user-scoped, so the request function is unconditional and
 *     there is no `isAuthenticated()` check to add. Do not "fix" that by adding
 *     one — it would stop the list loading for signed-out visitors, who see it
 *     in the profile-completion dialog.
 *  2. **`defaultValue` AND a `hasValue()` guard — both are needed.** PROMPT.md
 *     §4.2 asks for a default on lists, which covers idle and loading; the guard
 *     covers the error state, where `value()` throws regardless of the default.
 *     See the note on `sectors` below.
 *  3. **The resource is public so callers can read `.isLoading()`/`.error()`.**
 *     The previous implementation swallowed failures into `[]` via `catchError`
 *     and a `Logger.error`, which left no way to tell "no sectors" from "the
 *     request failed". Nothing renders that distinction today, but the state is
 *     now there instead of discarded.
 *
 * Timing note: the old `toSignal` subscribed at field-initialiser time, so HTTP
 * fired the moment anything injected the service. A resource fetches once it is
 * first read by a reactive consumer instead. The only consumer reads
 * `sectorOptions()` straight from its template, so in practice this is the same
 * moment.
 */
@Service()
export class JobSectors {
  readonly sectorsResource = httpResource<CommonResponse<JobSector[]>>(
    () => apiUrl(PROFILE_ROUTES.getJobSectorList.path),
    { defaultValue: EMPTY_SECTORS },
  );

  /**
   * The sector list, or `[]` while loading and on failure.
   *
   * The `hasValue()` guard is NOT redundant with `defaultValue` — that was the one
   * real trap in this conversion. A `defaultValue` covers the idle and loading
   * states, but reading `value()` on a resource in its ERROR state still throws,
   * so without this guard a 500 on `user/job-sectors/` would throw inside the
   * profile-completion dialog's template. The old `catchError(() => of([]))`
   * returned an empty list instead, and that behaviour has to survive. This is
   * why `caira-level-stack` carries both a default and a guard too.
   */
  readonly sectors = computed<JobSector[]>(() =>
    this.sectorsResource.hasValue() ? (this.sectorsResource.value()?.data ?? []) : [],
  );

  /** Sector list shaped for `<app-autocomplete>`. */
  readonly sectorOptions = computed<AutoCompleteOption<number>[]>(() =>
    this.sectors().map((s) => ({ label: s.name, value: s.id })),
  );

  /** Roles for the given sector id, shaped for `<app-autocomplete>`. */
  rolesFor(sectorId: number | null): AutoCompleteOption<number>[] {
    if (sectorId == null) return [];
    const match = this.sectors().find((s) => s.id === sectorId);
    return (match?.roles ?? []).map((r: JobRole) => ({ label: r.name, value: r.id }));
  }

  /**
   * Resolve sector/role ids from the `User` payload. The API now returns
   * `{ id, name }` objects, so we read the ids directly. Falls back to a
   * name-based lookup if only a name string is available (defensive — older
   * payloads / cached responses).
   */
  resolveIds(
    sector: { id: number; name: string } | string | null | undefined,
    role: { id: number; name: string } | string | null | undefined,
  ): { sector_id: number | null; job_role_id: number | null } {
    if (!sector) return { sector_id: null, job_role_id: null };

    // Object form — trust the ids the API gave us.
    if (typeof sector === 'object') {
      return {
        sector_id: sector.id,
        job_role_id: role && typeof role === 'object' ? role.id : null,
      };
    }

    // String form (legacy) — look up by name.
    const sectorMatch = this.sectors().find((s) => s.name === sector);
    if (!sectorMatch) return { sector_id: null, job_role_id: null };
    const roleName = typeof role === 'string' ? role : null;
    const roleMatch = roleName ? sectorMatch.roles.find((r) => r.name === roleName) : null;
    return { sector_id: sectorMatch.id, job_role_id: roleMatch?.id ?? null };
  }
}
