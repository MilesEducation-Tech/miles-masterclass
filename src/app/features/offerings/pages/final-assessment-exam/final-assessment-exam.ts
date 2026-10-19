import { Component } from '@angular/core';
import { Backward } from '@shared/components/backward/backward';

/**
 * `…/final-assessment/:sessionId/exam`. Only the way back for now: the legacy
 * `user-assessment/` and `final-assessment/` calls are gone, and the web API's
 * `assessment-start/`, `assessment-questions/` and `assessment-submit/` bind here
 * next (MIL-108).
 */
@Component({
  selector: 'app-final-assessment-exam',
  imports: [Backward],
  templateUrl: './final-assessment-exam.html',
})
export class FinalAssessmentExam {}
