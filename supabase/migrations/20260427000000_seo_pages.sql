-- =============================================================================
-- seo_pages — SEO metadata for static and dynamic pages
-- =============================================================================
-- Schema mirrors src/app/shared/core/models/seo.models.ts (interface SeoPage).
-- Run this BEFORE 20260428000000_admin_rbac.sql so the RLS policies in that
-- file find the table.
-- =============================================================================

create table if not exists public.seo_pages (
  id                  uuid primary key default gen_random_uuid(),

  page_slug           text not null unique,
  page_name           text not null,
  page_type           text not null check (page_type in ('static', 'dynamic')),
  is_active           boolean not null default true,

  -- Core SEO
  title               text not null default '',
  description         text not null default '',
  keywords            text[] not null default '{}'::text[],
  robots              text not null default 'index, follow',
  canonical_url       text not null default '',
  author              text not null default '',
  publisher           text not null default 'Miles Masterclass',

  -- Open Graph
  og_title            text not null default '',
  og_description     text not null default '',
  og_image            text not null default '',
  og_type             text not null default 'website',
  og_site_name        text not null default 'Miles Masterclass',
  og_locale           text not null default 'en_US',

  -- Twitter Card
  twitter_card        text not null default 'summary_large_image',
  twitter_site        text not null default '@MilesEducation',
  twitter_creator     text not null default '@MilesEducation',
  twitter_title       text not null default '',
  twitter_description text not null default '',
  twitter_image       text not null default '',
  twitter_image_alt   text not null default '',

  -- Structured Data
  json_ld             jsonb not null default '{}'::jsonb,

  -- Audit
  updated_at          timestamptz not null default now(),
  updated_by          text not null default 'system',
  notes               text not null default ''
);

create index if not exists seo_pages_slug_idx       on public.seo_pages (page_slug);
create index if not exists seo_pages_is_active_idx  on public.seo_pages (is_active);
create index if not exists seo_pages_page_type_idx  on public.seo_pages (page_type);

