import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FinalAssessmentExam } from './final-assessment-exam';
import { FinalAssessmentFacade } from '../../services/final-assessment-facade/final-assessment-facade';
import { Dialog } from '@core/services/dialog/dialog';
import { of, Subject } from 'rxjs';
import { UtilsDialog } from '@shared/components/dialog/utils-dialog/utils-dialog';
import { signal } from '@angular/core';
import { Utils } from '@core/services/utils/utils';
import { ActivatedRoute, Router } from '@angular/router';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { AssessmentResultDialog } from '@shared/components/dialog/assessment-result-dialog/assessment-result-dialog';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CommonModule } from '@angular/common';

// Initialize test environment
try {
  TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
} catch {
  // Already initialized
}

describe('FinalAssessmentExam', () => {
  let component: FinalAssessmentExam;
  let fixture: ComponentFixture<FinalAssessmentExam>;
  let mockFacade: any;
  let mockDialog: any;
  let mockUtils: any;
  let mockRouter: any;
  let mockActivatedRoute: any;
  let dialogAfterClosedSubject: Subject<any>;

  beforeEach(async () => {
    dialogAfterClosedSubject = new Subject();

    mockFacade = {
      courseId: signal<string>(''),
      sessionId: signal<string>(''),
      isAssessmentPassed: signal<boolean>(false),
      loadAssessmentData: vi.fn(),
      updateQuestion: vi.fn(),
      submitAssessment: vi.fn(),
      clearAssessmentData: vi.fn(),
    };

    mockDialog = {
      open: vi.fn().mockReturnValue({
        afterClosed$: dialogAfterClosedSubject.asObservable(),
      }),
    };

    mockUtils = {
      startFinalAssessment: vi.fn(),
    };

    mockRouter = {
      navigate: vi.fn(),
    };

    mockActivatedRoute = {};

    await TestBed.configureTestingModule({
      imports: [FinalAssessmentExam, CommonModule],
      providers: [
        { provide: FinalAssessmentFacade, useValue: mockFacade },
        { provide: Dialog, useValue: mockDialog },
        { provide: Utils, useValue: mockUtils },
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
      ],
    })
      .overrideComponent(FinalAssessmentExam, {
        set: {
          template: `
          @if (isAssessmentPassed()) {
            <div>Assessment Completed</div>
          } @else {
             <div>Exam Content</div>
          }
        `,
          styleUrl: undefined,
          styles: [],
          imports: [CommonModule], // Override imports to avoid loading children with external templates
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(FinalAssessmentExam);
    component = fixture.componentInstance;

    // Set inputs
    fixture.componentRef.setInput('courseId', '123');
    fixture.componentRef.setInput('sessionId', '456');

    // Default load success
    mockFacade.loadAssessmentData.mockReturnValue(of({ questions: [], details: {} }));
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show already passed view if assessment is passed', () => {
    mockFacade.isAssessmentPassed.set(true);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Assessment Completed');
  });

  it('should prevent unload if not submitted and not passed', () => {
    mockFacade.isAssessmentPassed.set(false);
    const event = new Event('beforeunload');
    vi.spyOn(event, 'preventDefault');

    component.onBeforeUnload(event);

    expect(event.preventDefault).toHaveBeenCalled();
  });

  it('should allow deactivation if submitted', () => {
    component.isSubmitted.set(true);
    const result = component.canDeactivate();
    expect(result).toBe(true);
  });

  it('should allow deactivation if passed', () => {
    mockFacade.isAssessmentPassed.set(true);
    const result = component.canDeactivate();
    expect(result).toBe(true);
  });

  it('should prompt confirmation if not submitted and navigating away', () => {
    component.isSubmitted.set(false);
    mockFacade.isAssessmentPassed.set(false);

    const obs = component.canDeactivate();
    expect(mockDialog.open).toHaveBeenCalledWith(UtilsDialog, expect.anything());

    // Simulate confirm
    let allowed = false;
    if (typeof obs !== 'boolean') {
      obs.subscribe((res) => (allowed = res));
    }
    dialogAfterClosedSubject.next({ action: 'confirm' });

    expect(allowed).toBe(true);
    expect(mockFacade.clearAssessmentData).toHaveBeenCalled();
  });

  it('should submit successfully and open result dialog (passed)', () => {
    // Setup questions
    const questions = [{ id: 1, question: 'Q1', user_selected_option: 'a', option_a: 'A' } as any];
    // Re-mock loadAssessmentData and trigger load
    mockFacade.loadAssessmentData.mockReturnValue(of({ questions, details: {} }));
    component['loadQuestions']();
    fixture.detectChanges();

    // Submit
    const response = {
      status_code: true,
      data: { is_passed: true, result_details: { my_percentage: 100, pass_percentage: 80 } },
    };
    mockFacade.submitAssessment.mockReturnValue(of(response));

    component.submit();

    expect(mockFacade.submitAssessment).toHaveBeenCalled();
    expect(component.isSubmitted()).toBe(true);
    expect(mockDialog.open).toHaveBeenCalledWith(AssessmentResultDialog, expect.anything());
    expect(mockFacade.clearAssessmentData).toHaveBeenCalled();
  });

  it('should handle retake action from dialog', () => {
    // Setup
    const details = { id: 123, title: 'Course', course_type: 'masterclass', exam_rules: [] };
    mockFacade.loadAssessmentData.mockReturnValue(of({ questions: [], details }));
    component['loadQuestions'](); // Ensure details set
    fixture.detectChanges();

    // Trigger dialog action handling manually
    component.handleDialogAction('retake');

    expect(mockUtils.startFinalAssessment).toHaveBeenCalledWith('123', 'Course', 'masterclass', []);
  });
});
