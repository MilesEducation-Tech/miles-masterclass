import { NgTemplateOutlet } from '@angular/common';
import { Component, contentChild, input, PLATFORM_ID, signal, TemplateRef } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import {
  ComponentFixture,
  DeferBlockFixture,
  DeferBlockState,
  TestBed,
} from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiUrl } from '@core/services/api-client/api-client';
import { AuthSession } from '@core/services/auth-session/auth-session';
import { FeatureFacade } from '@core/services/feature-facade/feature-facade';
import { Logger } from '@core/services/logger/logger';
import { Carousel } from '@shared/components/carousel/carousel';
import { Utils } from '@shared/services/utils';
import { MASTERCLASS_ENDPOINTS } from '@features/offerings/masterclass/constants/masterclass';
import { Masterclass } from '@features/offerings/masterclass/pages/masterclass/masterclass';
import {
  mockHomePageBody,
  mockMasterclassCourse,
  mockMasterclassTrack,
} from '@testing/mocks/masterclass-home.mock';

const HOME_URL = apiUrl(MASTERCLASS_ENDPOINTS.homePage);

/**
 * Stands in for `app-carousel`: renders the heading the page binds and the
 * page's card template once per course. The real one boots Swiper's custom
 * element, which cannot render in jsdom — and the rail is not under test here.
 */
@Component({
  selector: 'app-carousel',
  imports: [NgTemplateOutlet],
  template: `
    <h2>{{ heading()?.text }}</h2>
    <p>{{ heading()?.subText }}</p>
    @for (card of cards(); track $index) {
      <ng-container *ngTemplateOutlet="cardTemplate() ?? null; context: { $implicit: card }" />
    }
  `,
})
class CarouselStub {
  readonly cards = input.required<unknown[]>();
  readonly heading = input<{ text: string; subText?: string }>();
  readonly swiperConfig = input<unknown>();
  protected readonly cardTemplate = contentChild(TemplateRef);
}

