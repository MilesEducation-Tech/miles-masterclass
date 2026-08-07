import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FinalAssessmentReport } from './final-assessment-report';

describe('FinalAssessmentReport', () => {
  let component: FinalAssessmentReport;
  let fixture: ComponentFixture<FinalAssessmentReport>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FinalAssessmentReport],
    }).compileComponents();

    fixture = TestBed.createComponent(FinalAssessmentReport);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
