import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, DeferBlockState, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiUrl } from '@core/services/api-client/api-client';
import { AuthSession } from '@core/services/auth-session/auth-session';
import { FeatureFacade } from '@core/services/feature-facade/feature-facade';
import { Logger } from '@core/services/logger/logger';
import { MASTERCLASS_ENDPOINTS } from '@features/offerings/masterclass/constants/masterclass';
import { Masterclass } from '@features/offerings/masterclass/pages/masterclass/masterclass';
import { MasterclassHomeFacade } from '@features/offerings/masterclass/services/masterclass-home-facade';
import {
  mockHomePageBody,
  mockMasterclassCourse,
  mockMasterclassTrack,
} from '@testing/mocks/masterclass-home.mock';

const HOME_URL = apiUrl(MASTERCLASS_ENDPOINTS.homePage);

describe('Masterclass page', () => {
  let fixture: ComponentFixture<Masterclass>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Masterclass],
      providers: [
        // Route-scoped in the app (`masterclass.routes.ts`), so provided here.
        MasterclassHomeFacade,
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthSession, useValue: { isAuthenticated: signal(false) } },
        // The hero still reads the legacy feed, which is not under test here; a
        // stub keeps its request from holding the fixture unstable forever.
        { provide: FeatureFacade, useValue: { getResource: () => ({ items: signal([]) }) } },
        { provide: Logger, useValue: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Masterclass);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  const el = () => fixture.nativeElement as HTMLElement;
  const headings = () => [...el().querySelectorAll('h2')].map((h) => h.textContent?.trim());

  async function flushHome(body: object | null, init?: { status: number; statusText: string }) {
    // A retry's request goes out when effects run, so let them run first.
    TestBed.tick();
    http.expectOne((r) => r.url === HOME_URL).flush(body, init);
    await fixture.whenStable();
  }

  /** Every rail waits for the viewport (the hero is above them); play them through. */
  async function renderRails() {
    for (const block of await fixture.getDeferBlocks()) {
      await block.render(DeferBlockState.Complete);
    }
  }

  it('renders one rail per track that has courses, in API order', async () => {
    await flushHome(
      mockHomePageBody([
        mockMasterclassTrack('a', [mockMasterclassCourse('c1')], { name: 'AI Mindset' }),
        mockMasterclassTrack('b', [], { name: 'Human Skills' }),
        mockMasterclassTrack('c', [mockMasterclassCourse('c2')], { name: 'Firm-Wide' }),
      ]),
    );
    await renderRails();

    expect(headings()).toEqual(expect.arrayContaining(['AI Mindset', 'Firm-Wide']));
    expect(headings()).not.toContain('Human Skills');
    expect(headings().indexOf('AI Mindset')).toBeLessThan(headings().indexOf('Firm-Wide'));
  });

  it('shows the track description under its heading', async () => {
    await flushHome(
      mockHomePageBody([
        mockMasterclassTrack('a', [mockMasterclassCourse('c1')], {
          description: 'Build fluency with the Microsoft AI stack',
        }),
      ]),
    );
    await renderRails();

    expect(el().textContent).toContain('Build fluency with the Microsoft AI stack');
  });

  it('keeps the hero section above the tracks, unchanged', () => {
    const hero = el().querySelector('#masterclass-home');
    const tracks = el().querySelector('#masterclass-tracks');

    expect(hero?.querySelector('app-slider, app-slider-skeleton')).toBeTruthy();
    expect(hero && tracks && hero.compareDocumentPosition(tracks)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('keeps a single tracks section (no duplicate ids)', async () => {
    await flushHome(
      mockHomePageBody([
        mockMasterclassTrack('a', [mockMasterclassCourse('c1')]),
        mockMasterclassTrack('b', [mockMasterclassCourse('c2')]),
      ]),
    );

    expect(el().querySelectorAll('#masterclass-tracks')).toHaveLength(1);
  });

  it('shows an error with a retry that asks again', async () => {
    await flushHome(null, { status: 500, statusText: 'Server Error' });

    const alert = el().querySelector('[role="alert"]');
    expect(alert?.textContent).toContain("We couldn't load the masterclasses");

    alert?.querySelector('button')?.click();
    await flushHome(mockHomePageBody([mockMasterclassTrack('a', [mockMasterclassCourse('c1')])]));
    await renderRails();

    expect(el().querySelector('[role="alert"]')).toBeNull();
    expect(headings()).toContain('Track a');
  });
});
