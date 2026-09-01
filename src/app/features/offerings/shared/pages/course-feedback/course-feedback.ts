import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, ActivatedRoute } from '@angular/router';
import { RatingStar } from '../../../../../shared/components/rating-star/rating-star';
import { Button } from '../../../../../shared/components/ui/button/button';
import { AriaInput } from '../../../../../shared/components/ui/aria/aria-input/aria-input';
import { Auth } from '../../../../../shared/core/services/auth/auth';
import { Dialog } from '../../../../../shared/core/services/dialog/dialog';
import {
  UtilsDialog,
  UtilsDialogData,
} from '../../../../../shared/components/dialog/utils-dialog/utils-dialog';
import { CairaUuid } from '../../../../../shared/core/models/caira/envelope.model';
import { Feedback } from '../../services/feedback/feedback';

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
})
export class CourseFeedback {
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(Auth);
  private readonly dialog = inject(Dialog);

  /** #12 / #13, route-scoped. Reads the course from the parent `CourseDetail`. */
  protected readonly feedback = inject(Feedback);

  protected readonly currentUser = this.auth.currentUser;

  protected setRating(questionId: CairaUuid, value: number): void {
    this.feedback.rate(questionId, value);
  }

  protected getRating(questionId: CairaUuid): number {
    return this.feedback.ratings()[questionId] ?? 0;
  }

  /**
   * The profile gate stays here: it is a navigation decision, not a data one.
   * Feedback issues a CPE certificate, which needs a completed profile —
   * anything other than literal `true` prompts, so an unloaded profile fails
   * closed rather than submitting.
   */
  protected submit(): void {
    if (!this.feedback.canSubmit()) return;

    if (!this.auth.isProfileComplete()) {
      this.openProfileIncompleteDialog();
      return;
    }

    this.feedback.submit();
  }

  protected handleRedirect(): void {
    const redirectParams = this.route.snapshot.queryParams['redirect'];
    if (redirectParams) {
      this.router.navigateByUrl(redirectParams);
    } else {
      this.router.navigate(['../../..'], { relativeTo: this.route });
    }
  }

  private openProfileIncompleteDialog(): void {
    const dialogRef = this.dialog.open(UtilsDialog, {
      width: '500px',
      maxWidth: '95vw',
      ariaLabel: 'Complete your profile to submit feedback',
      data: PROFILE_INCOMPLETE_DIALOG_DATA,
    });

    dialogRef.afterClosed$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result: any) => {
      if (result?.action === 'confirm') {
        this.router.navigate(['/auth/profile'], {
          queryParams: { redirect: this.router.url },
        });
      }
    });
  }
}
