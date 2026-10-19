/** Brand hexes for the "Field of Study" legend, chart bars, and table accents. */
export const FIELD_COLORS = {
  Accounting: '#5A6499',
  Ethics: '#F06B6D',
  Others: '#FCC046',
  default: '#64748B',
} as const;

/**
 * Brand hexes for the delivery-method column + badges.
 *
 * The server sends the method as a string now, and `Group Live` is a fourth value the v2 contract
 * never produced — it shares the webinar blue, because it is the other half of the same bucket
 * (`study_credits.webinar` counts both).
 */
export const DELIVERY_COLORS = {
  'Group Internet Based': '#214FE6',
  'Group Live': '#214FE6',
  'QAS Self Study': '#00B64D',
  'Nano Learning': '#7765FF',
  default: '#94A3B8',
} as const;

export const DOWNLOAD_DEBOUNCE_MS = 2000;

/** Ordered legend series (matches `deriveFieldsOfStudy` output order). */
export const FIELD_COLOR_SERIES: readonly string[] = [
  FIELD_COLORS.Accounting,
  FIELD_COLORS.Ethics,
  FIELD_COLORS.Others,
];
