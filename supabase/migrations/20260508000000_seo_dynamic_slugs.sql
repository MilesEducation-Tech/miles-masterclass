-- =============================================================================
-- seo_pages: dynamic slug pattern support
-- =============================================================================
-- Background: the previous migration seeded two "dynamic" rows whose
-- `page_slug` was a literal template (`podcast/:courseId/:courseTitle`,
-- `masterclass/:courseId/:courseTitle`). Runtime lookups go through
-- `SupabaseSeo.getBySlug(slug)` which is an exact-equality query — those
-- template rows can therefore never be hit by a real URL like
-- `podcast/190/think-plan-grow-with-ai`, so any admin-edited content on them
-- silently never reaches a crawler.
--
-- This migration:
--   1. Adds an optional `slug_pattern` column. Rows with `slug_pattern` set
--      act as fallbacks when `page_slug` doesn't match exactly.
--   2. Rewrites the existing podcast template row to a concrete slug derived
--      from its `canonical_url`, so its real "Think Plan Grow with AI"
--      content actually serves.
--   3. Converts the empty masterclass template row into a pattern row whose
--      `page_slug` is a sentinel (so the existing UNIQUE(page_slug) holds).
--   4. Adds a partial unique index on `slug_pattern`.
-- =============================================================================

alter table public.seo_pages
  add column if not exists slug_pattern text;

create unique index if not exists seo_pages_slug_pattern_unique_idx
  on public.seo_pages (slug_pattern)
  where slug_pattern is not null;

-- 2. Podcast row: had real "Think Plan Grow" content but a template slug —
--    move it to the concrete slug derived from its canonical_url so runtime
--    lookups actually hit it.
update public.seo_pages
   set page_slug = 'podcast/190/think-plan-grow-with-ai'
 where id = 'ae879f27-7e8e-4a3a-8921-db89fe6441ba'
   and page_slug = 'podcast/:courseId/:courseTitle';

-- 3. Masterclass placeholder: empty content, keep as a pattern fallback so
--    admins can fill in default SEO for *any* masterclass detail page that
--    doesn't have its own concrete row.
update public.seo_pages
   set page_slug    = '_pattern_masterclass_course',
       slug_pattern = 'masterclass/:courseId/:courseTitle',
       page_name    = 'Masterclass Course (Default Pattern)'
 where id = 'f201eec2-b39c-488a-81fd-1e4dc073aaa5'
   and page_slug = 'masterclass/:courseId/:courseTitle';

-- 4. Add a pattern row for podcasts too, for symmetry — admins can later
--    fill it with default podcast SEO. Idempotent: skip if the slug exists.
insert into public.seo_pages (
  page_slug, page_name, page_type, is_active, slug_pattern,
  title, description, keywords, robots, canonical_url, author, publisher,
  og_title, og_description, og_image, og_type, og_site_name, og_locale,
  twitter_card, twitter_site, twitter_creator,
  twitter_title, twitter_description, twitter_image, twitter_image_alt,
  json_ld, updated_by, notes
) values (
  '_pattern_podcast_course', 'Podcast Course (Default Pattern)', 'dynamic', true,
  'podcast/:courseId/:courseTitle',
  '', '', ARRAY[]::text[], 'index, follow', '', '', 'Miles Podcast',
  '', '', '', 'website', 'Miles Podcast', 'en_US',
  'summary_large_image', '@MilesEducation', '@MilesEducation',
  '', '', '', '',
  '{}'::jsonb, 'system', ''
)
on conflict (page_slug) do nothing;

-- 5. Same for micro-learning detail pages (newly wired through setupCourseSeo).
insert into public.seo_pages (
  page_slug, page_name, page_type, is_active, slug_pattern,
  title, description, keywords, robots, canonical_url, author, publisher,
  og_title, og_description, og_image, og_type, og_site_name, og_locale,
  twitter_card, twitter_site, twitter_creator,
  twitter_title, twitter_description, twitter_image, twitter_image_alt,
  json_ld, updated_by, notes
) values (
  '_pattern_micro_learning_course', 'Micro-Learning Reel (Default Pattern)', 'dynamic', true,
  'micro-learning/:courseId/:courseTitle',
  '', '', ARRAY[]::text[], 'index, follow', '', '', 'Miles Micro-Learning',
  '', '', '', 'website', 'Miles Micro-Learning', 'en_US',
  'summary_large_image', '@MilesEducation', '@MilesEducation',
  '', '', '', '',
  '{}'::jsonb, 'system', ''
)
on conflict (page_slug) do nothing;
