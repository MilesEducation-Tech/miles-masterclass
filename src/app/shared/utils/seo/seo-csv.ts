import { createDefaultSeoPage, SeoPage } from '../../core/models/seo.models';
import { SeoPageType } from '../../core/models/seo.constants';

/**
 * One parsed CSV row for the bulk-upload preview. `jsonLdText` is kept as raw
 * text (not the parsed object) so the JSON-LD cell stays freely editable in the
 * preview grid; it is parsed into `page.json_ld` on demand. `error` is the
 * human-readable validation reason, or `null` when the row is importable.
 */
export interface SeoRow {
  page: SeoPage;
  error: string | null;
  jsonLdText: string;
}

/**
 * Columns supported by the bulk upload, in template order. These are the flat
 * `SeoPage` fields an admin realistically edits in bulk; audit fields
 * (`id`, `updated_at`, `updated_by`) are managed by the backend/service.
 */
export const SEO_CSV_COLUMNS = [
  'page_slug',
  'page_name',
  'page_type',
  'is_active',
  'slug_pattern',
  'title',
  'description',
  'keywords',
  'robots',
  'canonical_url',
  'author',
  'publisher',
  'og_title',
  'og_description',
  'og_image',
  'og_type',
  'og_site_name',
  'og_locale',
  'twitter_card',
  'twitter_site',
  'twitter_creator',
  'twitter_title',
  'twitter_description',
  'twitter_image',
  'twitter_image_alt',
  'json_ld',
  'notes',
] as const;

type SeoCsvColumn = (typeof SEO_CSV_COLUMNS)[number];

/** Keywords are packed into a single cell, `|`-separated (commas collide with CSV). */
const KEYWORD_SEPARATOR = '|';

/**
 * Single source of truth for row validity, shared by the parser and the inline
 * preview editor so the two can't drift. Returns a reason, or `null` if valid.
 * JSON-LD validity is handled at the cell level (see `parseJsonLd`), not here.
 */
export function validateSeoRow(page: SeoPage): string | null {
  if (!page.page_slug.trim()) return 'Missing page_slug';
  if (!page.page_name.trim()) return 'Missing page_name';
  if (page.page_type !== 'static' && page.page_type !== 'dynamic') {
    return 'page_type must be "static" or "dynamic"';
  }
  return null;
}

/** Parse a JSON-LD cell. Blank → `{}`. Throws with a friendly message on bad JSON. */
function parseJsonLd(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  if (!trimmed) return {};
  const parsed = JSON.parse(trimmed);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('JSON-LD must be an object');
  }
  return parsed as Record<string, unknown>;
}

function toBool(value: string): boolean {
  const v = value.trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}

/**
 * Parse CSV text into preview rows. Never drops a row — invalid rows come back
 * with a populated `error` so they surface in the preview and can be fixed
 * inline. Returns `[]` if the file has no data rows.
 */
