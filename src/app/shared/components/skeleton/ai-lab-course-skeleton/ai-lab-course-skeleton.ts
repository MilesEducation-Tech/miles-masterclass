import { Component } from '@angular/core';

/**
 * Loading placeholder for the AI Lab course page. Mirrors the real layout down
 * to the first section — sub-bar, hero (player + detail column), description
 * and the lab card — so the page doesn't reflow when the payload lands.
 *
 * ponytail: stops at section 01. Everything below it is off-screen on load, and
 * a skeleton for content nobody is looking at is just markup to keep in sync.
 */
@Component({
  selector: 'app-ai-lab-course-skeleton',
  imports: [],
  templateUrl: './ai-lab-course-skeleton.html',
})
export class AiLabCourseSkeleton {}
