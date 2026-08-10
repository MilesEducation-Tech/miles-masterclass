import {
  CourseDetailPayload,
  DetailChapter,
  EnrollmentResponse,
  courseProgressPercent,
  relatedToCard,
  toChapterViews,
  toCourseDetailCard,
  toInstructorProfile,
} from './course-detail.model';
import { CourseStatus } from './masterclass.model';
import { SEO_BRAND_DEFAULTS } from '../seo.constants';

const UUID = '3f1c9a20-0000-4000-8000-000000000001';

function chapter(overrides: Partial<DetailChapter> = {}): DetailChapter {
  return {
    id: 'chapter-1',
    name: 'Chapter one',
    mini_description: 'About it',
    order: 1,
    duration_seconds: 600,
    total_quiz_questions: 5,
    horizontal_thumbnail_url: 'https://cdn.test/ch1.webp',
    vertical_thumbnail_url: null,
    square_thumbnail_url: null,
    hls_video_url: 'https://cdn.test/ch1.m3u8',
    transcript_text: 'hello',
    is_locked: false,
    show_quiz: true,
    user_chapter_progress: {
      is_video_completed: true,
      is_video_seekable: true,
      is_mcq_completed: true,
      is_chapter_completed: true,
      last_watched_position_seconds: 600,
      current_watched_duration_seconds: 600,
      max_watched_duration_seconds: 600,
      completed_at: '2026-01-01T00:00:00Z',
      quiz_attempted: true,
    },
    instructors: null,
    ...overrides,
  };
}

/** A #4 body with the keys the mappers read; everything else stays minimal. */
function payload(overrides: Partial<CourseDetailPayload> = {}): CourseDetailPayload {
  return {
    id: UUID,
    Masterclass_Course_Name: 'Think, Plan, Grow with AI',
    Masterclass_Course_Description: 'The long one',
    Masterclass_Course_Mini_Description: 'The short one',
    Masterclass_Course_Horizontal_Thumbnail_URL: 'https://cdn.test/h.webp',
    Masterclass_Course_Vertical_Thumbnail_URL: null,
    Masterclass_Course_Square_Thumbnail_URL: 'https://cdn.test/s.webp',
    subject: { id: 'sub-1', name: 'Accounting' },
    level: [{ id: 'lvl-1', name: 'Level 1', level_number: 1 }],
    tracks: null,
    topics: [{ id: 't-1', CAIRA_Masterclass_Topic_Name: 'Prompting' }],
    fields_of_study: [
      { id: 'f-1', CAIRA_Masterclass_Field_Of_Study_Name: 'Accounting' },
      { id: 'f-2', CAIRA_Masterclass_Field_Of_Study_Name: 'Technology' },
    ],
    instructors: [
      {
        id: 'ins-1',
        CAIRA_Masterclass_Instructor_Name: 'Ada Lovelace',
        CAIRA_Masterclass_Instructor_Designation: 'CPA',
        CAIRA_Masterclass_Instructor_Horizontal_Image_URL: '',
        CAIRA_Masterclass_Instructor_Vertical_Image_URL: null,
        CAIRA_Masterclass_Instructor_Square_Image_URL: null,
      },
    ],
    tags: null,
    skills: null,
    tools: null,
    trailer_video_url: 'https://cdn.test/trailer.mp4',
    trailer_thumbnail_url: null,
    masterclass_duration: '',
    glossary_file_url: null,
    exercise_file_url: null,
    learning_objectives: [
      { id: 'o-2', title: 'Second', description: '', order: 2 },
      { id: 'o-1', title: 'First', description: '', order: 1 },
    ],
    exam_rules: 'Rule one',
    prerequisite_education: 'None',
    advance_preparation: '',
    ai_kit: null,
    is_course_closed: false,
    show_final_assessment: false,
    show_feedback: false,
    show_credly_badge: false,
    show_credit: false,
    final_assessment_submitted: false,
    feedback_submitted: false,
    feedback_average: null,
    masterclass_certificate_generated: false,
    masterclass_certificate_url: null,
    credly_badge_accepted_url: null,
    credly_badge_image_url: null,
    credly_badge_allocated: false,
    credly_badge_status: null,
    credly_badge_claimed: false,
    credly_assertion_id: null,
    enrollment: null,
    chapters: [chapter()],
    is_bookmarked: true,
    masterclass_reviewed_at: null,
    masterclass_content_created_at: '2026-01-01T00:00:00Z',
    masterclass_content_updated_at: null,
    related_courses: null,
    instructor_related_courses: null,
    course_pop_up_remark: null,
    active_in_challenge: false,
    Masterclass_Course_CPE_Credit: 2,
    show_credly_icon: false,
    credly_badge_name: null,
    masterclass_course_last_user_activity: null,
    course_is_locked: true,
    instructional_delivery_method: 'QAS Self-Study',
    program_level: 'Basic',
    sponser_identification_number: '149174',
    expiration_date: '1 year',
    ...overrides,
  };
}

