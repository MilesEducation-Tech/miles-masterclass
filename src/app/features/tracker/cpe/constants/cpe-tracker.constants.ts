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

/**
 * Total CPE credits a reporting cycle requires.
 *
 * Hardcoded deliberately: no API models per-state-board requirements, and the
 * v2 summary returns only the earned side of the gauge. `Auth.currentUser()`
 * gives the board *name* but not its threshold. Replace with a real per-board
 * lookup once backend has one.
 */
export const DEFAULT_CPE_REQUIREMENT = 40;

export const DOWNLOAD_DEBOUNCE_MS = 2000;

/** Ordered legend series (matches `deriveFieldsOfStudy` output order). */
export const FIELD_COLOR_SERIES: readonly string[] = [
  FIELD_COLORS.Accounting,
  FIELD_COLORS.Ethics,
  FIELD_COLORS.Others,
];
