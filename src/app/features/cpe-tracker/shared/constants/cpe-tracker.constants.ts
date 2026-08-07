/** Brand hexes for the "Field of Study" legend, chart bars, and table accents. */
export const FIELD_COLORS = {
  Accounting: '#5A6499',
  Ethics: '#F06B6D',
  Others: '#FCC046',
  default: '#64748B',
} as const;

/** Brand hexes for the delivery-method column + badges. */
export const DELIVERY_COLORS = {
  'Group Internet Based': '#214FE6',
  'QAS Self Study': '#00B64D',
  'Nano Learning': '#7765FF',
  default: '#94A3B8',
} as const;

export const BADGE_LEVEL_STYLES: Record<string, string> = {
  bronze: 'border-amber-600',
  silver: 'border-slate-400',
  gold: 'border-yellow-500',
  default: 'border-border',
};

export const DOWNLOAD_DEBOUNCE_MS = 2000;

/** Ordered legend series (matches `deriveFieldsOfStudy` output order). */
export const FIELD_COLOR_SERIES: readonly string[] = [
  FIELD_COLORS.Accounting,
  FIELD_COLORS.Ethics,
  FIELD_COLORS.Others,
];
