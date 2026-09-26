import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiUrl } from '@core/services/api-client/api-client';
import { Utils } from '@shared/services/utils';
import { BadgeActions } from '../../services/badge-actions';
import { WebinarBadges } from './webinar-badges';

const URL = apiUrl('v2/webinar-badges/');

describe('WebinarBadges', () => {
  let fixture: ComponentFixture<WebinarBadges>;
  let http: HttpTestingController;
  const view = () =>
    fixture.componentInstance as unknown as {
      hasError(): boolean;
      totalCount(): number;
      items(): unknown[];
    };

  beforeEach(() => {
    // jsdom has no IntersectionObserver; the page's infinite-scroll sentinel needs one.
    // Restored in afterEach: a global stub outlives the file otherwise.
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        observe = vi.fn();
        disconnect = vi.fn();
      },
    );
    TestBed.configureTestingModule({
      imports: [WebinarBadges],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Utils, useValue: { country: () => 'us', profession: () => 'cpa' } },
        { provide: BadgeActions, useValue: { run: vi.fn() } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(WebinarBadges);
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
    vi.unstubAllGlobals();
  });

  it('loads page 1 of the webinar badges', async () => {
    const req = http.expectOne((r) => r.url === URL);
    expect(req.request.params.get('page')).toBe('1');
    // No card rows: this pins the page's read, not the badge cards' rendering.
    req.flush({ data: [], pagination_data: { total_count: 12 } });
    await fixture.whenStable();

    expect(view().items()).toEqual([]);
    expect(view().totalCount()).toBe(12);
    expect(view().hasError()).toBe(false);
  });

  it('shows its error state when the load fails, instead of throwing', async () => {
    http.expectOne((r) => r.url === URL).flush(null, { status: 500, statusText: 'Boom' });
    await fixture.whenStable();

    expect(() => fixture.detectChanges()).not.toThrow();
    expect(view().hasError()).toBe(true);
    expect(view().totalCount()).toBe(0);
  });
});
