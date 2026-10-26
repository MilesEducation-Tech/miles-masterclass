/**
 * Where the learner stands on each numbered step of the AI Lab course page.
 *
 * Pure so the template only reads it: the step shell colours its node and chip off `state`, and
 * nothing about the gates leaks into the HTML. Ported from miles-masterclass-v3, with one rule of
 * ours: the lab opens on a passed final assessment (`labOpen`), because our backend refuses
 * `assignment-submit/` before it — upstream opens it on an active plan instead.
 */
export type StepState = 'done' | 'current' | 'attention' | 'locked' | 'open';

export interface JourneyStep {
  state: StepState;
  /** The status chip beside the heading; `null` shows none. */
  status: string | null;
}

export type JourneyStepKey = 'final' | 'lab' | 'materials' | 'hints' | 'grade';

export interface JourneyGates {
  videoDone: boolean;
  examPassed: boolean;
  examRetake: boolean;
  labMapped: boolean;
  /** Graded at least once — stays true while a resubmission is with the evaluator. */
  labGraded: boolean;
  evaluating: boolean;
  evaluationFailed: boolean;
  /** The lab can be worked on: the final assessment is passed. Its materials and hints wait too. */
  labOpen: boolean;
}

/**
 * Materials and hints are reference, never chipped. They open with the lab they serve — locked
 * when no assignment is mapped or the lab isn't open yet (they're shown, locked, until then) — and
 * are done once the lab is graded, so a finished course ticks every step.
 */
function referenceStep({ labMapped, labGraded, labOpen }: JourneyGates): JourneyStep {
  if (!labMapped || !labOpen) return { state: 'locked', status: null };
  return { state: labGraded ? 'done' : 'open', status: null };
}

export function courseJourney(gates: JourneyGates): Record<JourneyStepKey, JourneyStep> {
  return {
    final: finalStep(gates),
    lab: labStep(gates),
    materials: referenceStep(gates),
    hints: referenceStep(gates),
    grade: gradeStep(gates),
  };
}

function finalStep({ videoDone, examPassed, examRetake }: JourneyGates): JourneyStep {
  if (examPassed) return { state: 'done', status: 'Passed' };
  if (examRetake) return { state: 'attention', status: 'Retake required' };
  if (videoDone) return { state: 'current', status: 'Up next' };
  return { state: 'locked', status: 'Watch the video first' };
}

function labStep({ labMapped, labGraded, labOpen }: JourneyGates): JourneyStep {
  if (!labMapped) return { state: 'locked', status: 'Not available yet' };
  if (!labOpen) return { state: 'locked', status: 'Pass the assessment first' };
  if (labGraded) return { state: 'done', status: 'Graded' };
  return { state: 'current', status: 'Ready' };
}

/** A running evaluation outranks an earlier grade — that's what the learner is waiting on. */
function gradeStep(gates: JourneyGates): JourneyStep {
  if (gates.evaluating) return { state: 'current', status: 'Evaluating' };
  if (gates.evaluationFailed) return { state: 'attention', status: 'Evaluation failed' };
  if (gates.labGraded) return { state: 'done', status: 'Graded' };
  if (gates.labMapped && gates.labOpen) return { state: 'open', status: 'Not submitted' };
  return { state: 'locked', status: 'Locked' };
}

// ---------------------------------------------------------------------------
// The course as a whole — where the learner is across all steps, for the progress overview in the
// sidebar. Same gates, plus how far into the video.
// ---------------------------------------------------------------------------

export type ProgressStage =
  'fresh' | 'started' | 'halfway' | 'retake' | 'lab' | 'evaluating' | 'complete';

/** Where the overview's button takes the learner. */
export type ProgressTarget = 'video' | 'final' | 'lab' | 'grade';

export interface ProgressGates extends JourneyGates {
  /** 0–100, how much of the video has been watched. */
  videoPercent: number;
  quizDone: boolean;
}

