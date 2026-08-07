import { Component, computed, input, output } from '@angular/core';

export type WebinarClaimState = 'feedback' | 'badge';

interface ClaimCopy {
  title: string;
  bodyPrefix: string;
  bodySuffix: string;
  ctaLabel: string;
  ctaClass: string;
}

@Component({
  selector: 'app-webinar-claim-card',
  templateUrl: './webinar-claim-card.html',
  host: {
    class: 'block',
  },
})
export class WebinarClaimCard {
  readonly state = input.required<WebinarClaimState>();
  readonly webinarTitle = input.required<string>();

  readonly primaryClick = output<void>();
  readonly cancelClick = output<void>();

  protected readonly copy = computed<ClaimCopy>(() => {
    if (this.state() === 'feedback') {
      return {
        title: 'Submit Feedback and Claim your Badge',
        bodyPrefix: 'We noticed you attended the ',
        bodySuffix:
          ". We'd love to know what you thought about it! Your feedback helps us make the next masterclass even better.",
        ctaLabel: 'Give Feedback',
        ctaClass: 'bg-[#f5a623] text-black hover:bg-[#e69513]',
      };
    }
    return {
      title: "You've earned a Badge!",
      bodyPrefix: "Awesome! You've completed ",
      bodySuffix:
        " and submitted your feedback. Don't leave your reward behind—claim your masterclass badge now!",
      ctaLabel: 'Claim My Badge',
      ctaClass: 'bg-[#2a85ff] text-white hover:bg-[#1a75ef]',
    };
  });

  protected onPrimary(): void {
    this.primaryClick.emit();
  }

  protected onCancel(): void {
    this.cancelClick.emit();
  }
}
