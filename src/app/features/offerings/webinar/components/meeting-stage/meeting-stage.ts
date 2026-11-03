import { DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Button } from '@shared/ui/button/button';
import { LiveSessionFacade } from '@features/offerings/webinar/services/live-session-facade';

/**
 * The full-screen surface the room shows until Zoom's own page covers it:
 * connecting, and waiting for the host to start, each with a way out.
 *
 * It owns no SDK, no lease and no state: it reads the room's title, status and
 * wait-for-host state from `LiveSessionFacade`. Zoom is not rendered here.
 * Client View draws into its own body-level root on top of this element (see
 * `ZoomMeetingClient`), so nothing in this component ever sits over the meeting.
 */
@Component({
  selector: 'app-meeting-stage',
  imports: [DatePipe, Button],
  templateUrl: './meeting-stage.html',
  host: {
    class:
      'fixed inset-0 flex flex-col items-center justify-center gap-3 bg-background px-6 text-center',
  },
})
export class MeetingStage {
  protected readonly facade = inject(LiveSessionFacade);
}
