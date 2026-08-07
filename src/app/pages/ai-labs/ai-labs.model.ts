import { environment } from '../../../environments/environment';

/**
 * One prebuilt agent tile in the catalogue grid.
 *
 * Every name in the design ends in "Agent", and the card renders that suffix in
 * a lighter weight than the name itself — so `name` holds just the distinctive
 * part and the template appends the word.
 */
export interface AiLabAgent {
  name: string;
  description: string;
  /**
   * Image filename, snake_case. Falls back to a gradient placeholder when
   * absent. Note this is a bare filename, not a resolvable URL — see the
   * comment on `AI_LAB_SECTIONS`.
   */
  thumbnail?: string;
  /** Alt text for `thumbnail`. Required whenever a thumbnail is set. */
  thumbnailAlt?: string;
}

export interface AiLabSection {
  heading: string;
  agents: AiLabAgent[];
}

/**
 * Catalogue copy, transcribed from the design.
 *
 * `thumbnail` holds a bare filename, which the browser resolves against the
 * CURRENT ROUTE — so these request `/us/accounting/revenue_recognition.webp`
 * and 404. The project's convention for image assets is
 * `environment.GCS_URL + 'folder/file.webp'` (see offerings.config.ts); once
 * the artwork is uploaded, prefix these the same way.
 */
export const AI_LAB_SECTIONS: AiLabSection[] = [
  {
    heading: 'AI Agents & Workflows for Audit',
    agents: [
      {
        name: 'Revenue Recognition',
        thumbnailAlt: 'Revenue Recognition',
        thumbnail:
          environment.S3_BUCKET_URL +
          'static-assests/web-app/miles-ai-labs/revenue_recognition.webp',
        description:
          'Builds the expected month-by-month schedule from the contract, recognised revenue and deferred balance. You review only where it disagrees with the ledger.',
      },
      {
        name: 'Lease Assurance',
        thumbnailAlt: 'Lease Assurance',
        thumbnail:
          environment.S3_BUCKET_URL + 'static-assests/web-app/miles-ai-labs/lease_assurance.webp',
        description:
          "Pulls the lease terms from the agreement and checks them against the client's schedule. Reports the breaks instead of recalculating everything.",
      },
      {
        name: 'AR Confirmation',
        thumbnailAlt: 'AR Confirmation',
        thumbnail:
          environment.S3_BUCKET_URL + 'static-assests/web-app/miles-ai-labs/ar_confirmation.webp',
        description:
          'Generates confirmations from the aged debtors listing, tracks what comes back, and chases the rest. The whole cycle without the spreadsheet and mailbox shuttle.',
      },
    ],
  },
  {
    heading: 'AI Agents & Workflows for CFO Teams',
    agents: [
      {
        name: 'AR Reminder',
        thumbnailAlt: 'AR Reminder',
        thumbnail:
          environment.S3_BUCKET_URL + 'static-assests/web-app/miles-ai-labs/ar_reminder.webp',
        description:
          'Reads the ageing, decides who gets a nudge and who gets escalated, and drafts the email. Collections stop depending on who checked this week.',
      },
      {
        name: 'AP',
        thumbnailAlt: 'AP',
        thumbnail: environment.S3_BUCKET_URL + 'static-assests/web-app/miles-ai-labs/ap.webp',
        description:
          'Matches the invoice against the purchase order and goods receipt, then routes it for approval or flags the break. Runs on every invoice, not only the ones there was time for.',
      },
      {
        name: 'Employee Reimbursement',
        thumbnailAlt: 'Employee Reimbursement',
        thumbnail:
          environment.S3_BUCKET_URL +
          'static-assests/web-app/miles-ai-labs/employee_reimbursement.webp',
        description:
          'Reads the claim and the receipt, checks both against policy, and clears what is clean. Policy applied the same way whoever is reviewing.',
      },
    ],
  },
  {
    heading: 'AI Agents & Workflows for Tax',
    agents: [
      {
        name: 'Tax PBC',
        thumbnailAlt: 'Tax PBC',
        thumbnail: environment.S3_BUCKET_URL + 'static-assests/web-app/miles-ai-labs/tax_pbc.webp',
        description:
          "Builds each client's expected document list from last year's return, tracks what lands, and chases the gaps. Catches the missing item and the unexpected one.",
      },
      {
        name: 'K-1 Tracker',
        thumbnailAlt: 'K-1 Tracker',
        thumbnail:
          environment.S3_BUCKET_URL + 'static-assests/web-app/miles-ai-labs/k_1_tracker.webp',
        description:
          'Logs every K-1 across partnerships, S corporations and trusts and keeps the tracker current. Answers whose return is genuinely waiting on somebody else.',
      },
      {
        name: 'Trial Balance Classification',
        thumbnailAlt: 'Trial Balance Classification',
        thumbnail:
          environment.S3_BUCKET_URL +
          'static-assests/web-app/miles-ai-labs/trial_balance_classification.webp',
        description:
          "Carries last year's approved tax-line map forward and flags only what changed. Renamed, renumbered, newly opened, quietly closed.",
      },
    ],
  },
];
