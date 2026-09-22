import { Component, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { NgIcon } from '@ng-icons/core';
import { iconXPartner } from '@core/constants/partner-icons';

export interface PartnerLogo {
  src: string;
  type?: 'image' | 'svg';
  alt?: string;
  class?: string;
}

export interface PartnerContentItem {
  heading?: string;
  headingClass?: string;

  subHeading?: string;
  /**
   * HTML markup rendered via `[innerHTML]` — use this when the subheading needs
   * inline tags, e.g. a `<span>` that colors part of the text. Angular sanitizes
   * the markup, so dangerous tags (e.g. `<script>`) are stripped automatically.
   * Takes precedence over `subHeading` when both are set.
   */
  subHeadingHtml?: string;
  subHeadingClass?: string;

  paragraph?: string;
  /**
   * HTML markup rendered via `[innerHTML]` — use this when the paragraph needs
   * inline tags like `<a>`, `<strong>`, or `<br>`. Angular sanitizes the markup,
   * so dangerous tags (e.g. `<script>`) are stripped automatically.
   * Takes precedence over `paragraph` when both are set.
   */
  paragraphHtml?: string;
  paragraphClass?: string;

  logos?: PartnerLogo[];
  logosClass?: string;
  separatorClass?: string;
  /**
   * When true, the logos render inline at the end of the `heading` text (as one
   * flowing phrase, e.g. "Exclusive access for members of [logo]") instead of on
   * their own block row above it. `logosClass` styles the inline wrapper span.
   */
  logosInline?: boolean;

  itemClass?: string;
}

@Component({
  selector: 'app-partner-content-list',
  imports: [NgIcon, NgTemplateOutlet],
  templateUrl: './partner-content-list.html',
  styleUrl: './partner-content-list.css',
})
export class PartnerContentList {
  content = input<PartnerContentItem[]>([]);
  containerClass = input<string>('');

  iconXPartner = iconXPartner;
}