export function parseSeoCsv(text: string): SeoRow[] {
  const table = parseCsv(text);
  if (table.length < 2) return [];

  const header = table[0].map((h) => h.trim());
  const rows: SeoRow[] = [];

  for (let i = 1; i < table.length; i++) {
    const cells = table[i];
    // Skip fully blank lines (e.g. a trailing newline).
    if (cells.every((c) => c.trim() === '')) continue;

    const get = (col: SeoCsvColumn): string => {
      const idx = header.indexOf(col);
      return idx >= 0 ? (cells[idx] ?? '') : '';
    };

    const slug = get('page_slug').trim().replace(/^\//, '');
    const name = get('page_name').trim();
    const typeRaw = get('page_type').trim().toLowerCase();
    const type: SeoPageType = typeRaw === 'dynamic' ? 'dynamic' : 'static';

    // Start from the branded defaults so any omitted column is sensible.
    const page = createDefaultSeoPage(slug, name, type);
    const jsonLdText = get('json_ld');

    // Overlay every present, non-blank text column onto the default.
    const isActiveRaw = get('is_active');
    page.is_active = isActiveRaw.trim() === '' ? true : toBool(isActiveRaw);
    page.slug_pattern = get('slug_pattern').trim() || null;
    page.title = get('title');
    page.description = get('description');
    page.keywords = get('keywords')
      .split(KEYWORD_SEPARATOR)
      .map((k) => k.trim())
      .filter(Boolean);
    overlay(page, 'robots', get('robots'));
    page.canonical_url = get('canonical_url');
    page.author = get('author');
    overlay(page, 'publisher', get('publisher'));
    page.og_title = get('og_title');
    page.og_description = get('og_description');
    page.og_image = get('og_image');
    overlay(page, 'og_type', get('og_type'));
    overlay(page, 'og_site_name', get('og_site_name'));
    overlay(page, 'og_locale', get('og_locale'));
    overlay(page, 'twitter_card', get('twitter_card'));
    overlay(page, 'twitter_site', get('twitter_site'));
    overlay(page, 'twitter_creator', get('twitter_creator'));
    page.twitter_title = get('twitter_title');
    page.twitter_description = get('twitter_description');
    page.twitter_image = get('twitter_image');
    page.twitter_image_alt = get('twitter_image_alt');
    page.notes = get('notes');

    let error: string | null = null;
    try {
      page.json_ld = parseJsonLd(jsonLdText);
    } catch {
      error = 'Invalid JSON-LD';
    }
    error = error ?? validateSeoRow(page);

    rows.push({ page, error, jsonLdText });
  }

  return rows;
}

/** Only overwrite a defaulted field when the CSV cell is non-blank. */
function overlay(
  page: SeoPage,
  key:
    | 'robots'
    | 'publisher'
    | 'og_type'
    | 'og_site_name'
    | 'og_locale'
    | 'twitter_card'
    | 'twitter_site'
    | 'twitter_creator',
  value: string,
): void {
  if (value.trim() !== '') page[key] = value;
}

/** Serialize pages back to CSV (used for the template and round-trip export). */
export function serializeSeoCsv(pages: SeoPage[]): string {
  const lines = [SEO_CSV_COLUMNS.join(',')];
  for (const page of pages) {
    const cells = SEO_CSV_COLUMNS.map((col) => cellFor(page, col));
    lines.push(cells.map(escapeCell).join(','));
  }
  return lines.join('\r\n');
}

function cellFor(page: SeoPage, col: SeoCsvColumn): string {
  if (col === 'keywords') return page.keywords.join(KEYWORD_SEPARATOR);
  if (col === 'json_ld') {
    return page.json_ld && Object.keys(page.json_ld).length ? JSON.stringify(page.json_ld) : '';
  }
  if (col === 'is_active') return page.is_active ? 'true' : 'false';
  if (col === 'slug_pattern') return page.slug_pattern ?? '';
  return String(page[col] ?? '');
}

/**
 * Downloadable template: the header row plus one example row per page type so
 * admins see the expected shape for each — a static page (concrete slug, no
 * pattern) and a dynamic page (concrete slug plus a `slug_pattern` with
 * `:`-prefixed wildcards). Both demonstrate the keyword `|` separator and
 * inline JSON-LD.
 */
export const SEO_CSV_TEMPLATE = serializeSeoCsv([
  {
    ...createDefaultSeoPage('promo/example-static-page', 'Example Static Page', 'static'),
    title: 'Example Static Page Title — 30 to 60 chars',
    description:
      'A 70–160 char meta description summarizing the page and ending with a call to action.',
    keywords: ['keyword one', 'keyword two', 'keyword three'],
    canonical_url: 'https://www.milesmasterclass.com/promo/example-static-page',
    og_title: 'Example Static Page',
    og_description: 'Open Graph description for social shares.',
    json_ld: { '@context': 'https://schema.org', '@type': 'WebPage', name: 'Example Static Page' },
  },
  {
    ...createDefaultSeoPage('podcast/example-dynamic-page', 'Example Dynamic Page', 'dynamic'),
    // Dynamic rows carry a slug_pattern: `:`-prefixed segments match any value,
    // literal segments must match exactly (e.g. podcast/123/intro-to-tax).
    slug_pattern: 'podcast/:courseId/:courseTitle',
    title: 'Example Dynamic Page Title — 30 to 60 chars',
    description:
      'Meta description for a templated route; the pattern matches every URL that fits its shape.',
    keywords: ['dynamic keyword', 'course', 'podcast'],
    canonical_url: 'https://www.milesmasterclass.com/podcast/example-dynamic-page',
    og_title: 'Example Dynamic Page',
    og_description: 'Open Graph description for a dynamic route.',
    json_ld: { '@context': 'https://schema.org', '@type': 'WebPage', name: 'Example Dynamic Page' },
  },
]);

// ---------------------------------------------------------------------------
// ponytail: hand-rolled RFC-4180-lite CSV parser (quoted fields, embedded
// commas/newlines, "" escaping, CRLF). Swap for papaparse only if users hit an
// edge this misses. Keeps the feature dependency-free.
// ---------------------------------------------------------------------------

/** Parse CSV text into a 2D array of raw cell strings. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  // Strip a leading BOM (Excel adds one when saving CSV as UTF-8).
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];

    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++; // consume the escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      // Handle CRLF as one break; skip the \n after a \r.
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }

  // Flush the final cell/row if the file didn't end with a newline.
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

/** Quote a cell when it contains a comma, quote, or newline; double inner quotes. */
function escapeCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
