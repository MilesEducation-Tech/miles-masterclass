import { Component, HostListener, inject, input } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { FAQContent } from '@core/models/faq.model';

@Component({
  selector: 'app-faq-content',
  imports: [],
  templateUrl: './faq-content.html',
  styleUrl: './faq-content.css',
})
export class FaqContent {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly router = inject(Router);

  content = input.required<FAQContent[]>();

  /**
   * Trust gate for the 'rich' FAQContent variant. The union restricts callers
   * to typed constants (see faq.model.ts comment) — never API/user input.
   */
  protected trustHtml(html: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  /**
   * Intercept clicks on internal anchors inside rich content so they trigger
   * Angular SPA navigation instead of a full page reload.
   *
   * Convention: hrefs in `rich` content are treated as *locale-relative*.
   * `<a href="/privacy-policy">` and `<a href="privacy-policy">` both
   * resolve to `/<country>/<profession>/privacy-policy` under the current
   * route. External (`http(s)://`), `mailto:`, `tel:`, and pure `#fragment`
   * links pass through to the browser's default handling.
   */
  @HostListener('click', ['$event'])
  protected onClick(event: MouseEvent): void {
    // Skip modified clicks so users can still open in new tab/window.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const anchor = (event.target as HTMLElement | null)?.closest('a');
    if (!anchor) return;

    const href = anchor.getAttribute('href');
    if (!href) return;

    // Let the browser handle external + non-navigation schemes.
    if (
      /^(https?:|mailto:|tel:)/.test(href) ||
      href.startsWith('#') ||
      anchor.target === '_blank'
    ) {
      return;
    }

    event.preventDefault();

    // Strip any leading `./` or `/` so we always treat the path as
    // locale-relative, then re-attach to the current `:country/:profession`
    // scope derived from the URL.
    const cleanPath = href.replace(/^\.?\/?/, '');
    const currentSegments = this.router.url.split('?')[0].split('#')[0].split('/').filter(Boolean);
    const locale = currentSegments.slice(0, 2);
    this.router.navigate(['/', ...locale, ...cleanPath.split('/')]);
  }
}
