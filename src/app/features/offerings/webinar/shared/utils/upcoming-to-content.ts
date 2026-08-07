
/**
 * Adapts an `UpcomingPremiere` (webinar payload) into the `Content` shape so it
 * can be rendered by the existing `<app-horizontal>` / `<app-vertical>` cards
 * used elsewhere in the app.
 *
 * The original `UpcomingPremiere` is stashed on `_webinar` so info-click flows
 * (`Utils.openCourseInfoDialog`) can route to the webinar-specific dialog with
 * the full payload instead of trying to render webinar fields through the
 * masterclass-shaped `CourseInfo` dialog.
 *
 * `allDataFetched` is set to `true` so the cards' info-button skips its
 * `FeatureFacade.getAbout(id, type)` round-trip — webinars don't have an
 * equivalent `getAbout` endpoint in the API surface we know about, and the
 * data we need is already on the home-page payload.
 */
export function upcomingToContent(webinar: any): any {
  const instructor = webinar.instructor_details;
  // Coerce `caira_level: string | null` (webinar) → `number | null` (Content).
  const cairaLevelRaw = webinar.caira_level;
  const cairaLevel: number | null =
    cairaLevelRaw == null
      ? null
      : typeof cairaLevelRaw === 'number'
        ? cairaLevelRaw
        : Number.isFinite(Number(cairaLevelRaw))
          ? Number(cairaLevelRaw)
          : null;

  const fieldsOfStudy: any[] = webinar.fields_of_study ?? [];

  // Note: `course.model.ts` `InstructorDetails` is a DIFFERENT shape from the
  // webinar `InstructorDetails` (course version uses `linkedin?: string`,
  // optional non-null fields, and requires `other_instructors`). Map only the
  // overlapping fields so the cards (which use the course shape) render
  // names + thumbnails correctly.
  const instructorDetails: any = {
    id: instructor.id,
    first_name: instructor.first_name,
    last_name: instructor.last_name,
    designation: instructor.designation,
    about_me: instructor.about_me,
    profile_image: instructor.profile_image,
    horizontal_thumbnail: instructor.horizontal_thumbnail ?? instructor.profile_image,
    promo_video: instructor.promo_video ?? undefined,
    other_instructors: instructor.other_instructors,
  };

  return {
    id: webinar.id,
    title: webinar.webinar_title,
    // `||`, not `??`: the webinar payload uses EMPTY STRINGS for missing
    // artwork, not null, so `??` would hand a `''` straight through to the
    // cards' `ngSrc` and throw NG02952. Fall through to whatever exists.
    thumbnail:
      webinar.vertical_thumbnail || webinar.horizontal_thumbnail || webinar.square_thumbnail || '',
    horizontal_thumbnail:
      webinar.horizontal_thumbnail || webinar.square_thumbnail || webinar.vertical_thumbnail || '',
    square_thumbnail: webinar.square_thumbnail || null,
    course_type: 'webinar',
    // Webinars don't carry a `course_category_details` object on the modern
    // payload — synthesize a minimal one from `fields_of_study` so downstream
    // consumers (e.g. CategoriesList) keep working.
    course_category_details:
      webinar.course_category_details ??
      ({
        id: fieldsOfStudy[0]?.id ?? 0,
        course_name: fieldsOfStudy[0]?.name ?? '',
        icon: '',
        course_category: '',
        description: null,
        updated_by: null,
        profession: null,
      } as any['course_category_details']),
    fields_of_study: fieldsOfStudy,
    has_additional_resources: (webinar.additional_resource?.length ?? 0) > 0,
    course_short_overview: webinar.short_course_overview,
    class_credits: webinar.webinar_credits,
    caira_level: cairaLevel,
    included_for_caira: webinar.included_for_caira ?? false,
    mobile_thumbnail_gif: webinar.thumbnail_gif ?? '',
    thumbnail_gif: webinar.thumbnail_gif ?? '',
    trailer_link: null,
    instructor_details: instructorDetails,
    has_individual_badge: webinar.has_individual_badge,
    allDataFetched: true,
    _webinar: webinar,
  };
}

/**
 * Adapts an `UpcomingPremiere` to the fuller `ContentAbout` shape, which is
 * what `<app-course-about>` (the masterclass detail layout) renders against.
 * Drives the More Info / Learn More dialog so the webinar dialog reuses the
 * same visual structure as masterclass course detail.
 *
 * Many `ContentAbout` fields are masterclass-specific (chapters, learning
 * pathway, glossary, exam-rules); for webinars they collapse to sensible
 * defaults — empty arrays, 0 counts, blank strings — so the corresponding
 * sections render but stay quiet rather than crashing.
 */
export function upcomingToContentAbout(webinar: any): any {
  const base = upcomingToContent(webinar);
  const learningObjectiveList = (webinar.learning_objectives ?? '')
    .split(/\r?\n/)
    .map((s: any) => s.trim())
    .filter(Boolean);
  const createdAt = webinar.created_at;

  return {
    ...base,
    // `Content.allDataFetched` is optional, `ContentAbout.allDataFetched` is
    // required — re-state it so the wider object satisfies the stricter type.
    allDataFetched: true,
    // Required by ContentAbout (not present on Content). Most are masterclass
    // concepts that don't apply to a webinar — defaulted so the existing
    // `CourseAbout` template still type-checks and renders gracefully.
    podcast_format: null,
    trailer_link: '',
    total_duration: webinar.webinar_duration ?? 0,
    no_of_chapters: 1,
    learning_pathway_info: [],
    enable_coming_soon: false,
    course_overview: webinar.course_overview ?? '',
    learning_objectives: webinar.learning_objectives ?? '',
    learning_objective_list: learningObjectiveList,
    exam_rules: '',
    document_file: null,
    total_assessment_questions: webinar.no_question_answered ?? 0,
    course_created_date: createdAt,
    course_reviewed_date: createdAt,
    course_updated_date: createdAt,
    topics: webinar.topics ?? [],
    int_delivery_method: webinar.int_delivery_method ?? '',
    program_level: webinar.program_level ?? '',
    course_expiry: '',
    course_duration: webinar.webinar_duration ?? 0,
    certification_organisation: 'NASBA',
    prerequisite_education: webinar.prerequisite_education ?? '',
    advance_preparation: webinar.advance_preparation ?? '',
    pass_percentage: 0,
    glossary_doc: '',
    glossary_transcript_text: '',
    trailer_thumbnail: null,
    sample_link: '',
    sample_thumbnail: null,
    navigation_link: '',
    priority_order: webinar.priority_order ?? 0,
    is_free: webinar.is_free,
    free_access_start_date: createdAt,
    free_access_end_date: null,
    is_subscription_excluded: webinar.is_subscription_excluded,
    is_individually_purchasable: false,
    mobile_horizontal_thumbnail: webinar.mobile_thumbnail ?? null,
    horizontal_trailer_thumbnail: null,
    vertical_trailer_thumbnail: null,
    status: webinar.status,
    start_date: webinar.webinar_dates?.[0]?.start_date ?? createdAt,
    lms_link: '',
    is_test_course: false,
    caira_priority: webinar.caira_priority ?? 0,
    course_category: webinar.course_category ?? 0,
    host_instructor: webinar.host_instructor ?? webinar.instructor_details.id,
    allowed_email_domains: [],
    webinar_duration: webinar.webinar_duration ?? 0,
    no_question_answered: webinar.no_question_answered ?? 0,
    attendance_threshold: webinar.attendance_threshold ?? 0,
  };
}
