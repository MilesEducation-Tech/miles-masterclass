import { Pipe, PipeTransform, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

/**
 * Render trusted WordPress post HTML verbatim (preserving block markup) via
 * `[innerHTML]`. The content originates from our own CMS, so we bypass the
 * default sanitizer to keep classes and structure intact.
 *
 * Usage: `<div [innerHTML]="post.contentHtml | safeHtml"></div>`
 */
@Pipe({ name: 'safeHtml' })
export class SafeHtmlPipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);

  transform(value: string | null | undefined): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(value ?? '');
  }
}
