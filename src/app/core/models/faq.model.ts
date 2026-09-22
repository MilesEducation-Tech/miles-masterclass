export interface FAQ {
  id: number;
  question: string;
  content: FAQContent[];
  children?: FAQ[];
}

export type FAQContent =
  | { type: 'text'; value: string }
  | { type: 'heading'; value: string; level: 1 | 2 | 3 | 4 }
  | { type: 'subtext'; value: string }
  | { type: 'description'; value: string }
  | { type: 'note'; value: string; variant?: 'info' | 'warning' | 'success' }
  | { type: 'list'; items: string[]; ordered?: boolean }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'image'; src: string; alt: string; caption?: string }
  | { type: 'code'; value: string; language?: string }
  // Trust boundary: `html` is rendered verbatim via DomSanitizer.bypassSecurityTrustHtml.
  // ONLY source from typed TS constants (e.g. terms-of-service.ts). Never accept
  // user input or API responses here without switching to .sanitize().
  | { type: 'rich'; html: string };

/** Helper to mark a piece of content as trusted rich HTML in constants files. */
export const richContent = (html: string): FAQContent => ({ type: 'rich', html });
