import { Component, DestroyRef, effect, inject, input, linkedSignal, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, ActivatedRoute } from '@angular/router';
import { FeedbackFacade } from '../../services/feedback-facade';
import { RatingStar } from '@shared/components/rating-star/rating-star';
import { Button } from '@shared/ui/button/button';
import { AriaInput } from '@shared/ui/aria/aria-input/aria-input';
import { Utils } from '@shared/services/utils';
import { NgpDialogManager } from 'ng-primitives/dialog';
import { User } from '@core/models/profile.model';
import {
  UtilsDialog,
  UtilsDialogData,
  UtilsDialogResult,
} from '@shared/dialogs/utils-dialog/utils-dialog';

const PROFILE_INCOMPLETE_DIALOG_DATA: UtilsDialogData = {
  containerClass: 'py-12 px-6',
  content: [
    { type: 'heading', value: 'Complete Your Profile to Continue', level: 3 },
    {
      type: 'text',
      value:
        'Before submitting feedback, please finish setting up your profile. We use it to issue your CPE certificate and personalise your learning path.',
    },
  ],
  buttons: [{ label: 'Complete Profile', variant: 'default', action: 'confirm' }],
};

@Component({
  selector: 'app-course-feedback',
  imports: [RatingStar, Button, AriaInput],
  templateUrl: './course-feedback.html',
  styleUrl: './course-feedback.css',
  providers: [FeedbackFacade],
})
export class CourseFeedback {
  courseId = input<string>();

  private readonly facade = inject(FeedbackFacade);
  private readonly destroyRef = inject(DestroyRef);
  readonly router = inject(Router);
  readonly route = inject(ActivatedRoute);
  private readonly utils = inject(Utils);
  private readonly dialogs = inject(NgpDialogManager);

  // ponytail: inert — was `auth.currentUser`.
  currentUser = signal<User | null>(null);
  protected readonly categories = this.facade.categories;
  protected readonly courseDetails = this.facade.courseDetails;
  /** A submitted course is shown read-only, with the learner's answers filled in. */
  protected readonly isReadOnly = this.facade.feedbackSubmitted;
  /** Editable, but reset to the learner's submitted answers once they load. */
  ratings = linkedSignal<Record<number, number>>(() => {
    const ratingMap: Record<number, number> = {};
    // `category_details.id` is the category id (the row's root `feedback_category` is the same).
    this.facade
      .userFeedback()
      ?.feedback_details.forEach(
        (item) => (ratingMap[item.category_details.id] = item.feedback_answer),
      );
    return ratingMap;
  });
  otherComments = linkedSignal(() => this.facade.userFeedback()?.other_comments || '');
  isSubmitting = signal(false);

  // Post-submission state
  submissionSuccess = signal(false);
  certificateUrls = signal<{ miles?: string; nasba?: string } | null>(null);

  constructor() {
    // An effect, not a one-shot read: the router reuses this component when only
    // the course id changes.
    effect(() => {
      const id = this.courseId();
      this.facade.showCourse(id ? Number(id) : null);
    });
  }

  setRating(categoryId: number, value: number) {
    this.ratings.update((current) => ({
      ...current,
      [categoryId]: value,
    }));
  }

  getRating(categoryId: number): number {
    return this.ratings()[categoryId] || 0;
  }

  // Computed
  get isValid(): boolean {
    const cats = this.categories();
    const currentRatings = this.ratings();
    // Check if all categories are rated
    return cats.length > 0 && cats.every((cat) => (currentRatings[cat.id] || 0) > 0);
  }

  submit() {
    if (!this.isValid || this.isSubmitting()) return;

    // Gate: the feedback flow issues a CPE certificate, which requires a
    // completed profile. Anything other than literal `true` is treated as
    // not-completed so legacy responses that omit the field still prompt.
    if (this.currentUser()?.is_profile_completed !== true) {
      this.openProfileIncompleteDialog();
      return;
    }

    this.isSubmitting.set(true);

    const feedbacks = Object.entries(this.ratings()).map(([catId, val]) => ({
      feedback_category: Number(catId),
      feedback: val,
    }));

    const courseType = this.utils.getCourseType();
    const courseIdKey =
      courseType === 'webinar'
        ? 'webinar_id'
        : courseType === 'podcast'
          ? 'podcast_id'
          : courseType === 'nano-learning' ||
              courseType === 'micro-learning' ||
              courseType === 'ai_lab'
            ? 'nano_learning_id'
            : 'masterclass_id';

    const req = {
      feedbacks,
      other_comments: this.otherComments(),
      [courseIdKey]: this.courseId()!,
    };

    this.facade
      .submitFeedback(req)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.isSubmitting.set(false);
          this.submissionSuccess.set(true);
          if (res.URL) {
            this.certificateUrls.set({
              miles: res.URL.miles_certificate_url,
              nasba: res.URL.nasba_certificate_url,
            });
          }
        },
        error: () => {
          this.isSubmitting.set(false);
        },
      });
  }

  handleRedirect() {
    const redirectParams = this.route.snapshot.queryParams['redirect'];
    if (redirectParams) {
      this.router.navigateByUrl(redirectParams);
    } else {
      this.router.navigate(['../../..'], { relativeTo: this.route });
    }
  }

  private openProfileIncompleteDialog(): void {
    const dialogRef = this.dialogs.open<UtilsDialogData, UtilsDialogResult>(UtilsDialog, {
      data: {
        ...PROFILE_INCOMPLETE_DIALOG_DATA,
        width: '500px',
        maxWidth: '95vw',
        ariaLabel: 'Complete your profile to submit feedback',
      },
    });

    dialogRef.afterClosed.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result: any) => {
      if (result?.action === 'confirm') {
        this.router.navigate(['/auth/profile'], {
          queryParams: { redirect: this.router.url },
        });
      }
    });
  }
}
