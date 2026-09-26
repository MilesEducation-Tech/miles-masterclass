import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiUrl } from '@core/services/api-client/api-client';
import { Utils } from '@shared/services/utils';
import { CertificateDownload } from '../../services/certificate-download';
import { TrackerDialogOrchestrator } from '../../services/tracker-dialog-orchestrator';
import { CpeTracker } from './cpe-tracker';

const SUMMARY_URL = apiUrl('v2/cpe-tracker/summary/');
const LIST_URL = apiUrl('v2/cpe-tracker/');

describe('CpeTracker reads', () => {
  let fixture: ComponentFixture<CpeTracker>;
  let http: HttpTestingController;
  const year = new Date().getFullYear();
  const view = () =>
    fixture.componentInstance as unknown as {
      rows(): unknown[];
      hasListError(): boolean;
      totalPages(): number;
      creditsEarned(): number;
      ledger: { set(v: string): void };
    };

  beforeEach(() => {
    // The template's children are not what this spec is about.
    TestBed.overrideTemplate(CpeTracker, '');
    TestBed.configureTestingModule({
      imports: [CpeTracker],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Utils, useValue: { country: () => 'us', profession: () => 'cpa' } },
        { provide: CertificateDownload, useValue: {} },
        { provide: TrackerDialogOrchestrator, useValue: {} },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(CpeTracker);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('reads the year summary and the first page of the CAIRA ledger', async () => {
    const summary = http.expectOne((r) => r.url === SUMMARY_URL);
    expect(summary.request.params.get('year')).toBe(String(year));
    const list = http.expectOne((r) => r.url === LIST_URL);
    expect(list.request.params.get('ledger')).toBe('caira');
    expect(list.request.params.get('page')).toBe('1');
    expect(list.request.params.get('page_count')).toBe('15');
    expect(list.request.params.has('course_type')).toBe(false);
    summary.flush({ data: { caira_credits_earned: 4, others_credits_earned: 9 } });
    list.flush({ data: [{ id: 1 }], pagination_data: { total_count: 31 } });
    await fixture.whenStable();

    expect(view().creditsEarned()).toBe(4);
    expect(view().rows()).toHaveLength(1);
    expect(view().totalPages()).toBe(3);
  });

  it('flipping the ledger refetches the list only; the summary carries both totals', async () => {
    http
      .expectOne((r) => r.url === SUMMARY_URL)
      .flush({
        data: { caira_credits_earned: 4, others_credits_earned: 9 },
      });
    http.expectOne((r) => r.url === LIST_URL).flush({ data: [] });
    await fixture.whenStable();

    view().ledger.set('others');
    fixture.detectChanges();
    http.expectNone((r) => r.url === SUMMARY_URL);
    const list = http.expectOne((r) => r.url === LIST_URL);
    expect(list.request.params.get('ledger')).toBe('others');
    list.flush({ data: [] });
    await fixture.whenStable();
    expect(view().creditsEarned()).toBe(9);
  });

  it('reaches its error state when the reads fail, instead of throwing', async () => {
    http.expectOne((r) => r.url === SUMMARY_URL).flush(null, { status: 500, statusText: 'Boom' });
    http.expectOne((r) => r.url === LIST_URL).flush(null, { status: 500, statusText: 'Boom' });
    await fixture.whenStable();

    expect(view().hasListError()).toBe(true);
    expect(view().rows()).toEqual([]);
    expect(view().totalPages()).toBe(1);
    expect(view().creditsEarned()).toBe(0);
  });
});
