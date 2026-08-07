/**
 * Default CPE requirement (credits/year) when the server-provided
 * `user_state_board` list is empty or lacks a numeric target.
 */
export const DEFAULT_CPE_REQUIREMENT = 40;

const TRANSACTION_TYPE_MAP: Record<string, any> = {
  self_study: 'masterclass',
  masterclass: 'masterclass',
  nano_learning: 'nano_learning',
  podcast: 'podcast',
  webinar: 'webinar',
  // Wire ships `course_details.type === 'premiere'` for webinar rows. We
  // collapse it to `'webinar'` so the UI union stays narrow.
  premiere: 'webinar',
};

const DELIVERY_METHOD_MAP: Record<any, string> = {
  masterclass: 'QAS Self Study',
  podcast: 'QAS Self Study',
  nano_learning: 'Nano Learning',
  webinar: 'Group Internet Based',
};

/**
 * Normalize the server's `transcation_type` (typo preserved on the wire) into
 * the clean `TransactionType` union the UI speaks.
 */
export function normalizeTransactionType(raw: string | null | undefined): any {
  if (!raw) return 'masterclass';
  return TRANSACTION_TYPE_MAP[raw] ?? 'masterclass';
}

/**
 * Pick the human-readable title for a row from whichever nested field the
 * server populated for this course type. Webinar rows ship with
 * `course_details: null` and carry the title under `webinar_details`.
 */
function pickCourseName(raw: any): string {
  const cd = raw.course_details;
  return (
    cd?.master_class_name ??
    cd?.podcast_format ??
    cd?.nano_learning_name ??
    raw.webinar_details?.webinar_name ??
    '—'
  );
}

/**
 * Resolve the row's `TransactionType`. Prefer the typo'd top-level
 * `transcation_type` (mapped through `TRANSACTION_TYPE_MAP` which already
 * collapses `'self_study'` and `'premiere'`), then fall through to
 * `course_details.type`, collapsing `'premiere'` there too. Webinar rows
 * may arrive with `course_details: null`, so default to `'masterclass'`
 * when both signals are missing.
 */
function resolveTransactionType(raw: any): any {
  const mapped = TRANSACTION_TYPE_MAP[raw.transcation_type ?? ''];
  if (mapped) return mapped;
  const rawType = raw.course_details?.type;
  if (rawType === 'premiere') return 'webinar';
  return rawType ?? 'masterclass';
}

export function toReportRow(raw: any): any {
  const cd = raw.course_details;
  const transactionType = resolveTransactionType(raw);

  const assessment = cd?.user_assessment
    ? {
        status: cd.user_assessment.status,
        session_id: cd.user_assessment.session_id ?? undefined,
        exam_passes_date: cd.user_assessment.exam_passes_date ?? null,
        all_classes_completed: cd.all_classes_completed,
      }
    : null;

  const completedAt = raw.completed_date ?? assessment?.exam_passes_date ?? null;

  return {
    id: raw.id,
    master_class: raw.master_class,
    nano_learning: raw.nano_learning,
    podcast: null,
    webinar_details: raw.webinar_details,
    course_name: pickCourseName(raw),
    course_image: cd?.horizontal_thumbnail ?? undefined,
    instructor_name: cd?.instructor_name ?? undefined,
    transaction_type: transactionType,
    // `course_type` is required on `ReportRow`. When `course_details` is null
    // (webinar rows), fall back to the resolved transaction type so consumers
    // that branch off `course_type` still get a meaningful discriminator.
    course_type: cd?.type ?? transactionType,
    field_of_study: cd?.fields_of_study ?? [],
    delivery_method: DELIVERY_METHOD_MAP[transactionType],
    all_classes_completed: cd?.all_classes_completed ?? false,
    completed_at: completedAt,
    registered_at: raw.created_at ?? null,
    assessment,
    user_feedback_details: raw.user_feedback_details,
    total_credits: raw.total_credits,
    caira_level: raw.caira_level_snapshot ?? cd?.caira_level ?? null,
    user_badge: raw.user_badge ?? null,
    attendance_status: cd?.attendance_details ?? null,
    exam_rules: cd?.exam_rules ?? null,
    is_certificate_eligible: cd?.is_certificate_eligible ?? false,
    is_subscription_excluded: cd?.is_subscription_excluded ?? false,
    was_caira_credit: raw.was_caira_credit ?? false,
  };
}

