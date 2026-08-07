import { Component, input } from '@angular/core';
import { Spinner } from '../spinner/spinner';

@Component({
  selector: 'app-page-loading',
  imports: [Spinner],
  templateUrl: './page-loading.html',
  styles: ``,
  host: {
    class: 'flex items-center justify-center w-full',
    '[class]': 'fullScreen() ? "min-h-screen" : "min-h-64"',
    role: 'status',
    'aria-live': 'polite',
  },
})
export class PageLoading {
  /** Message shown below the spinner */
  readonly message = input('Loading...');

  /** Spinner size */
  readonly size = input<'sm' | 'md' | 'lg' | 'xl'>('xl');

  /** Whether to take full screen height */
  readonly fullScreen = input(false);
}
