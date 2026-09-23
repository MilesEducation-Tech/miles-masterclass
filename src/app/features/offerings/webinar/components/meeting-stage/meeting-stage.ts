import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  output,
  viewChild,
} from '@angular/core';

/**
 * The element the Zoom SDK renders into, plus our chrome around it.
 *
 * Deliberately dumb: it owns no SDK, no lease and no state. The live page drives
 * everything and hands this component the element via `stageRoot()`.
 *
 * The container is kept free of Tailwind utilities on purpose. The SDK injects
 * its own stylesheet and lays the meeting out itself; classes applied inside
 * `#zoomRoot` fight it, and preflight resets reaching into it are what produce
 * the "controls are invisible" reports.
 */
@Component({
  selector: 'app-meeting-stage',
  imports: [],
  templateUrl: './meeting-stage.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MeetingStage {
  readonly title = input.required<string>();
  /** Shown while the SDK chunk downloads and the join handshake runs. */
  readonly isPreparing = input(false);
  readonly statusText = input<string | null>(null);

  readonly leave = output<void>();

  private readonly zoomRoot = viewChild.required<ElementRef<HTMLElement>>('zoomRoot');

  /** The element to pass to `client.init({ zoomAppRoot })`. */
  stageRoot(): HTMLElement {
    return this.zoomRoot().nativeElement;
  }
}
