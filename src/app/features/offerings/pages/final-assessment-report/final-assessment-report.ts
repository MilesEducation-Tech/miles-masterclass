import { Component } from '@angular/core';
import { Backward } from '@shared/components/backward/backward';

/**
 * `…/final-assessment/:sessionId/report`. Only the way back for now: the legacy
 * `user-assessment/assessment_report/` call is gone, and the web API's
 * `assessment-report/` binds here in MIL-109.
 */
@Component({
  selector: 'app-final-assessment-report',
  imports: [Backward],
  templateUrl: './final-assessment-report.html',
})
export class FinalAssessmentReport {}
