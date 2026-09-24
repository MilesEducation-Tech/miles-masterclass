import { HttpRequest, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SurroundCarousel } from './surround-carousel';
import { Content } from '@core/models/course.model';
import { ContentResponse } from '@core/models/track.model';
import { Utils } from '@shared/services/utils';

/**
 * These cover what decides whether a visitor sees anything and what they see:
 * the request, the mapping, the too-few-cards guard, and the fallback row.
 *
 * The WebGL engine is not exercised — `afterNextRender` does not run here and
 * jsdom has no WebGL context, so every test below takes exactly the path a
 * reduced-motion or mobile visitor takes. That is deliberate: it is the path
 * that has to survive without a GPU.
 *
 * Phase 9 note: this suite used to mock `ApiClient` and record its calls. The read
 * is an `httpResource` now, which goes through `HttpClient`/`HttpBackend` and never
 * touches `ApiClient` — that mock would have sat there observing nothing while every
 * assertion still passed. It is `HttpTestingController` now, and the endpoint
 * assertion is stronger for it: `match(() => true)` proves exactly ONE request was
 * made and that its URL and params are right, rather than trusting a predicate that
 * would quietly match zero.
 */

function row(id: number, overrides: Partial<Content> = {}): Content {
  return {
    id,
    title: `Lab ${id}`,
    thumbnail: `https://cdn.test/${id}-v.webp`,
    horizontal_thumbnail: `https://cdn.test/${id}-h.webp`,
    class_credits: 1,
    course_type: 'ai_lab',
    ...overrides,
  } as Content;
}

describe('SurroundCarousel', () => {
  /** Every request the component made, so the endpoint itself stays under test. */
  let requests: HttpRequest<unknown>[];

  async function render(rows: Content[]): Promise<ComponentFixture<SurroundCarousel>> {
    const response: ContentResponse = { status_code: 200, data: rows };

    await TestBed.configureTestingModule({
      imports: [SurroundCarousel],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: Utils,
          useValue: {
            country: () => 'us',
            profession: () => 'cpa',
            slugify: (text: string) => text.toLowerCase().replace(/\s+/g, '-'),
            navigateToCourse: () => undefined,
          },
        },
      ],
    }).compileComponents();

    const backend = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(SurroundCarousel);
    fixture.detectChanges();

    // Flush BEFORE awaiting stability: a pending request never stabilises, and the
    // await would hang until the test times out.
    const pending = backend.match(() => true);
    requests = pending.map((r) => r.request);
    pending.forEach((r) => r.flush(response));

    await TestBed.inject(ApplicationRef).whenStable();
    fixture.detectChanges();
    backend.verify();
    return fixture;
  }

  const listOf = (fixture: ComponentFixture<SurroundCarousel>): HTMLElement | null =>
    fixture.nativeElement.querySelector('#surround-cards');

  it('reads the AI Lab track, scoped to ai_lab courses', async () => {
    await render([row(1), row(2)]);

    expect(requests.length).toBe(1);
    // Track 7 is the AI Lab track; the path is built from TRACK_ROUTES with :id replaced.
    expect(requests[0].url).toContain('v2/tracks/7/courses/');
    expect(requests[0].method).toBe('GET');
    expect(requests[0].params.get('course_type')).toBe('ai_lab');
    // appInterceptor owns the bearer; nothing is hand-attached here.
    expect(requests[0].headers.has('Authorization')).toBe(false);
  });

  it('renders one link per lab, on the kebab-case ai-labs segment', async () => {
    const fixture = await render([row(1), row(2), row(3)]);

    const links = fixture.nativeElement.querySelectorAll('#surround-cards a');
    expect(links.length).toBe(3);
    // The API says `ai_lab`; the router wants `ai-labs`. Getting this wrong is
    // a 404 that only shows up on click.
    expect(links[0].getAttribute('href')).toBe('/us/cpa/ai-labs/1/lab-1');
  });

  it('renders nothing below the minimum card count', async () => {
    const fixture = await render([row(1)]);

    expect(listOf(fixture)).toBeNull();
  });

  it('renders nothing when the track is empty', async () => {
    const fixture = await render([]);

    expect(listOf(fixture)).toBeNull();
  });

  it('drops rows with no artwork and falls back to the vertical thumbnail', async () => {
    const fixture = await render([
      row(1, { horizontal_thumbnail: '' }),
      row(2),
      row(3, { horizontal_thumbnail: '', thumbnail: '' }),
    ]);

    const images = fixture.nativeElement.querySelectorAll('#surround-cards img');
    // Row 3 has neither image and is dropped; row 1 falls back to `thumbnail`.
    expect(images.length).toBe(2);
    expect(images[0].getAttribute('src')).toBe('https://cdn.test/1-v.webp');
  });

  it('singularises the credit label', async () => {
    const fixture = await render([row(1, { class_credits: 1 }), row(2, { class_credits: 0.5 })]);

    const items = fixture.nativeElement.querySelectorAll('#surround-cards li');
    expect(items[0].textContent).toContain('1 CPE credit');
    expect(items[0].textContent).not.toContain('1 CPE credits');
    expect(items[1].textContent).toContain('0.5 CPE credits');
  });

  it('keeps the card row in the accessibility tree and the canvas out of it', async () => {
    const fixture = await render([row(1), row(2)]);

    expect(listOf(fixture)?.getAttribute('aria-hidden')).toBeNull();
    // The canvas is decoration over that row, never the content itself.
    expect(fixture.nativeElement.querySelector('canvas').getAttribute('aria-hidden')).toBe('true');
  });

  it('has no selected card — nothing is marked current', async () => {
    const fixture = await render([row(1), row(2)]);

    // The ring never comes to rest on a card, so any `aria-current` here would
    // be claiming a state the visitor cannot observe.
    expect(fixture.nativeElement.querySelectorAll('[aria-current]').length).toBe(0);
  });

  it('scrolls the fallback row with the arrows when there is no WebGL engine', async () => {
    const fixture = await render([row(1), row(2)]);
    const list = listOf(fixture)!;

    const calls: number[] = [];
    list.scrollBy = ((options: ScrollToOptions) => {
      calls.push(options.left ?? 0);
    }) as HTMLElement['scrollBy'];

    fixture.nativeElement.querySelector('[aria-label="Spin labs right"]').click();
    fixture.nativeElement.querySelector('[aria-label="Spin labs left"]').click();

    expect(calls.length).toBe(2);
    expect(calls[0]).toBeGreaterThan(0);
    expect(calls[1]).toBeLessThan(0);
  });
});
