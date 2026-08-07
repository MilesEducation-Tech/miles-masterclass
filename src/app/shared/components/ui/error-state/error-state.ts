import { Component, input, output } from '@angular/core';
import { Button } from '../button/button';

@Component({
  selector: 'app-error-state',
  imports: [Button],
  templateUrl: './error-state.html',
  styles: ``,
  host: {
    class: 'flex items-center justify-center w-full',
    '[class]': 'fullScreen() ? "min-h-screen" : "min-h-64"',
    role: 'alert',
  },
})
export class ErrorState {
  /** Error title */
  readonly title = input('Something went wrong');

  /** Error description */
  readonly message = input('An unexpected error occurred. Please try again.');

  /** Whether to show retry button */
  readonly showRetry = input(true);

  /** Retry button label */
  readonly retryLabel = input('Try Again');

  /** Whether to take full screen height */
  readonly fullScreen = input(false);

  /** Emitted when the user clicks retry */
  readonly retry = output<void>();
}
