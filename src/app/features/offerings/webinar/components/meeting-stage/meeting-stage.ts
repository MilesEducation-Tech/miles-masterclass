import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  viewChild,
} from '@angular/core';
import { Button } from '@shared/ui/button/button';
import { LiveSessionFacade } from '@features/offerings/webinar/services/live-session-facade';

/**
 * The element the Zoom SDK renders into, plus our chrome around it.
 *
 * It owns no SDK, no lease and no state: it reads the room's title and status
 * from `LiveSessionFacade` and hands the facade its `#zoomRoot` once rendered.
 *
 * The container is kept free of Tailwind utilities on purpose. The SDK injects
 * its own stylesheet and lays the meeting out itself; classes applied inside
 * `#zoomRoot` fight it, and preflight resets reaching into it are what produce
 * the "controls are invisible" reports.
 */
@Component({
  selector: 'app-meeting-stage',
  imports: [Button],
  templateUrl: './meeting-stage.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MeetingStage {
  protected readonly facade = inject(LiveSessionFacade);
  private readonly destroyRef = inject(DestroyRef);

  private readonly zoomRoot = viewChild.required<ElementRef<HTMLElement>>('zoomRoot');

  constructor() {
    afterNextRender(() => {
      const root = this.zoomRoot().nativeElement;
      this.facade.attachStage(root);
      this.destroyRef.onDestroy(() => this.facade.detachStage(root));
    });
  }
}
