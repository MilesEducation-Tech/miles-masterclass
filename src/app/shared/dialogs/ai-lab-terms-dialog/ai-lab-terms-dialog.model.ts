/**
 * The Miles AI Labs participant agreement, as structured blocks rather than a
 * blob of HTML: the template renders each `kind`, so the copy stays plain text
 * that legal can edit without touching markup or risking an injection surface.
 */
export interface AgreementLine {
  /** Bold lead-in, e.g. "Educational use only." */
  lead?: string;
  text?: string;
}

export type AgreementBlock =
  | { kind: 'heading'; text: string }
  | ({ kind: 'para' } & AgreementLine)
  | { kind: 'bullets'; items: readonly AgreementLine[] }
  | { kind: 'table'; head: readonly string[]; rows: readonly (readonly string[])[] };

/** Where data-rights requests go — cited in Section 5. */
export const AI_LAB_CONTACT_EMAIL = 'support@milesmasterclass.com';

export const AI_LAB_AGREEMENT: readonly AgreementBlock[] = [
  { kind: 'heading', text: '1. Who this is with' },
  {
    kind: 'para',
    text: 'This agreement is between you, the participant, and Miles Masterclass Inc. ("Miles").',
  },
  {
    kind: 'para',
    text: 'Miles has partnered with Jain (Deemed-to-be University), Bengaluru (the "University") to provide the Miles AI Labs environment for educational purposes only to students and professionals enrolled in Miles programmes.',
  },

  { kind: 'heading', text: '2. What you get' },
  {
    kind: 'para',
    text: "A hands-on environment to build agents and automations using Microsoft Copilot Studio, Power Automate, and Microsoft 365 Copilot, with assignments and assessment. Access comes with your enrolment in the Certified AI-Ready Accountant (CAIRA) credential. The environment runs inside the University's Microsoft tenant.",
  },

  { kind: 'heading', text: '3. Your registration with the University' },
  {
    kind: 'para',
    text: 'When you launch the lab, you will be registered as a student of the University under its Management Development Programme, administered by the University. The University will issue you an ID so you can access the software above.',
  },
  {
    kind: 'para',
    text: 'This registration is limited to that purpose. It is not admission to any degree or diploma programme, carries no academic credit, and gives no alumni status, placement support, or access to University facilities or services. It creates no employment relationship with the University or with Miles. Your registration and ID end when your lab access ends.',
  },
  {
    kind: 'para',
    text: 'Your credential on completion is issued by the International Federation for Artificial Intelligence (IFFAI) and Miles Masterclass Inc.',
  },

  { kind: 'heading', text: '4. Rules of use' },
  {
    kind: 'para',
    text: "Your Microsoft licences come from the University under its agreement with Microsoft, and Microsoft's own terms apply to your account.",
  },
  {
    kind: 'bullets',
    items: [
      {
        lead: 'Educational use only.',
        text: 'No commercial work, client engagements, production workloads, or paid deliverables.',
      },
      {
        lead: 'Your account only.',
        text: 'Do not share, transfer, or let anyone else use your credentials.',
      },
      {
        lead: 'Synthetic and test data only.',
        text: 'Use the sample datasets and templates provided, or your own synthetic and test data. Do not upload confidential, client, personal, or employer-owned data.',
      },
      {
        lead: 'No workarounds.',
        text: "Do not bypass tenant controls, access other participants' work, or connect unapproved external systems.",
      },
      {
        lead: 'Your own obligations.',
        text: "Check that your employer's policies and any professional rules allow you to take part.",
      },
    ],
  },
  {
    kind: 'para',
    text: 'Breaking these rules can end your access and your enrolment immediately, without refund.',
  },

  { kind: 'heading', text: '5. Your personal data' },
  {
    kind: 'para',
    text: "This is your notice under India's Digital Personal Data Protection Act, 2023, and the GDPR where it applies.",
  },
  {
    kind: 'para',
    lead: 'Who is responsible:',
    text: 'Miles Masterclass Inc., as Data Fiduciary. The University is a joint Data Fiduciary for your registration record and institutional account.',
  },
  {
    kind: 'para',
    lead: 'What we collect:',
    text: 'name, email, phone, country, employer and job title, qualifications, your University ID and registration record, your assignments and results, and lab usage logs (sign-ins, what you build, timestamps).',
  },
  { kind: 'para', lead: 'What we use it for:' },
  {
    kind: 'table',
    head: ['Purpose', 'Basis'],
    rows: [
      ['Registering you with the University and issuing your ID', 'Consent'],
      ['Provisioning and managing your Microsoft licences', 'Consent'],
      ['Assessing your work and issuing your credential', 'Consent'],
      [
        'Evidencing eligibility for educational licensing and responding to audits',
        'Legal obligation',
      ],
      ['Programme support and enrolment communications', 'Consent'],
      ['Marketing about other Miles programmes', 'Separate consent below'],
    ],
  },
  {
    kind: 'para',
    lead: 'Who we share it with:',
    text: 'the University (registration, accounts, licences) and Microsoft (software and hosting). We do not sell your data.',
  },
  {
    kind: 'para',
    lead: 'How long we keep it:',
    text: 'your subscription period, apart from registration and licensing records we must retain for audit.',
  },
  {
    kind: 'para',
    lead: 'Your rights:',
    text: `you can request access to, correction of, or erasure of your data, and you can withdraw consent at any time by writing to ${AI_LAB_CONTACT_EMAIL}, which will end your lab access, since the account cannot run without this processing.`,
  },

  { kind: 'heading', text: '6. Access, your work, and content' },
  {
    kind: 'para',
    text: 'Access runs for your subscription period. Miles or the University may suspend or withdraw it for maintenance, security, licensing changes, or breach of these terms. The environment is provided as is, with no guarantee of uptime.',
  },
  {
    kind: 'para',
    text: 'Anything you build may be deleted when your subscription period ends, so export what you want to keep. Neither Miles nor the University is responsible for restoring your work.',
  },
  {
    kind: 'para',
    text: 'Assignment materials, templates, and course content belong to Miles. Use them for your own learning, but do not republish, resell, or train others with them.',
  },
  {
    kind: 'para',
    text: 'Microsoft supplies the software and is not a party to this agreement. To the extent the law allows, neither Miles nor the University is liable for indirect or consequential loss, loss of data, or lost profits.',
  },

  { kind: 'heading', text: '7. Confirmations' },
  {
    kind: 'para',
    text: 'By clicking Launch the Lab, you confirm that you have read and agree to these terms, consent to the data processing in Section 5 and to being registered as a student of the University as described in Section 3, are 18 or older, gave accurate information at enrolment, understand the limits in Section 3, and will use the environment for educational purposes only.',
  },
];
