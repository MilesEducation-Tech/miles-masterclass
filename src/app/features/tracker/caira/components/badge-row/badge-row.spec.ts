import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiUrl } from '@core/services/api-client/api-client';
import { Utils } from '@shared/services/utils';
import { BadgeActions } from '../../services/badge-actions';
import { BadgeRow } from './badge-row';

describe('BadgeRow', () => {
  let fixture: ComponentFixture<BadgeRow>;
  let http: HttpTestingController;

  const create = (courseType: string) => {
    fixture = TestBed.createComponent(BadgeRow);
    fixture.componentRef.setInput('heading', 'Badges');
    fixture.componentRef.setInput('courseType', courseType);
    fixture.componentRef.setInput('viewAllLink', 'course-badges');
    fixture.detectChanges();
  };
  const heading = () => fixture.nativeElement.textContent.includes('Badges');

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [BadgeRow],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Utils, useValue: { country: () => 'us', profession: () => 'cpa' } },
        { provide: BadgeActions, useValue: { run: vi.fn() } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('reads course badges for its course type', async () => {
    create('podcast');
    const req = http.expectOne((r) => r.url === apiUrl('v2/course-badges/'));
    expect(req.request.params.get('course_type')).toBe('podcast');
    req.flush({ data: [] });
    await fixture.whenStable();
  });

  it('reads the webinar endpoint for the webinar row, with no params', async () => {
    create('webinar');
    const req = http.expectOne(apiUrl('v2/webinar-badges/'));
    expect(req.request.params.keys()).toEqual([]);
    req.flush({ data: [] });
    await fixture.whenStable();
  });

  it('hides the whole row when the fetch fails, instead of throwing', async () => {
    create('masterclass');
    http
      .expectOne((r) => r.url === apiUrl('v2/course-badges/'))
      .flush(null, { status: 500, statusText: 'Boom' });
    await fixture.whenStable();

    expect(() => fixture.detectChanges()).not.toThrow();
    expect(heading()).toBe(false);
  });
});
