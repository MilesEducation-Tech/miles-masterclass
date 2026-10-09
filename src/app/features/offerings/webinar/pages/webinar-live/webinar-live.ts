import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core';
import { Button } from '@shared/ui/button/button';
import { MeetingStage } from '@features/offerings/webinar/components/meeting-stage/meeting-stage';
import { LiveSessionFacade } from '@features/offerings/webinar/services/live-session-facade';

/**
 * The live meeting room.
 *
 * Registered as `RenderMode.Client` — the SDK touches `window`, `document` and
 * WebAssembly, so this route is never server-rendered. The join sequence and
 * every state it can end in live in `LiveSessionFacade`; this page renders them.
 */
@Component({
  selector: 'app-webinar-live',
  imports: [DatePipe, Button, MeetingStage],
  templateUrl: './webinar-live.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WebinarLive {
  /** Bound from the `:id` route param by `withComponentInputBinding()`. */
  readonly id = input.required<string>();

  protected readonly facade = inject(LiveSessionFacade);

  constructor() {
    effect(() => {
      const webinarId = this.id();
      untracked(() => this.facade.open(webinarId));
    });
  }
}
