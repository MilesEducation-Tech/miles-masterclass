import { LegalDoc } from '../models/legal-doc.model';
import { richContent } from '../models/faq.model';
import { CountryCode, ProfessionType } from '../models/route-params.model';
import { LocaleKey, resolveByLocale } from '@shared/utils/locale-resolver';

/**
 * Terms of Service content. Ported from v1's TERMS_AND_CONDITIONS array
 * (the "Terms and Conditions" root) and converted from raw HTML strings to
 * structured FAQContent[] blocks. Paragraphs with inline <strong>/<a> use
 * the `rich` variant; plain paragraphs use `text`; lists use `list`.
 *
 * Locale variations: pages consume `resolveTermsOfService(country, profession)`
 * which falls back to DEFAULT_TERMS_OF_SERVICE. Add per-locale overrides to
 * the LOCALE_OVERRIDES map below when copy diverges per market.
 *
 * When updating: keep section navIds stable so deep-links like
 * /terms-of-service#refunds keep working. If you add or rename a section,
 * grep for the navId across the repo (footer.ts, emails, support docs).
 */
const DEFAULT_TERMS_OF_SERVICE: LegalDoc = {
  slug: 'terms-of-service',
  title: 'Terms and Conditions',
  lastUpdated: '2025-09-30',
  intro: [
    richContent(
      'By accessing or using Miles Masterclass Inc. (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;), including our website or app (the &ldquo;Service&rdquo;), you agree to these Terms and Conditions (&ldquo;Terms&rdquo;) and our <a href="/privacy-policy" class="underline text-accent hover:text-accent/80">Privacy Policy</a>, which explains how we collect, use, and share your personal and professional information. If you do not agree, do not use the Service.',
    ),
    { type: 'heading', value: 'Privacy Policy Reference', level: 3 },
    {
      type: 'text',
      value:
        'Our Privacy Policy is incorporated by reference into these Terms. By using the Service, you acknowledge that you have read, understood, and agree to the Privacy Policy. The Privacy Policy covers data collection, cookies, analytics, communications, third-party sharing, mobile use, and security practices.',
    },
    { type: 'heading', value: 'Quick Summary', level: 3 },
    {
      type: 'list',
      items: [
        'Subscriptions: Annual, auto-renew unless cancelled.',
        'Refunds: No refunds (except rare exceptions, e.g., duplicate charges or fraud).',
        'Cancellations: You may cancel anytime; access continues until the end of the billing period.',
        'Certificates: NASBA-approved CPE certificates issued only if courses are completed in accordance with NASBA rules for the specific delivery method. See the Credits & Reporting section of our FAQs.',
        'Usage: Accounts are for personal, non-commercial learning only — no sharing, reselling, or recording.',
        'Data: We collect personal/professional data to deliver services. See our Privacy Policy.',
        'Disputes: Resolved by binding arbitration in Delaware (no class actions).',
      ],
    },
  ],
  sections: [
    {
      navId: 'acceptance',
      navLabel: 'Acceptance',
      title: '1. Acceptance of Terms',
      level: 2,
      body: [
        {
          type: 'text',
          value:
            'By accessing or using Miles Masterclass (“we,” “our,” “us,” or the “Service”), you agree to these Terms and Conditions (“Terms”). If you do not agree, you must not use the Service.',
        },
      ],
    },
    {
      navId: 'services',
      navLabel: 'Services',
      title: '2. Services',
      level: 2,
      body: [
        { type: 'text', value: 'Miles Masterclass provides:' },
        {
          type: 'list',
          items: [
            'Video courses, audio courses (podcasts), micro-learning modules, and live/recorded webinars.',
            'NASBA-approved CPE certificates for eligible courses, only if completed in accordance with NASBA rules for the applicable delivery method. See the Credits & Reporting section of the FAQs.',
          ],
        },
        {
          type: 'text',
          value: 'Services may be updated, modified, or removed at our discretion.',
        },
      ],
    },
    {
      navId: 'subscriptions',
      navLabel: 'Subscriptions',
      title: '3. Subscriptions & Payments',
      level: 2,
      body: [
        {
          type: 'text',
          value:
            'The Service is primarily offered via yearly subscription, processed securely through third-party providers (Stripe, app stores).',
        },
        {
          type: 'text',
          value: 'Promotional offers, free trials, or coupon codes may have additional terms.',
        },
        richContent(
          '<strong class="text-white">Auto-renewal:</strong> Subscriptions renew automatically unless cancelled before the renewal date.',
        ),
      ],
    },
    {
      navId: 'refunds',
      navLabel: 'Refunds',
      title: '4. Refunds & Cancellations',
      level: 2,
      body: [
        {
          type: 'text',
          value:
            'No refunds are provided for subscription fees, except in limited, case-by-case exceptions (e.g., duplicate charges or fraud).',
        },
        {
          type: 'text',
          value:
            'You may cancel anytime. Cancellation stops future renewal but does not refund the unused period.',
        },
        { type: 'text', value: 'Re-subscribing requires a new subscription purchase.' },
      ],
    },
    {
      navId: 'accounts',
      navLabel: 'Accounts',
      title: '5. User Accounts',
      level: 2,
      body: [
        { type: 'text', value: 'Account creation is required to access content.' },
        { type: 'text', value: 'Credentials are personal; sharing accounts is prohibited.' },
        {
          type: 'text',
          value: 'We may suspend or terminate accounts suspected of misuse, sharing, or fraud.',
        },
      ],
    },
    {
      navId: 'intellectual-property',
      navLabel: 'IP & Usage',
      title: '6. Intellectual Property & Usage Restrictions',
      level: 2,
      body: [
        {
          type: 'text',
          value: 'All content is owned by Miles Masterclass and is protected by copyright.',
        },
        {
          type: 'text',
          value: 'Streaming content is for personal, non-commercial learning only.',
        },
        { type: 'text', value: 'Users may not download, record, redistribute, or resell content.' },
      ],
    },
    {
      navId: 'certificates',
      navLabel: 'Certificates',
      title: '7. Certificates & Professional Use',
      level: 2,
      body: [
        {
          type: 'text',
          value:
            'NASBA-approved CPE certificates are only issued if courses are completed in compliance with NASBA rules for the delivery method.',
        },
        { type: 'text', value: 'See the Credits & Reporting section of the FAQs for details.' },
        {
          type: 'text',
          value:
            'Learners are responsible for applying knowledge appropriately; Miles Masterclass is not liable for professional decisions based on course content.',
        },
      ],
    },
    {
      navId: 'disclaimer',
      navLabel: 'Disclaimer',
      title: '8. Disclaimers & Limitation of Liability',
      level: 2,
      body: [
        { type: 'text', value: 'The Service is provided “as-is” and “as available.”' },
        {
          type: 'text',
          value:
            'We make no warranties of uninterrupted service or suitability for professional use.',
        },
        {
          type: 'text',
          value:
            'To the maximum extent allowed by law, we are not liable for indirect, incidental, or consequential damages, including lost profits or data.',
        },
      ],
    },
    {
      navId: 'data-privacy',
      navLabel: 'Data & Privacy',
      title: '9. Data & Privacy',
      level: 2,
      body: [
        {
          type: 'text',
          value:
            'We collect personal/professional data (name, email, phone, qualifications, employer, location, learning history) to provide and improve the Service.',
        },
        {
          type: 'text',
          value:
            'Third-party tools may be used for payments (Stripe), communications (Netcore), and analytics (Google/Firebase).',
        },
        richContent(
          'Users may request deletion of accounts/data via <a href="mailto:support@milesmasterclass.com" class="underline text-accent hover:text-accent/80">support@milesmasterclass.com</a>.',
        ),
        { type: 'text', value: 'For details, see the Privacy Policy.' },
      ],
    },
    {
      navId: 'global-use',
      navLabel: 'Global Use',
      title: '10. Global Use & Restrictions',
      level: 2,
      body: [
        {
          type: 'text',
          value: 'The Service is available globally; users must ensure local legal compliance.',
        },
        {
          type: 'text',
          value: 'Access may be restricted in embargoed or OFAC-restricted jurisdictions.',
        },
      ],
    },
    {
      navId: 'disputes',
      navLabel: 'Disputes',
      title: '11. Governing Law & Dispute Resolution',
      level: 2,
      body: [
        { type: 'text', value: 'Terms governed by Delaware law.' },
        richContent(
          '<strong class="text-white">Arbitration Agreement:</strong> All disputes resolved via binding arbitration in Delaware under AAA rules.',
        ),
        richContent(
          '<strong class="text-white">Class Action Waiver:</strong> Users waive rights to participate in class or consolidated actions.',
        ),
        { type: 'text', value: 'Individual claims may be filed in Delaware small claims court.' },
      ],
    },
    {
      navId: 'termination',
      navLabel: 'Termination',
      title: '12. Termination',
      level: 2,
      body: [
        { type: 'text', value: 'Users may terminate their account anytime.' },
        {
          type: 'text',
          value: 'Accounts may be suspended or terminated for violations of Terms.',
        },
      ],
    },
    {
      navId: 'modifications',
      navLabel: 'Modifications',
      title: '13. Modifications',
      level: 2,
      body: [
        { type: 'text', value: 'Terms may be updated; continued use indicates acceptance.' },
        { type: 'text', value: 'Latest version always reflected in the Last Updated date.' },
      ],
    },
    {
      navId: 'contact',
      navLabel: 'Contact',
      title: '14. Contact',
      level: 2,
      body: [
        richContent(
          '<strong class="text-white">Support:</strong> <a href="mailto:support@milesmasterclass.com" class="underline text-accent hover:text-accent/80">support@milesmasterclass.com</a>',
        ),
        richContent(
          '<strong class="text-white">Disputes:</strong> <a href="mailto:dispute@milesmasterclass.com" class="underline text-accent hover:text-accent/80">dispute@milesmasterclass.com</a>',
        ),
      ],
    },
  ],
};

/**
 * Per-locale overrides. Empty today — add a `${country}:${profession}` key
 * (lowercased) when a market needs different copy. The shape of each entry
 * must match `LegalDoc`.
 */
const LOCALE_OVERRIDES: Partial<Record<LocaleKey, LegalDoc>> = {
  // 'in:accounting': IN_ACCOUNTING_TERMS_OF_SERVICE,
};

/** Returns the right Terms of Service doc for the active locale. */
export const resolveTermsOfService = (country: CountryCode, profession: ProfessionType): LegalDoc =>
  resolveByLocale(LOCALE_OVERRIDES, DEFAULT_TERMS_OF_SERVICE, country, profession);
