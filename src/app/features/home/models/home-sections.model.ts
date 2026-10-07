/**
 * The data the home page's presentational sections render. Nothing here is
 * fetched yet: the pricing card and the webinar ticket are designed and
 * flagged, and their reads arrive once the web-api endpoints exist (see
 * prompts/home-redesign.md, "API flags"). Until then the page binds nothing and
 * the Storybook stories feed these shapes from `@testing/mocks/home.mock`.
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
  /** The webinar's id, as `Utils.navigateToCourse('webinar', id, title)` wants it. */
  id: number;
  title: string;
  overview: string | null;
  /** Square art preferred (the ticket's left card is square); `null` shows the design's banner. */
  banner: string | null;
  /** ISO start of the live session, else the next upcoming one; `null` when none is scheduled. */
  sessionStart: string | null;
}