-- =============================================================================
-- Seed data (idempotent — re-running is safe)
-- =============================================================================
insert into public.seo_pages (
  id, page_slug, page_name, page_type, is_active,
  title, description, keywords, robots, canonical_url, author, publisher,
  og_title, og_description, og_image, og_type, og_site_name, og_locale,
  twitter_card, twitter_site, twitter_creator, twitter_title, twitter_description, twitter_image, twitter_image_alt,
  json_ld, updated_at, updated_by, notes
) values
  ('10098e20-3152-4a07-8c4d-f5b020a49913', 'auth/signup', 'Sign Up', 'static', true,
   '', '', ARRAY[]::text[], 'index, follow', '', '', 'Miles Masterclass',
   '', '', '', 'website', 'Miles Masterclass', 'en_US',
   'summary_large_image', '@MilesEducation', '@MilesEducation', '', '', '', '',
   '{}'::jsonb, '2026-03-01 16:41:36.161245+00', 'system', ''),

  ('4bb689f1-c7f7-4371-ae81-e63e9f0a4baa', 'faq', 'FAQ', 'static', true,
   '', '', ARRAY[]::text[], 'index, follow', '', '', 'Miles Masterclass',
   '', '', '', 'website', 'Miles Masterclass', 'en_US',
   'summary_large_image', '@MilesEducation', '@MilesEducation', '', '', '', '',
   '{}'::jsonb, '2026-03-01 16:41:36.161245+00', 'system', ''),

  ('57be7294-2eea-4acb-90d4-1bfef193e6ad', 'podcast', 'Podcast Listing', 'static', true,
   '', '', ARRAY[]::text[], 'index, follow', '', '', 'Miles Masterclass',
   '', '', '', 'website', 'Miles Masterclass', 'en_US',
   'summary_large_image', '@MilesEducation', '@MilesEducation', '', '', '', '',
   '{}'::jsonb, '2026-03-01 16:41:36.161245+00', 'system', ''),

  ('5d85b20b-c1cf-4270-9423-80491dceea36', 'home', 'Home Page', 'static', true,
   '', '', ARRAY[]::text[], 'index, follow', '', '', 'Miles Masterclass',
   '', '', '', 'website', 'Miles Masterclass', 'en_US',
   'summary_large_image', '@MilesEducation', '@MilesEducation', '', '', '', '',
   '{}'::jsonb, '2026-03-01 16:41:36.161245+00', 'system', ''),

  ('6883fe81-c132-4c4b-a5de-934e5ae3419e', 'webinar', 'Webinar Listing', 'static', true,
   '', '', ARRAY[]::text[], 'index, follow', '', '', 'Miles Masterclass',
   '', '', '', 'website', 'Miles Masterclass', 'en_US',
   'summary_large_image', '@MilesEducation', '@MilesEducation', '', '', '', '',
   '{}'::jsonb, '2026-03-01 16:41:36.161245+00', 'system', ''),

  ('71bf2484-40bd-4959-8ab0-00a6a3dc38c2', 'library/course-library', 'Course Library', 'static', true,
   '', '', ARRAY[]::text[], 'index, follow', '', '', 'Miles Masterclass',
   '', '', '', 'website', 'Miles Masterclass', 'en_US',
   'summary_large_image', '@MilesEducation', '@MilesEducation', '', '', '', '',
   '{}'::jsonb, '2026-03-01 16:41:36.161245+00', 'system', ''),

  ('73d8f659-117b-4a19-9dd5-ee10b6851ce4', 'auth/login', 'Login', 'static', true,
   'LOGIN | AUTH | MILES MASTERCLASS', 'Login to Miles Masterclass CPE and boooooom.',
   ARRAY['Login','SIgnup','Auth','OTP','Password']::text[],
   'index, follow', 'https://miles-masterclass-v3.vercel.app/auth/login', 'Miles Masterclass', 'Miles Masterclass',
   'LOGIN | AUTH | MILES MASTERCLASS', 'Login to Miles Masterclass CPE and boooooom.',
   'https://qpkzpjtbxtlairnawkco.supabase.co/storage/v1/object/public/seo-images/seo/1773041651693-r9dw30ddn5.webp',
   'website', 'Miles Masterclass', 'en_US',
   'summary_large_image', '@MilesEducation', '@MilesEducation',
   'LOGIN | AUTH | MILES MASTERCLASS', 'Login to Miles Masterclass CPE and boooooom.',
   'https://qpkzpjtbxtlairnawkco.supabase.co/storage/v1/object/public/seo-images/seo/1773041651693-r9dw30ddn5.webp',
   'LOGIN Test',
   '{}'::jsonb, '2026-03-09 07:34:20.746+00', 'admin', ''),

  ('8755c265-ba63-4830-8477-84031a4da2ee', 'masterclass', 'Masterclass Listing', 'static', true,
   '', '', ARRAY[]::text[], 'index, follow', '', '', 'Miles Masterclass',
   '', '', '', 'website', 'Miles Masterclass', 'en_US',
   'summary_large_image', '@MilesEducation', '@MilesEducation', '', '', '', '',
   '{}'::jsonb, '2026-03-01 16:41:36.161245+00', 'system', ''),

  ('ae879f27-7e8e-4a3a-8921-db89fe6441ba', 'podcast/:courseId/:courseTitle', 'Podcast Course (Dynamic)', 'dynamic', true,
   'Think Plan Grow with AI | Podcast | Miles Masterclass',
   E'AI in accounting: Think→Plan→Grow -shift mindsets, appoint an AI champion, quick wins, standardize, secure data, evolve to platforms & agents.\n',
   ARRAY['Mindset shifts','AI champion setup','Low-friction wins & standardized workflows','Governance & data protection','Agentic AI']::text[],
   'index, follow',
   'https://miles-masterclass-v3.vercel.app/in/accounting/podcast/190/think-plan-grow-with-ai',
   'Miles Masterclass', 'Miles Masterclass',
   'Think Plan Grow with AI | Podcast | Miles Masterclass',
   E'AI in accounting: Think→Plan→Grow -shift mindsets, appoint an AI champion, quick wins, standardize, secure data, evolve to platforms & agents.\n',
   'https://storage.googleapis.com/masterclass-bucket-usa2/media/static/banner/Gary_Boomer.webp',
   'website', 'Miles Masterclass', 'en_US',
   'summary_large_image', '@MilesEducation', '@MilesEducation',
   'Think Plan Grow with AI | Podcast | Miles Masterclass',
   E'AI in accounting: Think→Plan→Grow -shift mindsets, appoint an AI champion, quick wins, standardize, secure data, evolve to platforms & agents.\n',
   'https://storage.googleapis.com/masterclass-bucket-usa2/media/static/banner/Gary_Boomer.webp',
   'https://storage.googleapis.com/masterclass-bucket-usa2/media/static/banner/Gary_Boomer.webp',
   '{}'::jsonb, '2026-03-02 03:55:41.739+00', 'admin', ''),

  ('b4eb1748-6158-465b-8c96-c4e7fd477fb1', 'library/instructor-library', 'Instructor Library', 'static', true,
   '', '', ARRAY[]::text[], 'index, follow', '', '', 'Miles Masterclass',
   '', '', '', 'website', 'Miles Masterclass', 'en_US',
   'summary_large_image', '@MilesEducation', '@MilesEducation', '', '', '', '',
   '{}'::jsonb, '2026-03-01 16:41:36.161245+00', 'system', ''),

  ('becb8fe8-6bc6-40d0-92c3-4c1b3ac746fb', 'payment/plan', 'Payment Plans', 'static', true,
   '', '', ARRAY[]::text[], 'index, follow', '', '', 'Miles Masterclass',
   '', '', '', 'website', 'Miles Masterclass', 'en_US',
   'summary_large_image', '@MilesEducation', '@MilesEducation', '', '', '', '',
   '{}'::jsonb, '2026-03-01 16:41:36.161245+00', 'system', ''),

  ('e34604ee-d69b-4dba-84e6-f16df85afaa1', 'micro-learning', 'Micro Learning Listing', 'static', true,
   '', '', ARRAY[]::text[], 'index, follow', '', '', 'Miles Masterclass',
   '', '', '', 'website', 'Miles Masterclass', 'en_US',
   'summary_large_image', '@MilesEducation', '@MilesEducation', '', '', '', '',
   '{}'::jsonb, '2026-03-01 16:41:36.161245+00', 'system', ''),

  ('e438695b-d019-4821-b5dc-66fca16d35cc', 'terms-of-service', 'Terms of Service', 'static', true,
   '', '', ARRAY[]::text[], 'index, follow', '', '', 'Miles Masterclass',
   '', '', '', 'website', 'Miles Masterclass', 'en_US',
   'summary_large_image', '@MilesEducation', '@MilesEducation', '', '', '', '',
   '{}'::jsonb, '2026-03-01 16:41:36.161245+00', 'system', ''),

  ('f201eec2-b39c-488a-81fd-1e4dc073aaa5', 'masterclass/:courseId/:courseTitle', 'Masterclass Course (Dynamic)', 'dynamic', true,
   '', '', ARRAY[]::text[], 'index, follow', '', '', 'Miles Masterclass',
   '', '', '', 'website', 'Miles Masterclass', 'en_US',
   'summary_large_image', '@MilesEducation', '@MilesEducation', '', '', '', '',
   '{}'::jsonb, '2026-03-01 16:41:36.161245+00', 'system', ''),

  ('f3d58e60-24b5-4b33-8500-77ba38e2b907', 'library/badge-library', 'Badge Library', 'static', true,
   '', '', ARRAY[]::text[], 'index, follow', '', '', 'Miles Masterclass',
   '', '', '', 'website', 'Miles Masterclass', 'en_US',
   'summary_large_image', '@MilesEducation', '@MilesEducation', '', '', '', '',
   '{}'::jsonb, '2026-03-01 16:41:36.161245+00', 'system', ''),

  ('f9c6f02e-c57c-4a2d-a2e3-f1e3fae43c78', 'library/ai-library', 'AI Library', 'static', true,
   '', '', ARRAY[]::text[], 'index, follow', '', '', 'Miles Masterclass',
   '', '', '', 'website', 'Miles Masterclass', 'en_US',
   'summary_large_image', '@MilesEducation', '@MilesEducation', '', '', '', '',
   '{}'::jsonb, '2026-03-01 16:41:36.161245+00', 'system', '')
on conflict (id) do nothing;
