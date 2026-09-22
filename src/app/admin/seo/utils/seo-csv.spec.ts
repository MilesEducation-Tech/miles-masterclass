import { parseSeoCsv, serializeSeoCsv, validateSeoRow, SEO_CSV_TEMPLATE } from './seo-csv';
import { createDefaultSeoPage } from '@core/models/seo.models';

describe('seo-csv', () => {
  describe('validateSeoRow', () => {
    it('accepts a page with slug, name, and valid type', () => {
      expect(validateSeoRow(createDefaultSeoPage('home', 'Home', 'static'))).toBeNull();
    });

    it('rejects a blank slug', () => {
      expect(validateSeoRow(createDefaultSeoPage('', 'Home', 'static'))).toBe('Missing page_slug');
    });

    it('rejects a blank name', () => {
      expect(validateSeoRow(createDefaultSeoPage('home', '', 'static'))).toBe('Missing page_name');
    });
  });

  describe('parseSeoCsv', () => {
    it('parses a valid row and splits keywords on "|"', () => {
      const csv = 'page_slug,page_name,page_type,keywords\nabout,About Us,static,a|b|c';
      const rows = parseSeoCsv(csv);
      expect(rows.length).toBe(1);
      expect(rows[0].error).toBeNull();
      expect(rows[0].page.page_slug).toBe('about');
      expect(rows[0].page.keywords).toEqual(['a', 'b', 'c']);
    });

    it('strips a leading slash from the slug', () => {
      const rows = parseSeoCsv('page_slug,page_name\n/about,About');
      expect(rows[0].page.page_slug).toBe('about');
    });

    it('handles a quoted cell containing a comma', () => {
      const csv = 'page_slug,page_name,title\nabout,About,"Hello, world"';
      const rows = parseSeoCsv(csv);
      expect(rows[0].error).toBeNull();
      expect(rows[0].page.title).toBe('Hello, world');
    });

    it('flags a missing-slug row', () => {
      const rows = parseSeoCsv('page_slug,page_name\n,No Slug');
      expect(rows[0].error).toBe('Missing page_slug');
    });

    it('flags a row with malformed JSON-LD but keeps it', () => {
      const csv = 'page_slug,page_name,json_ld\nabout,About,"{ not json }"';
      const rows = parseSeoCsv(csv);
      expect(rows.length).toBe(1);
      expect(rows[0].error).toBe('Invalid JSON-LD');
      expect(rows[0].jsonLdText).toBe('{ not json }');
    });

    it('returns [] for a header-only file', () => {
      expect(parseSeoCsv('page_slug,page_name')).toEqual([]);
    });
  });

  describe('serialize / parse round-trip', () => {
    it('survives a round trip for slug, keywords, and json_ld', () => {
      const page = {
        ...createDefaultSeoPage('promo/x', 'Promo X', 'static'),
        title: 'A, B and "C"',
        keywords: ['one', 'two'],
        json_ld: { '@type': 'WebPage' } as Record<string, unknown>,
      };
      const rows = parseSeoCsv(serializeSeoCsv([page]));
      expect(rows[0].error).toBeNull();
      expect(rows[0].page.page_slug).toBe('promo/x');
      expect(rows[0].page.title).toBe('A, B and "C"');
      expect(rows[0].page.keywords).toEqual(['one', 'two']);
      expect(rows[0].page.json_ld).toEqual({ '@type': 'WebPage' });
    });
  });

  describe('SEO_CSV_TEMPLATE', () => {
    it('parses cleanly into valid static and dynamic example rows', () => {
      const rows = parseSeoCsv(SEO_CSV_TEMPLATE);
      expect(rows.length).toBe(2);
      expect(rows.every((r) => r.error === null)).toBe(true);
      expect(rows.map((r) => r.page.page_type)).toEqual(['static', 'dynamic']);
      expect(rows[1].page.slug_pattern).toBe('podcast/:courseId/:courseTitle');
    });
  });
});
