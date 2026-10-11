/**
 * The data the home page's presentational sections render. The webinar ticket
 * reads `highlight-webinars/` (`HomeFacade`); the pricing card is still
 * flagged until the plan-price source is confirmed (prompts/home-redesign.md,
 * "API flags"). Storybook feeds these shapes from `@testing/mocks/home.mock`.
 */

/** One figure on the pricing card: the amount with its own plan's currency. */
export interface HomePriceOption {
  amount: number;
  /** ISO 4217 code for `CurrencyPipe` — each option carries its own, the UAE prices in AED and USD. */
  currency: string;
  /** "/ month", "/ year" — the payload's words, since the standard Yearly is paid once. */
  suffix: string;
  /** The struck-through figure when `discountPercent` is above zero. */
  baseAmount: number | null;
  discountPercent: number;
  /** "N-month commitment" under the headline figure; 0 hides it. */
  commitmentMonths: number;
  /** The plan's own label, shown when there is no secondary figure. */
  label: string;
}

/**
 * The pricing card's figures (Figma 2175:26155): a headline figure, an
 * optional "Or" alternative, and the currencies for the footnote.
 */
export interface HomePrice {
  primary: HomePriceOption;
  secondary: HomePriceOption | null;
  /** "USD" / "AED and USD" — for the "Prices in …" footnote. */
  currencies: string;
}

/**
 * The live-webinar ticket's row (Figma 2175:21750): the highlighted webinar and
 * its live or next session. One row is all the ticket renders.
 */
export interface HomeWebinar {
  /** The webinar's UUID: the detail page is `webinar/:id`. */
  id: string;
  title: string;
  overview: string | null;
  /** Square art preferred (the ticket's left card is square); `null` shows the design's banner. */
  banner: string | null;
  /** ISO start of the live session, else the next upcoming one; `null` when none is scheduled. */
  sessionStart: string | null;
}

// ---- `highlight-webinars/` -------------------------------------------------
//
// Hand-written guards, like every model on the new API: a renamed key would
// otherwise render as `undefined` with no signal. Only the keys the ticket
// reads are checked; extra keys pass. The webinar feature's own guards cannot
// be imported here (features never import each other), and this row is not
// that card anyway: it carries no `fields_of_study`, `total_cpe_credits` or
// `registration` (checked live on UAT 2026-10-11, signed out and in).

type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isStrOrNull = (v: unknown): v is string | null => v === null || isStr(v);

/** The keys of one `highlight_webinars` row that the ticket renders. */
interface HighlightWebinarRow {
  id: string;
  name: string;
  short_description: string | null;
  start_date_time: string | null;
  square_image: string | null;
  horizontal_thumbnail: string | null;
}

function isHighlightWebinarRow(v: unknown): v is HighlightWebinarRow {
  return (
    isObject(v) &&
    isStr(v['id']) &&
    isStr(v['name']) &&
    isStrOrNull(v['short_description']) &&
    isStrOrNull(v['start_date_time']) &&
    isStrOrNull(v['square_image']) &&
    isStrOrNull(v['horizontal_thumbnail'])
  );
}

/**
 * `parse` for `highlight-webinars/`: `{success, message, data:
 * {highlight_webinars: <page>}}`. The ticket shows one webinar, the first in
 * the editorial order; `null` when the rail is empty.
 */
export function parseHighlightWebinar(raw: unknown): HomeWebinar | null {
  const data = isObject(raw) ? raw['data'] : undefined;
  const page = isObject(data) ? data['highlight_webinars'] : undefined;
  const rows = isObject(page) ? page['results'] : undefined;
  if (!Array.isArray(rows)) {
    throw new Error('[home] highlight-webinars response does not match the contract.');
  }

  const row: unknown = rows[0];
  if (row === undefined) return null;
  if (!isHighlightWebinarRow(row)) {
    throw new Error('[home] highlight-webinars row does not match the contract.');
  }

  return {
    id: row.id,
    title: row.name,
    overview: row.short_description,
    // `||`, not `??`: an empty string is missing art, and `ngSrc=""` throws.
    banner: row.square_image || row.horizontal_thumbnail || null,
    sessionStart: row.start_date_time,
  };
}