export interface CourseProgress {
  stage: ProgressStage;
  /** 0–100 across all steps, with the video counted pro rata while unfinished. */
  percent: number;
  title: string;
  detail: string;
  next: { label: string; target: ProgressTarget };
  milestones: { label: string; state: StepState }[];
}

export function courseProgress(gates: ProgressGates): CourseProgress {
  const stage = progressStage(gates);
  return {
    stage,
    percent: progressPercent(gates),
    ...STAGE_COPY[stage](gates),
    milestones: milestones(gates),
  };
}

function progressStage(g: ProgressGates): ProgressStage {
  if (g.examPassed && (!g.labMapped || g.labGraded)) return 'complete';
  if (g.examPassed) return g.evaluating ? 'evaluating' : 'lab';
  if (g.examRetake) return 'retake';
  if (g.videoDone) return 'halfway';
  return g.videoPercent > 0 ? 'started' : 'fresh';
}

function progressPercent(g: ProgressGates): number {
  const steps = [g.videoDone, g.quizDone, g.examPassed];
  if (g.labMapped) steps.push(g.labGraded);
  const done = steps.filter(Boolean).length;
  const partial = g.videoDone ? 0 : Math.min(100, Math.max(0, g.videoPercent)) / 100;
  return Math.round(((done + partial) / steps.length) * 100);
}

function milestones(g: ProgressGates): CourseProgress['milestones'] {
  const list: CourseProgress['milestones'] = [
    { label: 'Video', state: g.videoDone ? 'done' : 'current' },
    { label: 'Quiz', state: g.quizDone ? 'done' : g.videoDone ? 'current' : 'locked' },
    {
      label: 'Final assessment',
      state: g.examPassed ? 'done' : g.examRetake ? 'attention' : g.quizDone ? 'current' : 'locked',
    },
  ];
  if (g.labMapped) {
    list.push({
      label: 'AI Lab',
      state: g.labGraded ? 'done' : g.labOpen ? 'current' : 'locked',
    });
  }
  return list;
}

type StageCopy = Pick<CourseProgress, 'title' | 'detail' | 'next'>;

const STAGE_COPY: Record<ProgressStage, (g: ProgressGates) => StageCopy> = {
  fresh: () => ({
    title: 'Ready when you are',
    detail: 'Watch the video, pass the final assessment, then build your agent in the AI Lab.',
    next: { label: 'Start the video', target: 'video' },
  }),
  started: (g) => ({
    title: 'Just getting started',
    detail: `${Math.round(g.videoPercent)}% of the video watched — pick up where you left off.`,
    next: { label: 'Resume the video', target: 'video' },
  }),
  halfway: (g) => ({
    title: 'Halfway there',
    detail: 'Video done. Pass the final assessment to open the AI Lab.',
    next: {
      label: g.quizDone ? 'Take the final assessment' : 'Take the quiz',
      target: 'final',
    },
  }),
  retake: () => ({
    title: 'One more try',
    detail: "The final assessment didn't go your way this time — retake it to open the AI Lab.",
    next: { label: 'Retake the assessment', target: 'final' },
  }),
  lab: () => ({
    title: 'Final stretch',
    detail: 'Assessment passed. Build your agent in the AI Lab and submit it for a score.',
    next: { label: 'Go to the AI Lab', target: 'lab' },
  }),
  evaluating: () => ({
    title: 'Almost there',
    detail: 'Your agent is being evaluated — your score lands here automatically.',
    next: { label: 'View status', target: 'grade' },
  }),
  complete: (g) =>
    g.labMapped
      ? {
          title: 'Course complete',
          detail: 'Every step done — leave your feedback and download your certificate.',
          next: { label: 'View your scores', target: 'grade' },
        }
      : {
          title: 'Course complete',
          detail: 'Assessment passed — leave your feedback and download your certificate.',
          next: { label: 'Go to the assessment', target: 'final' },
        },
};
