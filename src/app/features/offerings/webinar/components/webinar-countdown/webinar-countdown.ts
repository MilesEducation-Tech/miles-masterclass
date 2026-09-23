import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
} from '@angular/core';
import { ServerClock } from '../../services/server-clock';
import { formatCountdown, formatCountdownLong, splitDuration } from '../../utils/session-time';

/**
 * Time remaining until a moment, ticking once a second.
 *
 * Subscribes to the shared `ServerClock` ticker rather than owning an interval:
 * a page can render thirty of these, and thirty timers is thirty times the work
 * for one second of wall clock. The ticker is reference-counted, so the last
 * countdown to leave the page also stops it.
 */
@Component({
  selector: 'app-webinar-countdown',
  imports: [],
  templateUrl: './webinar-countdown.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WebinarCountdown {
  /** Epoch ms of the moment being counted down to. */
  readonly target = input.required<number>();
  /** Prefix copy, e.g. "Starts in" or "Join opens in". */
  readonly label = input<string>('Starts in');

  private readonly clock = inject(ServerClock);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    this.destroyRef.onDestroy(this.clock.startTicking());
  }

  protected readonly parts = computed(() => {
    // Read the tick so this recomputes every second. `now()` is not a signal —
    // it reads the device clock plus the server offset — so without this the
    // countdown would freeze on its first value.
    this.clock.tick();
    return splitDuration(this.target() - this.clock.now());
  });

  /**
   * `compact` for a card strip (`4d 03h`), `long` for a headline
   * ("4 hours and 30 minutes"). Same data, different room to say it in.
   */
  readonly format = input<'compact' | 'long'>('compact');

  protected readonly display = computed(() =>
    this.format() === 'long' ? formatCountdownLong(this.parts()) : formatCountdown(this.parts()),
  );

  /** Below an hour the countdown is actionable, so it earns visual weight. */
  protected readonly isImminent = computed(() => this.parts().totalMs < 3_600_000);
}
