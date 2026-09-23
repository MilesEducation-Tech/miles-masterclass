import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Warn-toned strip for a deprecated v1 admin page, linking to its v2
 * replacement. Purely informational — the v1 page stays fully functional.
 */
@Component({
  selector: 'app-deprecation-banner',
  imports: [RouterLink],
  template: `
    <div
      class="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md px-3 py-2 text-sm"
      style="background: var(--mm-warn-bg); color: var(--mm-warn-fg)"
      role="note"
    >
      <span class="font-semibold">Deprecated.</span>
      <span>{{ message() }}</span>
      <a [routerLink]="to()" class="font-semibold underline underline-offset-2">
        Open Partner Platform v2
      </a>
    </div>
  `,
  host: { class: 'block w-full' },
})
export class DeprecationBanner {
  /** The v2 route this page's replacement lives at. */
  readonly to = input.required<string>();
  readonly message = input('This page is being replaced by Partner Platform v2.');
}
