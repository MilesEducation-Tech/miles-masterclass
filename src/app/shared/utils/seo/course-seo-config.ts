import { COURSE_BRAND_NAMES } from '../../core/models/seo.constants';
import { SeoConfig } from '../../core/models/seo.models';

export type CourseSeoKind = 'masterclass' | 'podcast' | 'microLearning';

const TITLE_SUFFIX: Record<CourseSeoKind, string> = {
  masterclass: `| ${COURSE_BRAND_NAMES.masterclass}`,
  podcast: `| ${COURSE_BRAND_NAMES.podcast}`,
  microLearning: `| ${COURSE_BRAND_NAMES.microLearning}`,
};

/**
 * Source of fallback SEO data — masterclass/podcast pages pass `any`,
 * micro-learning passes `MicroLearningReel` (which extends `any`). Both
 * carry the fields we use here, with `course_overview` only on `any`
 * and `trailer_link` optional on both.
 */
export type CourseSeoSource = any | (any & { trailer_link?: string | null });

/**
 * Build a fallback `SeoConfig` from a populated course/reel record. Used by the
 * masterclass, podcast, and micro-learning detail pages so the page has
 * plausible OG/Twitter metadata even before any Supabase override resolves.
 */
export function courseToSeoConfig(course: CourseSeoSource, kind: CourseSeoKind): SeoConfig {
  const longOverview = 'course_overview' in course ? course.course_overview : undefined;
  const description = course.course_short_overview || longOverview || undefined;
  const image = course.horizontal_thumbnail || course.thumbnail || undefined;
  const author = course.instructor_details
    ? `${course.instructor_details.first_name} ${course.instructor_details.last_name}`.trim()
    : undefined;

  return {
    title: `${course.title} ${TITLE_SUFFIX[kind]}`.trim(),
    description,
    image,
    author,
    openGraph: {
      title: course.title,
      description,
      image,
      video: course.trailer_link || undefined,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: course.title,
      description,
      image,
    },
  };
}
