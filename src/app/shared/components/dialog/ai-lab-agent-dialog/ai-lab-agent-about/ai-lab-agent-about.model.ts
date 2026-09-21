/** One graded MCQ in the agent assessment report. */
export interface AiLabReportQuestion {
  id: number;
  question: string;
  yourAnswer: string;
  correctAnswer: string;
  explanation: string;
  isCorrect: boolean;
}

/**
 * One evaluated step of the submitted Copilot Studio / Power Automate flow.
 * The practical half of the assessment: the learner builds the agent, and each
 * step of the build is checked.
 */
export interface AiLabFlowCheck {
  id: number;
  title: string;
  /** Why it passed, or what went wrong — shown when the row is expanded. */
  detail: string;
  passed: boolean;
}

export interface AiLabAssessmentReport {
  completedOn: string;
  /** Combined across both halves. */
  scorePercent: number;
  flow: {
    /** The agent the learner submitted, as named in Copilot Studio. */
    agentName: string;
    passed: number;
    total: number;
    checks: readonly AiLabFlowCheck[];
  };
  mcq: {
    correct: number;
    total: number;
    questions: readonly AiLabReportQuestion[];
  };
}

/**
 * PLACEHOLDER — static stand-in for the agent assessment report.
 *
 * The assessment has two halves and the report shows both:
 *
 *   1. **AI agent flow on Copilot** — the agent the learner actually built,
 *      graded step by step. No endpoint exists for this yet; it needs one that
 *      returns the submitted agent's name and a pass/fail per evaluated step.
 *   2. **MCQ** — `MASTERCLASS_ROUTES.chapterQuizReport`
 *      (`masterclass/report_summary/?chapter_id=`) already returns this as
 *      `QuizReportItem[]`: `question`, `option_a`–`option_d`,
 *      `option_description_a`–`_d`, `user_selected_option`, `correct_option`.
 *      Mapping into `AiLabReportQuestion` is the whole job — pick the option
 *      text by letter, and `isCorrect` is
 *      `user_selected_option === correct_option`.
 *
 * The copy below is real content from chapter 1113 ("Receivables on Autopilot")
 * so the layout is exercised at realistic text lengths, with one failed check
 * and one wrong answer so both failure treatments are visible.
 */
export const AI_LAB_ASSESSMENT_REPORT: AiLabAssessmentReport = {
  completedOn: '4 August 2026',
  scorePercent: 78,
  flow: {
    agentName: 'AR Reminder Agent',
    passed: 4,
    total: 5,
    checks: [
      {
        id: 1,
        title: 'Recurrence trigger set to run once a day',
        detail: 'An interval of 1 with a frequency of Day, so the flow runs once every day.',
        passed: true,
      },
      {
        id: 2,
        title: 'List rows reads the AR invoice table',
        detail:
          'The action returns every row of the AR Invoices table, which is what the overdue check needs to work from.',
        passed: true,
      },
      {
        id: 3,
        title: 'Condition filters to unpaid, overdue invoices',
        detail:
          'Due Date is less than today and Status equals Unpaid, so paid and future invoices are correctly skipped.',
        passed: true,
      },
      {
        id: 4,
        title: 'Reminder Sent is written back after the email goes out',
        detail:
          'The flow sends the reminder but never updates Reminder Sent, so the same customer is chased again on every run. Add an Update a Row step after the send.',
        passed: false,
      },
      {
        id: 5,
        title: 'Flow published and running on schedule',
        detail: 'The flow is published, so the recurrence trigger fires without manual runs.',
        passed: true,
      },
    ],
  },
  mcq: {
    correct: 3,
    total: 4,
    questions: [
      {
        id: 22332,
        question: 'When should dynamic content be used?',
        yourAnswer: 'When using information produced by an earlier step',
        correctAnswer: 'When using information produced by an earlier step',
        explanation: 'Dynamic content uses information already produced by the flow.',
        isCorrect: true,
      },
      {
        id: 22334,
        question: 'What is the purpose of Run a Prompt?',
        yourAnswer: 'To extract structured information from the invoice',
        correctAnswer: 'To extract structured information from the invoice',
        explanation: 'Run a Prompt uses AI to extract the required invoice information.',
        isCorrect: true,
      },
      {
        id: 22335,
        question: 'Why is the prompt instructed to return only a JSON object?',
        yourAnswer: 'To provide clean data that the flow can read',
        correctAnswer: 'To provide clean data that the flow can read',
        explanation: 'JSON provides structured data that later flow steps can read reliably.',
        isCorrect: true,
      },
      {
        id: 22345,
        question: 'What does a Condition provide in the flow?',
        yourAnswer: 'A list of email attachments',
        correctAnswer: 'A true-or-false decision point',
        explanation: 'A Condition checks whether specified tests are true or false.',
        isCorrect: false,
      },
    ],
  },
};
