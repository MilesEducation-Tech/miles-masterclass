import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { JobSector, PROFILE_ROUTES } from '../../models/profile.model';
import { JobSectors } from './job-sectors';

/**
 * Unlike `account-api.spec.ts` there is NO token-rotation test here, and that is
 * correct rather than an omission: `user/job-sectors/` is not user-scoped, so the
 * request function has no `isAuthenticated()` gate to re-fire on. Adding one
 * would stop the list loading for signed-out visitors, who see it in the
 * profile-completion dialog.
 *
 * Settle idiom, and it is NOT quite the one in `account-api.spec.ts`: touch the
 * read so the resource acquires a reactive consumer, `TestBed.tick()` to let the
 * request go out, flush it — and then `await ApplicationRef.whenStable()` before
 * asserting the VALUE. `TestBed.tick()` is synchronous and a resource applies its
 * response on a microtask, so a tick-only settle sees the `defaultValue` and
 * nothing else. `account-api.spec.ts` gets away with tick-only because it asserts
 * request counts and `hasValue() === false`, never a flushed value; proven here
 * with a throwaway probe before this spec was written.
 */
describe('JobSectors', () => {
  let backend: HttpTestingController;

  const SECTORS: JobSector[] = [
    { id: 1, name: 'Public Accounting', roles: [{ id: 11, name: 'Auditor' }] },
    { id: 2, name: 'Industry', roles: [] },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    backend = TestBed.inject(HttpTestingController);
  });

  // `match` on a path substring, not `expectOne(url)`: `apiUrl()` prepends BASE_API_URL.
  const matchSectors = () =>
    backend.match((r) => r.url.includes(PROFILE_ROUTES.getJobSectorList.path));

  const settle = () => TestBed.inject(ApplicationRef).whenStable();

  const load = async (data: JobSector[] = SECTORS) => {
    const service = TestBed.inject(JobSectors);
    void service.sectors();
    TestBed.tick();
    const reqs = matchSectors();
    expect(reqs).toHaveLength(1);
    expect(reqs[0].request.method).toBe('GET');
    reqs[0].flush({ data, status: true, message: '' });
    await settle();
    return service;
  };

  it('starts with an empty list and no request before anything reads it', () => {
    const service = TestBed.inject(JobSectors);
    expect(service.sectors()).toEqual([]);
    backend.expectNone(() => true);
  });

  it('fetches the sector list once and exposes it', async () => {
    const service = await load();
    expect(service.sectors()).toEqual(SECTORS);
    backend.verify();
  });

  it('does not re-fetch for a second reader', async () => {
    const service = await load();
    void service.sectorOptions();
    TestBed.tick();
    expect(matchSectors()).toHaveLength(0);
  });

  it('shapes sectors for the autocomplete', async () => {
    const service = await load();
    expect(service.sectorOptions()).toEqual([
      { label: 'Public Accounting', value: 1 },
      { label: 'Industry', value: 2 },
    ]);
  });

  it('returns the roles of the matching sector, and [] for an unknown or null id', async () => {
    const service = await load();
    expect(service.rolesFor(1)).toEqual([{ label: 'Auditor', value: 11 }]);
    expect(service.rolesFor(2)).toEqual([]);
    expect(service.rolesFor(999)).toEqual([]);
    expect(service.rolesFor(null)).toEqual([]);
  });

  /**
   * The `defaultValue` is what makes this safe. Reading `value()` on a resource
   * in its error state throws, so without a default every caller would need a
   * `hasValue()` guard — and `sectors()` would throw inside a template.
   */
  it('falls back to an empty list on failure instead of throwing', async () => {
    const service = TestBed.inject(JobSectors);
    void service.sectors();
    TestBed.tick();
    matchSectors()[0].flush({ message: 'boom' }, { status: 500, statusText: 'Server Error' });
    await settle();

    expect(service.sectors()).toEqual([]);
    expect(service.sectorOptions()).toEqual([]);
    // The failure is now observable, where the old catchError discarded it.
    expect(service.sectorsResource.error()).toBeTruthy();
  });

  it('resolves ids from the object payload, and by name for legacy strings', async () => {
    const service = await load();
    expect(
      service.resolveIds({ id: 1, name: 'Public Accounting' }, { id: 11, name: 'Auditor' }),
    ).toEqual({ sector_id: 1, job_role_id: 11 });
    expect(service.resolveIds('Public Accounting', 'Auditor')).toEqual({
      sector_id: 1,
      job_role_id: 11,
    });
    expect(service.resolveIds('Nope', 'Auditor')).toEqual({ sector_id: null, job_role_id: null });
    expect(service.resolveIds(null, null)).toEqual({ sector_id: null, job_role_id: null });
  });
});
