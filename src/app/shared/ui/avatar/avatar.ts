import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NgpAvatar, NgpAvatarFallback, NgpAvatarImage } from 'ng-primitives/avatar';

/** A round picture with initials shown until the image loads, or if it fails. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-avatar',
  hostDirectives: [NgpAvatar],
  imports: [NgpAvatarImage, NgpAvatarFallback],
  host: {
    class:
      'relative inline-flex size-10 shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-muted text-sm font-medium text-foreground',
  },
  template: `
    @if (image()) {
      <img
        ngpAvatarImage
        class="absolute inset-0 size-full object-cover"
        [src]="image()"
        [alt]="alt()"
      />
    }
    <span ngpAvatarFallback>{{ fallback() }}</span>
  `,
})
export class Avatar {
  /** The avatar image source. */
  readonly image = input<string>();

  /** The initials shown until the image loads, or if it fails. */
  readonly fallback = input<string>();

  /** The image's alternative text, e.g. the person's name. */
  readonly alt = input('');
}
