import { Component, input } from '@angular/core';

/**
 * Top banner with a faded course-thumbnail collage behind a dark gradient.
 * Page-specific content (heading + search, or a breadcrumb) is projected in.
 */
@Component({
  selector: 'app-blog-banner',
  templateUrl: './blog-banner.html',
  styleUrl: './blog-banner.css',
})
export class BlogBanner {
  /** Featured-image URLs used as the faded collage strip. */
  readonly images = input<string[]>([]);
  /** Tall hero (home) vs. short strip (browse / post). */
  readonly tall = input<boolean>(false);
}
