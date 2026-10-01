import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { UpcomingWebinarCard } from '@features/offerings/webinar/models/webinar.model';
import { ServerClock } from '@features/offerings/webinar/services/server-clock';
import { WebinarFacade } from '@features/offerings/webinar/services/webinar-facade';

import { WebinarCard } from './webinar-card';

function card(startsAt: string): UpcomingWebinarCard {
  return {
    id: 'w1',
    slug: null,
    name: 'CAIRA Level 1',
    type: 'webinar',
    short_description: '',
    start_date_time: startsAt,
    end_date_time: startsAt,
    duration_minutes: 60,
    webinar_zoom_id: '84123456789',
    is_test_webinar: false,
    webinar_why_attend_points: null,
    webinar_what_will_you_learn_points: null,
    subject: 'CAIRA',
    subject_details: { id: 's1', subject: 'CAIRA' },
    level_details: null,
    horizontal_thumbnail: '',
    vertical_thumbnail: '',
    square_image: '',
    fields_of_study: [],
    total_cpe_credits: null,
  };
}

describe('WebinarCard, guest date pill', () => {
  let fixture: ComponentFixture<WebinarCard>;

  const pillMonth = async (startsAt: string) => {
    fixture.componentRef.setInput('webinar', card(startsAt));
    await fixture.whenStable();
    return fixture.nativeElement.querySelector('article span')?.textContent?.trim();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WebinarCard],
      providers: [
        provideRouter([]),
        { provide: WebinarFacade, useValue: { loginType: () => 'pre_login' } },
        { provide: ServerClock, useValue: { tick: signal(0), now: () => Date.now() } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(WebinarCard);
    fixture.componentRef.setInput('bucket', 'upcoming');
    fixture.componentRef.setInput('webinar', card('2026-11-12T00:00:00Z'));
  });

  it('spells the month out in full', async () => {
    expect(await pillMonth('2026-07-15T23:00:00Z')).toBe('July');
  });

  // 03:30Z is still the 31st in New York (EDT, UTC-4), but already November
  // in UTC. The pill's day and year come from ET, so the month must too.
  it('names the month in Eastern daylight time (EDT), not UTC', async () => {
    expect(await pillMonth('2026-11-01T03:30:00Z')).toBe('October');
  });

  // The same shape once the clocks have gone back (EST, UTC-5).
  it('names the month in Eastern standard time (EST), not UTC', async () => {
    expect(await pillMonth('2026-12-01T03:30:00Z')).toBe('November');
  });
});
