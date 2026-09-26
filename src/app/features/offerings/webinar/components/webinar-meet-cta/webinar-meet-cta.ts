import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
// Type-only: CalendlyDialog loads with `import()` when opened (PROMPT.md §4.4).
import type { CalendlyDialogData } from '@shared/dialogs/calendly-dialog/calendly-dialog';
import { Button } from '@shared/ui/button/button';
import { NgpDialogManager } from 'ng-primitives/dialog';

/**
 * Scheduling URL the "Book 15-Min Call" button opens.
 *
 * TODO(booking): this is the 30-minute event type — the only one that exists
 * anywhere in this codebase — while the button and the copy both say 15
 * minutes. Create the 15-minute event in Calendly and swap this one constant;
 * nothing else needs to change. Calendly is the right mechanism despite the
 * section being titled "Google Meet": an event type can be configured to issue
 * a Meet link, which is presumably how this is meant to work.
 */
const BOOKING_URL = 'https://calendly.com/rohan-singhai-milesmasterclass/30min';

/**
 * The "1:1 Google Meet" band between the webinar rail and the attendance
 * sections: copy and a booking CTA on the left, artwork bleeding off the panel
 * on the right.
 */
@Component({
  selector: 'app-webinar-meet-cta',
  host: { class: 'block' },
  imports: [Button],
  templateUrl: './webinar-meet-cta.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WebinarMeetCta {
  readonly heading = input('1:1 Google Meet');
  readonly description = input(
    'Schedule a 15-minute Google Meet to mapping out your US accounting credentials & CAIRA training roadmap.',
  );
  readonly ctaLabel = input('Book 15-Min Call');

  private readonly dialogs = inject(NgpDialogManager);

  protected async onBook(): Promise<void> {
    const { CalendlyDialog } = await import('@shared/dialogs/calendly-dialog/calendly-dialog');
    this.dialogs.open(CalendlyDialog, {
      data: {
        ariaLabel: 'Book a 15-minute call',
        url: BOOKING_URL,
        closeAction: true,
      } satisfies CalendlyDialogData,
    });
  }
}