function isClaimable(status: any, awardedAt: string | null, progress: number): boolean {
  return status === 'unlocked' && !awardedAt && progress >= 100;
}

function isClaimed(status: any, awardedAt: string | null): boolean {
  return status === 'unlocked' && !!awardedAt;
}

export function toBadgeItem(raw: any): any {
  const levelName = raw.badge.level_name?.trim();
  const fullName = levelName ? `${raw.badge.name} — ${levelName}` : raw.badge.name;
  const required = Number(raw.badge.required_credits);

  return {
    id: raw.id,
    name: fullName,
    sub_text: raw.badge.sub_text ?? undefined,
    description: raw.badge.description || raw.badge.sub_text || '',
    image_url: raw.badge.icon_url,
    level: levelName,
    level_rank: raw.badge.level_rank,
    required_credits: Number.isFinite(required) ? required : undefined,
    earned_credits: raw.current_progress.earned,
    progress_percentage: raw.progress_percentage,
    // Narrow the wire's open string to the two values the UI cares about.
    // Anything unexpected falls back to 'locked' (grayscale + lock icon).
    status: raw.status === 'unlocked' ? 'unlocked' : 'locked',
    is_claimed: isClaimed(raw.status, raw.awarded_at),
    is_claimable: isClaimable(raw.status, raw.awarded_at, raw.progress_percentage),
    is_coming_soon: raw.badge.is_coming_soon,
    accept_url: raw.accept_url ?? undefined,
  };
}

function pickBreakdown(raw: any, mode: boolean): any {
  return mode ? raw.credits_earned : raw.upcoming_credits;
}

/** Resolve the user's state-board CPE requirement, or fall back to a default. */
export function resolveCpeRequirement(raw: any | null): number {
  const board = raw?.user_state_board?.[0];
  const required = board?.required_credits;
  return typeof required === 'number' && required > 0 ? required : DEFAULT_CPE_REQUIREMENT;
}

export interface StateBoardInfo {
  name: string;
  required: number;
}

/** Resolve the user's first state board + required credits, with sensible fallbacks. */
export function resolveStateBoard(raw: any | null): StateBoardInfo {
  const board = raw?.user_state_board?.[0];
  return {
    name: board?.name?.trim() || 'State Board',
    required: resolveCpeRequirement(raw),
  };
}

export function deriveCredits(raw: any | null, mode: boolean): any | null {
  if (!raw) return null;
  const earned = mode ? raw.overall_credits_earned : raw.overall_upcoming_credits;
  const pending = mode ? raw.overall_upcoming_credits : raw.overall_credits_earned;
  return {
    total: raw.overall_credits_earned + raw.overall_upcoming_credits,
    earned,
    required: resolveCpeRequirement(raw),
    pending,
  };
}

export function deriveFieldsOfStudy(raw: any | null, mode: boolean): any[] {
  if (!raw) return [];
  const breakdown = pickBreakdown(raw, mode);
  return [
    { id: 1, name: 'Accounting', credits: breakdown.course_credits.account_credits ?? 0 },
    { id: 2, name: 'Ethics', credits: breakdown.course_credits.ethics ?? 0 },
    { id: 3, name: 'Others', credits: breakdown.course_credits.others ?? 0 },
  ];
}

export function deriveDeliveryModes(raw: any | null, mode: boolean): any[] {
  if (!raw) return [];
  const breakdown = pickBreakdown(raw, mode);
  return [
    { id: 1, name: 'Self-Study', credits: breakdown.study_credits.self_study ?? 0 },
    { id: 2, name: 'Nano Learning', credits: breakdown.study_credits.nano_learning ?? 0 },
    { id: 3, name: 'Webinar', credits: breakdown.study_credits.webinar ?? 0 },
  ];
}
