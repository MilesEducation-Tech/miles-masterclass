export interface FooterLink {
  label: string;
  route?: string;
  url?: string;
  queryParams?: Record<string, unknown>;
  icon?: string;
  /** Small line above an app-store label ("Download on the", "Get it on"). Translation key. */
  caption?: string;
  showWhen?: 'always' | 'authenticated' | 'trail-access' | 'not-authenticated';
  /** Renders the link as a button that triggers an in-app action instead of navigating. */
  action?: 'bookDemo';
}

export interface FooterSection {
  title: string;
  links: FooterLink[];
  /** Spans both columns on phones, with its links in two columns. */
  wide?: boolean;
}