describe('toCourseDetailCard', () => {
  it('keeps the course id a UUID string', () => {
    // Decision 8. `Number(id)` on this yields NaN, which is why every consumer
    // in the masterclass and podcast trees widened to `CairaUuid`.
    expect(toCourseDetailCard(payload()).id).toBe(UUID);
  });

  it('puts the whole CPE allocation on the first field of study', () => {
    // `TotalCpeCreditsPipe` SUMS this array. Spreading the credit across
    // entries, or mapping `{ name }` alone, makes the hero read "0 CPE".
    const fields = toCourseDetailCard(payload()).fields_of_study;
    expect(fields.map((f) => f.cpe_credits)).toEqual([2, 0]);
    expect(fields.map((f) => f.name)).toEqual(['Accounting', 'Technology']);
  });

  it('never leaves a still image empty — `ngSrc` is bound unguarded', () => {
    const bare = toCourseDetailCard(
      payload({
        Masterclass_Course_Horizontal_Thumbnail_URL: '',
        Masterclass_Course_Square_Thumbnail_URL: null,
      }),
    );
    expect(bare.thumbnail).toBe(SEO_BRAND_DEFAULTS.fallbackImage);
    expect(bare.horizontal_thumbnail).toBe(SEO_BRAND_DEFAULTS.fallbackImage);
    expect(bare.square_thumbnail).toBe(SEO_BRAND_DEFAULTS.fallbackImage);
  });

  it('orders learning objectives by `order`, not by array position', () => {
    expect(toCourseDetailCard(payload()).learning_objective_list).toEqual(['First', 'Second']);
  });

  it('hides the CPE-mode control and the pricing block', () => {
    // CAIRA has neither a preview/CPE mode nor any commerce model; both
    // template branches must stay dormant rather than render dead controls.
    const card = toCourseDetailCard(payload());
    expect(card.cpe_mode_details).toBeNull();
    expect(card.is_free).toBe(false);
    expect(card.can_purchase_individually).toBe(false);
    expect(card.is_subscription_excluded).toBe(false);
  });

  it('prefers #14 over #4 for the enrollment window', () => {
    // #4 is cached per user over a global base key, so its `enrollment` block
    // can lag a chapter start by the whole TTL. #14 reads through.
    const fresh: EnrollmentResponse = {
      course_id: UUID,
      is_enrolled: true,
      is_course_closed: true,
      started_at: '2026-01-01T00:00:00Z',
      expires_at: '2027-01-01T00:00:00Z',
      days_remaining: null,
      is_expired: false,
    };
    const stale = payload({ is_course_closed: false, enrollment: null });

    expect(toCourseDetailCard(stale).course_status).toBe(CourseStatus.NOT_STARTED);

    const card = toCourseDetailCard(stale, fresh);
    expect(card.is_course_closed).toBe(true);
    expect(card.course_status).toBe(CourseStatus.CLOSED);
    expect(card.enrollment?.expires_at).toBe('2027-01-01T00:00:00Z');
  });

  it('reads the bookmark state #4 carries — no list endpoint reports it', () => {
    expect(toCourseDetailCard(payload()).added_bookmark).toBe(true);
    expect(
      relatedToCard({
        id: 'rel-1',
        name: 'Related',
        mini_description: '',
        thumbnail_url: null,
        duration: null,
        cpe_credit: 1,
        field_of_study: null,
      }).added_bookmark,
    ).toBe(false);
  });
});

