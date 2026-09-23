/**
 * Static content for the MilesVerse landing page. The catalogue itself is LIVE —
 * fetched from the MilesVerse backend through @milesverse/sdk — so adding a
 * simulation over there appears here without a deploy.
 */

export interface MilesVerseStep {
  title: string;
  description: string;
}

/** An authored-difficulty tier (matches the backend SimulationDifficulty enum),
 *  with learner-facing copy. Drives the grouping on the subject page. */
export interface DifficultyTier {
  key: 'Foundational' | 'Intermediate' | 'Advanced';
  label: string;
  level: number;
  blurb: string;
}

/** The three tiers in ascending order — the subject page renders them top-down. */
export const DIFFICULTY_TIERS: readonly DifficultyTier[] = [
  {
    key: 'Foundational',
    label: 'Foundational',
    level: 1,
    blurb: 'Learn the core move in a room that gives you room to try.',
  },
  {
    key: 'Intermediate',
    label: 'Intermediate',
    level: 2,
    blurb: 'A true-to-life counterpart who pushes back the way people really do.',
  },
  {
    key: 'Advanced',
    label: 'Advanced',
    level: 3,
    blurb: 'High stakes and a guarded room — only genuine skill shifts them.',
  },
];

/** The three-beat explanation of how the two platforms connect. */
export const MILESVERSE_STEPS: readonly MilesVerseStep[] = [
  {
    title: 'Continue with your Masterclass account',
    description:
      'One click, no second password: your Masterclass session is exchanged for a ' +
      'MilesVerse one through a verified server-side check, and your practice ' +
      'history follows your account.',
  },
  {
    title: 'Practice with a live AI persona',
    description:
      'A realistic counterpart runs the conversation — an interviewer, a skeptical ' +
      'buyer, an upset customer — face to face, in real time, responding to what ' +
      'you actually say.',
  },
  {
    title: 'Debrief with a scored report',
    description:
      'Every session is transcribed and graded against a marking scheme: ' +
      'per-competency scores, written feedback, and progress that builds session ' +
      'over session.',
  },
];

/**
 * A stable non-negative hash for a seed string. Shared by the hue and avatar
 * helpers so the same persona always resolves to the same colour and portrait.
 */
function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/** A deterministic hue (0–359) for a seed — drives the per-subject card art. */
export function seedHue(seed: string): number {
  return hashSeed(seed) % 360;
}

/**
 * A placeholder human portrait for a persona, deterministic per seed.
 *
 * Used only when a scenario has no key art of its own — a stable stock face
 * from pravatar keyed by the persona name, so the same persona always shows the
 * same portrait.
 */
export function personaAvatarUrl(seed: string, size = 240): string {
  const index = (hashSeed(seed) % 70) + 1; // pravatar serves images 1–70
  return `https://i.pravatar.cc/${size}?img=${index}`;
}

/**
 * The scenario's key-art URL. The catalogue API returns `thumbnailKey` already
 * resolved to a fully-qualified URL (the MilesVerse media origin — S3/CDN in
 * production, the backend's own /media mount in local dev), so it's used as-is;
 * when absent we fall back to a deterministic persona portrait. No image bytes
 * live in this repo.
 */
export function scenarioImage(
  thumbnailKey: string | null | undefined,
  personaSeed: string,
  size = 480,
): string {
  return thumbnailKey || personaAvatarUrl(personaSeed, size);
}

/** A subject's cover-art URL (already fully-qualified from the API), or null. */
export function subjectImage(iconKey: string | null | undefined): string | null {
  return iconKey || null;
}
