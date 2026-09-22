export type NavType = 'button' | 'link' | 'menu';

/** String-keyed handler the parent dispatches via `handleAction`. */
export type NavActionKind = 'bookDemo' | 'signup';

/** Visual treatment for buttons whose chrome is more than just `<app-button>`. */
export type NavButtonStyle = 'demo' | 'signup';

/**
 * Capability flags on a NavItem. The parent header filters items whose
 * requirement is unmet (e.g. `'activePlan'` hides items unless the user has
 * an active subscription). Extensible via the union.
 */
export type NavRequirement = 'activePlan';

export interface NavItem {
  label: string;
  subLabel?: string;
  type: NavType;
  route?: string;
  queryParams?: Record<string, unknown>;
  /** Action discriminator — looked up in the parent's dispatch table. */
  actionKind?: NavActionKind;
  /** Visual style key for special-chrome buttons (signup / book-demo). */
  style?: NavButtonStyle;
  /** Small pill rendered next to the label, e.g. `'Beta'`. */
  badge?: string;
  /** Hides the item unless the corresponding capability is satisfied. */
  requires?: NavRequirement;
  icon?: string;
  svg?: string;
  children?: readonly NavItem[];
}
