import { CairaStatusEnvelope, CairaUuid } from './envelope.model';

/**
 * L1 · `GET caira/masterclass/levels-page/` — the CAIRA level tabs and the FAQ.
 *
 * Two reads on one path. Bare, it returns the whole tree
 * (`data.levels[].sections[].items[]`); with `?type=<section title>` it returns
 * **`data` as a flat array of sections** instead. The shipped LMS handles both
 * shapes in one branch because it reuses the FAQ finder across them; they are
 * modelled separately here so a call site cannot read the wrong one.
 *
 * Every array and every image is optional. That is not defensive typing for its
 * own sake — the LMS carries a load-bearing comment at this exact call site:
 * a raw `levels[0]` throws *after* state is partly set and before the view is
 * marked, leaving the page blank below the fold. The mappers below never index
 * without a guard.
 *
 * ponytail: `LevelsPageSection.image_url` is the key the LMS reads first, but it
 * then falls back to scanning the section's other keys for anything
 * image-shaped — so the real field name is not settled. Confirm against a live
 * capture (`docs/caira-contracts/04-levels-page.json`) before relying on it.
 */

// ---------------------------------------------------------------------------
// Wire shapes
// ---------------------------------------------------------------------------

/** One learning objective inside a section. `order` is the displayed number. */
export interface LevelsPageItem {
  id?: CairaUuid;
  order?: number | null;
  title?: string | null;
  description?: string | null;
}

/** One card in the level's accordion. The FAQ arrives as a section like any other. */
export interface LevelsPageSection {
  id?: CairaUuid;
  title?: string | null;
  image_url?: string | null;
  items?: LevelsPageItem[] | null;
}

export interface LevelsPageLevel {
  id?: CairaUuid;
  level_name?: string | null;
  level_image_url?: string | null;
  subtitle?: string | null;
  sections?: LevelsPageSection[] | null;
}

/** The bare read: the full tree under the boolean-status envelope. */
export type LevelsPageResponse = CairaStatusEnvelope<{
  data?: {
    title?: string | null;
    levels?: LevelsPageLevel[] | null;
  } | null;
}>;

/**
 * The `?type=` read. `data` is a flat section array here — but the backend has
 * been observed returning the full tree for an unmatched `type`, so the union
 * carries both and `toFaqEntries` narrows.
 */
export type LevelsPageFilteredResponse = CairaStatusEnvelope<{
  data?: LevelsPageSection[] | { levels?: LevelsPageLevel[] | null } | null;
}>;

/** The `type` value that selects the FAQ section. Sent verbatim as a query param. */
export const FAQ_SECTION_TYPE = 'Frequently Asked Questions';

// ---------------------------------------------------------------------------
// View models
// ---------------------------------------------------------------------------

export interface LevelObjective {
  order: number;
  title: string;
  description: string;
}

export interface LevelCard {
  id: CairaUuid;
  title: string;
  /** `null`, never `''` — `ngSrc=""` throws NG02952 and kills the render. */
  posterUrl: string | null;
  objectives: LevelObjective[];
}

export interface LevelTab {
  id: CairaUuid;
  name: string;
  iconUrl: string | null;
  subtitle: string | null;
  cards: LevelCard[];
}

export interface FaqEntry {
  question: string;
  answer: string;
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

/** Empty string is not a URL. See `LevelCard.posterUrl`. */
function img(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function toObjective(item: LevelsPageItem, index: number): LevelObjective {
  return {
    // `order` is what the design numbers each row with; fall back to position
    // so a section missing it still renders 1, 2, 3 rather than blanks.
    order: item.order ?? index + 1,
    title: item.title ?? '',
    description: item.description ?? '',
  };
}

function toCard(section: LevelsPageSection, index: number): LevelCard {
  return {
    id: section.id ?? `section-${index}`,
    title: section.title ?? '',
    posterUrl: img(section.image_url),
    objectives: (section.items ?? []).map(toObjective),
  };
}

/**
 * The level tabs, in server order.
 *
 * Returns `[]` for a failed, empty or half-shaped response — the section is
 * `@if`-guarded, so an empty array is the empty state.
 */
export function toLevelTabs(response: LevelsPageResponse | undefined): LevelTab[] {
  return (response?.data?.levels ?? []).map((level, index) => ({
    id: level.id ?? `level-${index}`,
    name: level.level_name ?? '',
    iconUrl: img(level.level_image_url),
    subtitle: level.subtitle?.trim() || null,
    cards: (level.sections ?? []).map(toCard),
  }));
}

/** The heading above the tabs. `null` lets the caller keep its own default. */
export function toLevelsPageTitle(response: LevelsPageResponse | undefined): string | null {
  return response?.data?.title?.trim() || null;
}

function isFaqSection(section: LevelsPageSection | undefined): boolean {
  return /frequently asked questions/i.test(section?.title ?? '');
}

/**
 * The FAQ accordion.
 *
 * The section repeats per level, so the first match wins — matching the LMS.
 * Both response shapes are accepted: a flat section array (the `?type=` answer)
 * and the full tree (what an unmatched `type` falls back to).
 */
export function toFaqEntries(response: LevelsPageFilteredResponse | undefined): FaqEntry[] {
  const data = response?.data;
  if (!data) return [];

  const sections: LevelsPageSection[] = Array.isArray(data)
    ? data
    : (data.levels ?? []).flatMap((level) => level.sections ?? []);

  const faq = sections.find(isFaqSection);
  return (faq?.items ?? [])
    .map((item) => ({ question: item.title ?? '', answer: item.description ?? '' }))
    .filter((entry) => entry.question !== '');
}
