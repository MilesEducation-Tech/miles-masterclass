import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { FinalAssessmentFacade } from '../../services/final-assessment-facade';

import { FinalAssessmentReport } from './final-assessment-report';

describe('FinalAssessmentReport', () => {
  let component: FinalAssessmentReport;
  let fixture: ComponentFixture<FinalAssessmentReport>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FinalAssessmentReport],
      providers: [
        // Route-scoped, not `providedIn: 'root'` — it is listed in a route's
        // `providers`, so a spec has to provide it by hand.
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        FinalAssessmentFacade,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FinalAssessmentReport);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('expands each question as an ngpCollapsible disclosure', async () => {
    component.isLoading.set(false);
    component.reportData.set({
      total_correct: 0,
      total_questions: 1,
      result_details: { my_percentage: 0 },
      question_answers: [
        {
          id: 1,
          is_correct: false,
          answer: 'a',
          question_object: { question: 'What is GAAP?', option_a: 'A', correct_option: 'b' },
        },
      ],
    } as never);
    await fixture.whenStable();

    const el: HTMLElement = fixture.nativeElement;
    const trigger = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('What is GAAP?'),
    )!;
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    const panel = el.querySelector(`[id="${trigger.getAttribute('aria-controls')}"]`)!;
    expect(panel).not.toBeNull();

    trigger.click();
    await fixture.whenStable();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(component.isExpanded(1)).toBe(true);

    trigger.click();
    await fixture.whenStable();
    expect(component.isExpanded(1)).toBe(false);
  });
});