describe('Masterclass page', () => {
  const isAuthenticated = signal(false);
  let fixture: ComponentFixture<Masterclass>;
  let http: HttpTestingController;
  let logError: ReturnType<typeof vi.fn>;

  async function setup({ platform = 'browser', signedIn = false } = {}) {
    isAuthenticated.set(signedIn);
    logError = vi.fn();
    TestBed.overrideComponent(Masterclass, {
      remove: { imports: [Carousel] },
      add: { imports: [CarouselStub] },
    });
    await TestBed.configureTestingModule({
      imports: [Masterclass],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PLATFORM_ID, useValue: platform },
        { provide: AuthSession, useValue: { isAuthenticated } },
        // The hero still reads the legacy feed, which is not under test here; a
        // stub keeps its request from holding the fixture unstable forever.
        { provide: FeatureFacade, useValue: { getResource: () => ({ items: signal([]) }) } },
        { provide: Logger, useValue: { error: logError, warn: vi.fn(), info: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Masterclass);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  }

  afterEach(() => http.verify());

  const el = () => fixture.nativeElement as HTMLElement;
  const headings = () => [...el().querySelectorAll('h2')].map((h) => h.textContent?.trim());

  /** The one `home-page/` request; a retry's goes out when effects run, so run them first. */
  function homeRequest() {
    TestBed.tick();
    return http.expectOne((r) => r.url === HOME_URL);
  }

  async function flushHome(body: object | null, init?: { status: number; statusText: string }) {
    homeRequest().flush(body, init);
    await fixture.whenStable();
  }

  /** Every rail waits for the viewport (the hero is above them); play them through. */
  async function renderDeferred(blocks?: DeferBlockFixture[]) {
    for (const block of blocks ?? (await fixture.getDeferBlocks())) {
      await block.render(DeferBlockState.Complete);
      await renderDeferred(await block.getDeferBlocks());
    }
  }

  describe('the home-page request', () => {
    it('asks for the pre_login page, with every course, when signed out', async () => {
      await setup();
      const req = homeRequest();

      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('login_type')).toBe('pre_login');
      // The API pages courses 6 at a time; 100 (its cap) brings them all.
      expect(req.request.params.get('tracks.courses.page_size')).toBe('100');
      // Strict route: any other query key is a 400.
      expect(req.request.params.keys()).toEqual(['login_type', 'tracks.courses.page_size']);
      req.flush(mockHomePageBody([]));
    });

    it('asks for the post_login page when signed in', async () => {
      await setup({ signedIn: true });

      const req = homeRequest();

      expect(req.request.params.get('login_type')).toBe('post_login');
      req.flush(mockHomePageBody([], 'post_login'));
    });

    it('refetches on sign-in and holds the rails while it does', async () => {
      await setup();
      await flushHome(
        mockHomePageBody([mockMasterclassTrack('t1', [mockMasterclassCourse('c1')])]),
      );
      await renderDeferred();
      expect(headings()).toContain('Track t1');

      isAuthenticated.set(true);
      const req = homeRequest();
      fixture.detectChanges();

      expect(req.request.params.get('login_type')).toBe('post_login');
      expect(headings()).toContain('Track t1');

      req.flush(
        mockHomePageBody([mockMasterclassTrack('t2', [mockMasterclassCourse('c2')])], 'post_login'),
      );
      await fixture.whenStable();
      await renderDeferred();

      expect(headings()).toContain('Track t2');
      expect(headings()).not.toContain('Track t1');
    });
  });

  describe('the tracks', () => {
    it('renders one rail per track that has courses, in API order', async () => {
      await setup();
      await flushHome(
        mockHomePageBody([
          mockMasterclassTrack('a', [mockMasterclassCourse('c1')], { name: 'AI Mindset' }),
          mockMasterclassTrack('b', [], { name: 'Human Skills' }),
          mockMasterclassTrack('c', [mockMasterclassCourse('c2')], { name: 'Firm-Wide' }),
        ]),
      );
      await renderDeferred();

      expect(headings()).toEqual(expect.arrayContaining(['AI Mindset', 'Firm-Wide']));
      expect(headings()).not.toContain('Human Skills');
      expect(headings().indexOf('AI Mindset')).toBeLessThan(headings().indexOf('Firm-Wide'));
    });

    it('shows the track description under its heading', async () => {
      await setup();
      await flushHome(
        mockHomePageBody([
          mockMasterclassTrack('a', [mockMasterclassCourse('c1')], {
            description: 'Build fluency with the Microsoft AI stack',
          }),
        ]),
      );
      await renderDeferred();

      expect(el().textContent).toContain('Build fluency with the Microsoft AI stack');
    });

    it('keeps the hero section above the tracks, unchanged', async () => {
      await setup();
      const hero = el().querySelector('#masterclass-home');
      const tracks = el().querySelector('#masterclass-tracks');

      expect(hero?.querySelector('app-slider, app-slider-skeleton')).toBeTruthy();
      expect(hero && tracks && hero.compareDocumentPosition(tracks)).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      );
      homeRequest().flush(mockHomePageBody([]));
    });

    it('keeps a single tracks section (no duplicate ids)', async () => {
      await setup();
      await flushHome(
        mockHomePageBody([
          mockMasterclassTrack('a', [mockMasterclassCourse('c1')]),
          mockMasterclassTrack('b', [mockMasterclassCourse('c2')]),
        ]),
      );

      expect(el().querySelectorAll('#masterclass-tracks')).toHaveLength(1);
    });

    it('opens the trailer in the shared video dialog', async () => {
      await setup();
      const openVideoDialog = vi
        .spyOn(TestBed.inject(Utils), 'openVideoDialog')
        .mockResolvedValue(undefined);
      const course = mockMasterclassCourse('c1');
      await flushHome(mockHomePageBody([mockMasterclassTrack('a', [course])]));
      await renderDeferred();

      const trailer = [...el().querySelectorAll('app-masterclass-course-card button')].find((b) =>
        b.textContent?.includes('Trailer'),
      );
      (trailer as HTMLButtonElement | undefined)?.click();

      expect(openVideoDialog).toHaveBeenCalledWith(course.trailer_url, course.title);
    });
  });

  describe('failures', () => {
    it('puts a body that breaks the contract into the error state and the log', async () => {
      await setup();
      await flushHome(
        mockHomePageBody([mockMasterclassTrack('t1', [mockMasterclassCourse('c1', { id: 7 })])]),
      );

      expect(el().querySelector('[role="alert"]')).toBeTruthy();
      expect(logError).toHaveBeenCalledWith(
        '[Masterclass] home-page load failed',
        expect.anything(),
      );
    });

    it('shows an error with a retry that asks again', async () => {
      await setup();
      await flushHome(null, { status: 500, statusText: 'Server Error' });

      const alert = el().querySelector('[role="alert"]');
      expect(alert?.textContent).toContain("We couldn't load the masterclasses");

      alert?.querySelector('button')?.click();
      await flushHome(mockHomePageBody([mockMasterclassTrack('a', [mockMasterclassCourse('c1')])]));
      await renderDeferred();

      expect(el().querySelector('[role="alert"]')).toBeNull();
      expect(headings()).toContain('Track a');
    });
  });

  describe('on the server', () => {
    it('fetches the anonymous page, for crawlers', async () => {
      await setup({ platform: 'server' });

      const req = homeRequest();

      expect(req.request.params.get('login_type')).toBe('pre_login');
      req.flush(mockHomePageBody([]));
    });

    it('skips the signed-in page: the token lives in the browser', async () => {
      await setup({ platform: 'server', signedIn: true });
      TestBed.tick();

      http.expectNone((r) => r.url === HOME_URL);
    });
  });
});
