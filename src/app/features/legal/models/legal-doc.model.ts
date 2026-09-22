import { FAQContent } from '@core/models/faq.model';

/**
 * Shape for a legal document rendered by <app-legal-doc>. Used by Terms of
 * Service and Privacy Policy pages. Replaces v1's TermSectionInterface +
 * raw HTML strings with a structured tree whose bodies are FAQContent[].
 *
 * Why FAQContent? Same union the FAQ page already uses (text/heading/list/
 * note/table/rich). Reusing it keeps one renderer (FaqContent) for all
 * rich-content surfaces — see [[faq.model.ts]] for the union.
 */
export interface LegalDoc {
  slug: 'terms-of-service' | 'privacy-policy';
  /** Page heading shown in the hero. */
  title: string;
  /** ISO-8601 date string. Rendered via Angular's DatePipe. */
  lastUpdated: string;
  /** Optional intro paragraph(s) rendered above the side menu split. */
  intro?: FAQContent[];
  /** Top-level sections. Each `navId` becomes an anchor + side-menu item. */
  sections: LegalSection[];
}

export interface LegalSection {
  /**
   * Kebab-case anchor id. Becomes the element id and the fragment used by
   * deep-links (e.g. /terms-of-service#refunds). Must be unique within doc.
   */
  navId: string;
  /** Short label shown in the sticky side menu. */
  navLabel: string;
  /** Section heading text. */
  title: string;
  /** Heading element to render. h2 for top-level, h3/h4 for nested. */
  level: 2 | 3 | 4;
  body: FAQContent[];
  /** Nested subsections — rendered recursively, not added to the side menu. */
  sections?: LegalSection[];
}
