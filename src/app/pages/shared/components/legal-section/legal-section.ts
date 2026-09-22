import { Component, input } from '@angular/core';
import { LegalSection as LegalSectionModel } from '@core/models/legal-doc.model';
import { FaqContent } from '../../../faq/shared/components/faq-content/faq-content';

/**
 * Renders one section of a LegalDoc: heading + FAQContent body + recursive
 * nested subsections. The heading element is chosen by `section.level`
 * (h2/h3/h4) and gets `[id]="navId"` + `scroll-mt-24` so SectionNav's
 * scrollToSection lands below the sticky header.
 */
@Component({
  selector: 'app-legal-section',
  imports: [FaqContent],
  templateUrl: './legal-section.html',
  styleUrl: './legal-section.css',
})
export class LegalSection {
  readonly section = input.required<LegalSectionModel>();
}