describe('toChapterViews', () => {
  it('drops the progress row when a chapter is locked', () => {
    // Every `user_chapter_progress` key is null on a locked chapter, and the
    // list template divides by `video_duration` only when `play_history` exists.
    const locked = chapter({
      id: 'chapter-2',
      is_locked: true,
      hls_video_url: null,
      user_chapter_progress: {
        is_video_completed: null,
        is_video_seekable: null,
        is_mcq_completed: null,
        is_chapter_completed: null,
        last_watched_position_seconds: null,
        current_watched_duration_seconds: null,
        max_watched_duration_seconds: null,
        completed_at: null,
        quiz_attempted: null,
      },
    });
    const [view] = toChapterViews(payload({ chapters: [locked] }));
    expect(view.play_history).toBeNull();
    expect(view.is_locked).toBe(true);
  });

  it('falls back to the course artwork for a chapter with no poster', () => {
    // `[ngSrc]` is bound with no `@if`; an empty value throws NG02952 and kills
    // the whole render, so the fallback chain has to end at a real URL.
    const [view] = toChapterViews(
      payload({ chapters: [chapter({ horizontal_thumbnail_url: '' })] }),
    );
    expect(view.chapter_thumbnail).toBe('https://cdn.test/h.webp');
  });

  it('sorts by `order`', () => {
    const views = toChapterViews(
      payload({
        chapters: [chapter({ id: 'b', order: 2 }), chapter({ id: 'a', order: 1 })],
      }),
    );
    expect(views.map((v) => v.id)).toEqual(['a', 'b']);
  });
});

describe('courseProgressPercent', () => {
  it('counts completed chapters', () => {
    const views = toChapterViews(
      payload({
        chapters: [
          chapter({ id: 'a', order: 1 }),
          chapter({ id: 'b', order: 2, is_locked: true, user_chapter_progress: null }),
        ],
      }),
    );
    expect(courseProgressPercent(views)).toBe(50);
    expect(courseProgressPercent([])).toBe(0);
  });
});

describe('toInstructorProfile', () => {
  it('flattens the social-media collection into the four link fields', () => {
    // #16 is un-enveloped and its serializer prefetches `social_media_links`
    // rather than returning the old API's flat `*_link` keys.
    const profile = toInstructorProfile({
      id: 'ins-1',
      name: 'Ada Lovelace',
      designation: 'CPA',
      about_me: 'Bio',
      social_media_links: [
        { platform: 'LinkedIn', url: 'https://linkedin.test/ada' },
        { name: 'youtube', link: 'https://youtube.test/ada' },
        { platform: 'Instagram', url: '' },
      ],
    });
    expect(profile.first_name).toBe('Ada');
    expect(profile.last_name).toBe('Lovelace');
    expect(profile.linkedin_link).toBe('https://linkedin.test/ada');
    expect(profile.youtube_link).toBe('https://youtube.test/ada');
    // Empty strings are missing, not a link to the current page.
    expect(profile.instagram_link).toBeNull();
    expect(profile.facebook_link).toBeNull();
  });

  it('accepts the long CAIRA field names too', () => {
    const profile = toInstructorProfile({
      id: 'ins-2',
      CAIRA_Masterclass_Instructor_Name: 'Grace Hopper',
      CAIRA_Masterclass_Instructor_Designation: 'CMA',
      CAIRA_Masterclass_Instructor_Horizontal_Image_URL: 'https://cdn.test/gh.webp',
    });
    expect(profile.first_name).toBe('Grace');
    expect(profile.designation).toBe('CMA');
    expect(profile.horizontal_thumbnail).toBe('https://cdn.test/gh.webp');
  });
});
