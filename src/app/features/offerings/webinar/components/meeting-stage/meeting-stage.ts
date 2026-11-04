import { DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Button } from '@shared/ui/button/button';
import { Spinner } from '@shared/ui/spinner/spinner';
import { LiveSessionFacade } from '@features/offerings/webinar/services/live-session-facade';

/**
 * The full-screen surface the room shows until Zoom's own page covers it:
 * connecting, and waiting for the host to start, each with a way out.
 *
 * It owns no SDK, no lease and no state: it reads the room's title, status and
 * wait-for-host state from `LiveSessionFacade`. Zoom is not rendered here.
 * Client View draws into its own body-level root on top of this element (see
 * `ZoomMeetingClient`), so once joined, nothing in this component sits over
 * the meeting.
 *
 * The exception is the wait for the start. Every retry shows Zoom's root for
 * the length of the join attempt, which would flash it black over this screen
 * every few seconds. While the room waits, the stage is lifted above that root
 * (which sets no `z-index`), and the retries happen unseen underneath. The join
 * that succeeds ends the wait, and the stage drops back below the meeting.
 */
@Component({
  selector: 'app-meeting-stage',
  imports: [DatePipe, Button, Spinner],
  templateUrl: './meeting-stage.html',
  host: {
    class: 'fixed inset-0 flex flex-col items-center justify-center bg-background px-6 text-center',
    '[class.z-10]': 'facade.waitingForHost()',
  },
})
export class MeetingStage {
  protected readonly facade = inject(LiveSessionFacade);
}
