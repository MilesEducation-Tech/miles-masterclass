import { Service, Signal, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of, shareReplay } from 'rxjs';
import { ApiClient } from '../api-client/api-client';
import { Logger } from '../logger/logger';
import { JobRole, JobSector, PROFILE_ROUTES } from '../../models/profile.model';
import { CommonResponse } from '../../models/http.model';
import { AutoCompleteOption } from '../../models/form.model';

/**
 * Single source of truth for the `user/job-sectors/` list (sectors with
 * nested roles). The endpoint is fetched exactly once per app instance —
 * subsequent consumers (profile page, profile-completion dialog, anything
 * future) share the same cached signal.
 *
 * Lazy: HTTP fires the first time something injects the service. `shareReplay`
 * keeps the result alive across multiple `toSignal` subscriptions inside the
 * service itself; the outer `toSignal` then exposes a synchronous read.
 */
@Service()
export class JobSectors {
  private readonly http = inject(ApiClient);
  private readonly logger = inject(Logger);

  readonly sectors: Signal<JobSector[]> = toSignal(
    this.http.get<CommonResponse<JobSector[]>>(PROFILE_ROUTES.getJobSectorList.path).pipe(
      map((res) => res?.data ?? []),
      catchError((err) => {
        this.logger.error('Failed to load job sectors', err);
        return of<JobSector[]>([]);
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    ),
    { initialValue: [] as JobSector[] },
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
